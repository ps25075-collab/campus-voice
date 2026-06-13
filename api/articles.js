// 기사(articles) 변경 단일 진입점 — service_role로 RLS를 우회해 쓰기를 수행하되,
// 권한은 서버에서 엄격히 검증한다. 클라이언트의 role/status는 절대 신뢰하지 않는다.
//
// 인증 주체(principal) 2종:
//   - 스태프(admin/editor/columnist): HMAC staffToken (Authorization: Bearer <token>)
//   - 회원(reporter/columnist): Supabase 세션 JWT (Authorization: Bearer <access_token>)
//
// 액션별 권한:
//   create  : 작성 권한 보유자(아래 CAN_WRITE). status는 서버가 'pending'으로 강제.
//   update  : 본인 글(author_id 일치) 또는 admin/editor. 내용 필드만. status/hero 변경 불가.
//   setStatus: admin 전용. (pending|published|rejected)
//   delete  : admin 전용. soft delete(휴지통) + 재인증 + 감사 로그.
//   restore : admin 전용. 휴지통에서 복구.
//   purge   : admin 전용. 휴지통의 글을 영구 삭제 + 재인증 + 감사 로그.
//   listTrash: admin 전용. 휴지통 목록.
//   setHero : admin 전용.
import { createClient } from '@supabase/supabase-js';
import { verifyStaffToken } from './_lib/staffToken.js';
import { writeAudit } from './_lib/audit.js';
import { reauthStaff } from './_lib/reauth.js';
import { V } from './_lib/validate.js';
import { guardMutation } from './_lib/csrf.js';

const CAN_WRITE = ['admin', 'editor', 'columnist', 'reporter'];
const MAX_BODY_CHARS = 50000;
const VALID_STATUS = ['pending', 'published', 'rejected'];

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

// 요청자 신원 확정: 스태프 토큰 → 회원 JWT 순으로 검증.
async function resolvePrincipal(req, svc) {
  const token = bearer(req);
  if (!token) return null;

  // 1) 스태프 서명 토큰
  const staff = verifyStaffToken(token);
  if (staff) return { kind: 'staff', id: String(staff.id), name: staff.name, role: staff.role };

  // 2) 회원 Supabase 세션 JWT
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  const uid = data.user.id;
  const { data: prof } = await svc.from('profiles').select('role, display_name').eq('id', uid).single();
  if (!prof) return null;
  return { kind: 'member', id: String(uid), name: prof.display_name || '회원', role: prof.role };
}

