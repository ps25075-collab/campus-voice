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
//   delete  : admin 전용.
//   setHero : admin 전용.
import { createClient } from '@supabase/supabase-js';
import { verifyStaffToken } from './_lib/staffToken.js';

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
  const { action } = body;

  try {
    // ── 생성 ─────────────────────────────────────────────
    if (action === 'create') {
      if (!canWrite) return res.status(403).json({ error: 'forbidden' });
      const title = (body.title || '').trim();
      const content = body.body || '';
      if (!title || !content.trim()) return res.status(400).json({ error: '제목과 본문은 필수입니다.' });
      if (content.length > MAX_BODY_CHARS) return res.status(400).json({ error: '본문이 너무 깁니다.' });

      const row = {
        title,
        category: body.category || '경제',
        type: body.type || '기사',
        body: content,
        image: body.image || '',
        summary: body.summary || '',
        date: body.date || new Date().toISOString().slice(0, 10),
        // 서버가 강제하는 값 — 클라이언트 입력 무시
        status: 'pending',
        hero: false,
        views: 0,
        author: principal.name,
        author_id: principal.id,
      };
      const { data, error } = await svc.from('articles').insert(row).select().single();
      if (error) throw error;
      return res.status(200).json({ article: data });
    }

    // ── 수정(내용만) ─────────────────────────────────────
    if (action === 'update') {
      if (!canWrite) return res.status(403).json({ error: 'forbidden' });
      const id = body.id;
      if (id == null) return res.status(400).json({ error: 'id required' });

      const { data: existing, error: e1 } = await svc.from('articles').select('author_id').eq('id', id).single();
      if (e1 || !existing) return res.status(404).json({ error: 'not found' });

      const owns = existing.author_id != null && String(existing.author_id) === principal.id;
      if (!owns && !isEditor) return res.status(403).json({ error: 'forbidden' });

      const content = body.body;
      if (content != null && content.length > MAX_BODY_CHARS)
        return res.status(400).json({ error: '본문이 너무 깁니다.' });

      // 내용 필드만 화이트리스트로 반영. status/hero/author/views는 절대 변경하지 않음.
      const patch = {};
      for (const k of ['title', 'category', 'type', 'body', 'image', 'summary']) {
        if (body[k] !== undefined) patch[k] = k === 'title' ? String(body[k]).trim() : body[k];
      }
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing to update' });

      const { data, error } = await svc.from('articles').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json({ article: data });
    }

    // ── 상태 변경(승인/반려) — admin 전용 ─────────────────
    if (action === 'setStatus') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const { id, status } = body;
      if (id == null || !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'invalid' });
      const { data, error } = await svc.from('articles').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json({ article: data });
    }

    // ── 삭제 — admin 전용 ────────────────────────────────
    if (action === 'delete') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const { id } = body;
      if (id == null) return res.status(400).json({ error: 'id required' });
      const { error } = await svc.from('articles').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── 헤드라인 지정 — admin 전용 ───────────────────────
    if (action === 'setHero') {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
      const { id, value } = body;
      if (id == null) return res.status(400).json({ error: 'id required' });
      if (value) {
        // 헤드라인은 게재글 중 하나만 — 기존 헤드라인 해제 후 지정
        await svc.from('articles').update({ hero: false }).eq('status', 'published');
        await svc.from('articles').update({ hero: true }).eq('id', id);
      } else {
        await svc.from('articles').update({ hero: false }).eq('id', id);
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'server error' });
  }
}