export default async function handler(req, res) {
  if (guardMutation(req, res)) return; // CSRF: preflight 처리 + 교차 출처 차단
  if (req.method !== 'POST') return res.status(405).end();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' });
  const svc = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  const principal = await resolvePrincipal(req, svc);
  if (!principal) return res.status(401).json({ error: 'unauthorized' });

  const isAdmin = principal.kind === 'staff' && principal.role === 'admin';
  const isEditor = principal.kind === 'staff' && (principal.role === 'admin' || principal.role === 'editor');
  const canWrite = CAN_WRITE.includes(principal.role);

  const body = req.body || {};
  // 액션은 허용 목록으로만(임의 문자열·객체 차단).
  const av = V.oneOf(body.action, ['create', 'update', 'setStatus', 'delete', 'listTrash', 'restore', 'purge', 'setHero'], 'action');
  if (!av.ok) return res.status(400).json({ error: 'unknown action' });
  const action = av.value;

  // id가 필요한 액션은 양의 정수로 강제(타입 혼동·필터 오용 차단). 나머지(create/listTrash)는 null.
  let id = null;
  if (['update', 'setStatus', 'delete', 'restore', 'purge', 'setHero'].includes(action)) {
    const idv = V.intId(body.id);
    if (!idv.ok) return res.status(400).json({ error: 'invalid id' });
    id = idv.value;
  }

  try {
    // ── 생성 ─────────────────────────────────────────────
    if (action === 'create') {
      if (!canWrite) return res.status(403).json({ error: 'forbidden' });
      const tv = V.str(body.title, { min: 1, max: 300, field: '제목' });
      const bv = V.str(body.body, { min: 1, max: MAX_BODY_CHARS, trim: false, field: '본문' });
      if (!tv.ok) return res.status(400).json({ error: tv.error });
      if (!bv.ok) return res.status(400).json({ error: bv.error });
      const title = tv.value;
      const content = bv.value;
      if (!content.trim()) return res.status(400).json({ error: '본문은 필수입니다.' });
      // 선택 필드: 문자열만 허용, 아니면 기본값. (객체/배열 주입 차단)
      const optStr = (v, def, max) => {
        if (v === undefined || v === null) return def;
        const r = V.str(v, { max });
        return r.ok ? r.value : def;
      };

      const row = {
        title,
        category: optStr(body.category, '경제', 40),
        type: optStr(body.type, '기사', 40),
        body: content,
        image: optStr(body.image, '', 2000),
        summary: optStr(body.summary, '', 2000),
        date: optStr(body.date, new Date().toISOString().slice(0, 10), 30),
        // 서버가 강제하는 값 — 클라이언트 입력 무시
        status: 'pending',
        hero: false,
        views: 0,
        author: principal.name,
        author_id: principal.id,
      };
      const { data, error } = await svc.from('articles').insert(row).select().single();
      if (error) throw error;
      await writeAudit(svc, { actor: principal, action: 'article.create', targetTable: 'articles', targetId: data.id, detail: { title: data.title }, req });
      return res.status(200).json({ article: data });
    }

    // ── 수정(내용만) ─────────────────────────────────────
    if (action === 'update') {
      if (!canWrite) return res.status(403).json({ error: 'forbidden' });

      const { data: existing, error: e1 } = await svc.from('articles').select('author_id, deleted_at').eq('id', id).single();
      if (e1 || !existing) return res.status(404).json({ error: 'not found' });
      if (existing.deleted_at) return res.status(404).json({ error: 'not found' }); // 휴지통 글은 수정 불가

      const owns = existing.author_id != null && String(existing.author_id) === principal.id;
      if (!owns && !isEditor) return res.status(403).json({ error: 'forbidden' });

      // 내용 필드만 화이트리스트로 반영하되, 각 값을 문자열·길이로 검증.
      // status/hero/author/views는 절대 변경하지 않음.
      const LIMITS = { title: 300, category: 40, type: 40, body: MAX_BODY_CHARS, image: 2000, summary: 2000 };
      const patch = {};
      for (const k of Object.keys(LIMITS)) {
        if (body[k] === undefined) continue;
        const fv = V.str(body[k], { max: LIMITS[k], trim: k === 'title', field: k });
        if (!fv.ok) return res.status(400).json({ error: fv.error });
        patch[k] = fv.value;
      }
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing to update' });

      const { data, error } = await svc.from('articles').update(patch).eq('id', id).select().single();
      if (error) throw error;
      await writeAudit(svc, { actor: principal, action: 'article.update', targetTable: 'articles', targetId: id, detail: { fields: Object.keys(patch) }, req });
      return res.status(200).json({ article: data });
    }

    // ── 상태 변경(승인/반려) — admin 전용 ─────────────────
    if (action === 'setStatus') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const sv = V.oneOf(body.status, VALID_STATUS, 'status');
      if (!sv.ok) return res.status(400).json({ error: 'invalid' });
      const status = sv.value;
      const { data, error } = await svc.from('articles').update({ status }).eq('id', id).is('deleted_at', null).select().single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'not found' });
      await writeAudit(svc, { actor: principal, action: 'article.setStatus', targetTable: 'articles', targetId: id, detail: { status }, req });
      return res.status(200).json({ article: data });
    }

    // ── 삭제(휴지통으로 이동) — admin 전용 + 재인증 ───────
    // hard delete 대신 deleted_at 표시(soft delete). 공격자/실수로 인한 영구 소실 방지.
    if (action === 'delete') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      // 민감 작업 재인증(2단계): 현재 비밀번호 재확인
      if (!(await reauthStaff(svc, principal, body.confirmPassword)))
        return res.status(401).json({ error: 'reauth_required', message: '삭제하려면 비밀번호를 다시 입력하세요.' });
      const { data: row, error } = await svc.from('articles')
        .update({ deleted_at: new Date().toISOString(), deleted_by: principal.id })
        .eq('id', id).is('deleted_at', null).select().single();
      if (error) throw error;
      if (!row) return res.status(404).json({ error: 'not found' });
      await writeAudit(svc, { actor: principal, action: 'article.delete', targetTable: 'articles', targetId: id, detail: { title: row.title }, req });
      return res.status(200).json({ ok: true, softDeleted: true });
    }

    // ── 휴지통 목록 — admin 전용 ─────────────────────────
    if (action === 'listTrash') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const { data, error } = await svc.from('articles').select('*')
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ articles: data || [] });
    }

    // ── 복구(휴지통 → 복원) — admin 전용 ─────────────────
    if (action === 'restore') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const { data: row, error } = await svc.from('articles')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id).not('deleted_at', 'is', null).select().single();
      if (error) throw error;
      if (!row) return res.status(404).json({ error: 'not found' });
      await writeAudit(svc, { actor: principal, action: 'article.restore', targetTable: 'articles', targetId: id, detail: { title: row.title }, req });
      return res.status(200).json({ ok: true, article: row });
    }

    // ── 영구 삭제 — admin 전용 + 재인증. 휴지통에 있는 글만 ──
    if (action === 'purge') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      if (!(await reauthStaff(svc, principal, body.confirmPassword)))
        return res.status(401).json({ error: 'reauth_required', message: '영구 삭제하려면 비밀번호를 다시 입력하세요.' });
      const { data: existing } = await svc.from('articles').select('title, deleted_at').eq('id', id).single();
      if (!existing) return res.status(404).json({ error: 'not found' });
      if (!existing.deleted_at) return res.status(400).json({ error: '먼저 휴지통으로 이동해야 영구 삭제할 수 있습니다.' });
      const { error } = await svc.from('articles').delete().eq('id', id);
      if (error) throw error;
      await writeAudit(svc, { actor: principal, action: 'article.purge', targetTable: 'articles', targetId: id, detail: { title: existing.title }, req });
      return res.status(200).json({ ok: true, purged: true });
    }

    // ── 헤드라인 지정 — admin 전용 ───────────────────────
    if (action === 'setHero') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const value = !!body.value;
      if (value) {
        // 헤드라인은 게재글 중 하나만 — 기존 헤드라인 해제 후 지정 (휴지통 글 제외)
        await svc.from('articles').update({ hero: false }).eq('status', 'published').is('deleted_at', null);
        await svc.from('articles').update({ hero: true }).eq('id', id).is('deleted_at', null);
      } else {
        await svc.from('articles').update({ hero: false }).eq('id', id);
      }
      await writeAudit(svc, { actor: principal, action: 'article.setHero', targetTable: 'articles', targetId: id, detail: { value: !!value }, req });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'server error' });
  }
}
