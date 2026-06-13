// 공개 사용자 콘텐츠 엔드포인트 — 댓글·답글·건의 '작성' + 댓글 '모더레이션(삭제)'.
//
// 왜 한 파일인가: Vercel 무료 플랜 서버리스 함수 개수 제한(12개)을 지키려고, 성격이 비슷한
//   공개 쓰기 동작을 action 디스패처로 묶었다(api/admin.js와 동일한 통합 패턴).
//
// 봇/스팸 방어(우려 #2): 댓글·건의는 원래 클라이언트가 anon 키로 DB에 '직접 INSERT' 했는데,
//   그러면 IP 레이트리밋을 우회할 수 있다. 그래서 직접 INSERT를 RLS로 막고(서버 경유 강제),
//   이 엔드포인트가 허니팟 + IP 레이트리밋 + 길이검증을 거쳐 service_role로 삽입한다.
//   작성자 이름은 서버가 resolvePrincipal로 강제 → 사칭 불가(클라이언트가 보낸 name 무시).
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from './_lib/staffToken.js';
import { resolvePrincipal } from './_lib/principal.js';
import { writeAudit } from './_lib/audit.js';
import { V } from './_lib/validate.js';
import { pgValue } from './_lib/pgrest.js';
import { guardMutation } from './_lib/csrf.js';
import { checkMassDeletion } from './_lib/alert.js';
import { clientIp, rateLimited } from './_lib/rateLimit.js';

const MAX_TEXT = 2000;

function svcClient(res) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL) {
    res.status(500).json({ error: 'server not configured' });
    return null;
  }
  return createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (guardMutation(req, res)) return; // CSRF: preflight 처리 + 교차 출처 차단
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  // 허니팟: 사람에게 안 보이는 필드(hp)가 채워져 오면 봇 → 조용히 성공 처리(아무 동작 안 함).
  if (body.hp) return res.status(200).json({ ok: true });

  const action = body.action;

  // ── 댓글/답글 작성 (익명 허용) ──
  if (action === 'create' || action === 'reply') {
    const svc = svcClient(res); if (!svc) return;

    if (await rateLimited(svc, { key: `comment:${clientIp(req)}`, max: 8, windowSeconds: 120 }))
      return res.status(429).json({ error: '댓글이 너무 많습니다. 잠시 후 다시 시도해주세요.' });

    const av = V.intId(body.article_id);
    if (!av.ok) return res.status(400).json({ error: 'invalid article_id' });
    const tv = V.str(body.text, { min: 1, max: MAX_TEXT, field: 'text' });
    if (!tv.ok) return res.status(400).json({ error: tv.error });

    let parentId = null;
    if (action === 'reply') {
      const pv = V.intId(body.parent_id);
      if (!pv.ok) return res.status(400).json({ error: 'invalid parent_id' });
      parentId = pv.value;
    }

    // 작성자 이름은 서버가 강제: 회원은 프로필 이름, 그 외(익명·직원)는 '익명'. (클라 name 무시)
    const principal = await resolvePrincipal(req, svc);
    const name = principal?.kind === 'member' ? principal.name : '익명';

    const row = { article_id: av.value, name, text: tv.value, date: todayStr(), parent_id: parentId, likes: 0 };
    const { data, error } = await svc.from('comments').insert(row).select().single();
    if (error) { console.error('[comments] create error:', error.message); return res.status(500).json({ error: 'create failed' }); }
    return res.status(200).json({ comment: data });
  }

  // ── 건의 작성 (로그인 필요) ──
  if (action === 'suggest') {
    const svc = svcClient(res); if (!svc) return;

    // 건의는 로그인 사용자만 → 신원을 서버가 확정(사칭/익명 스팸 차단).
    const principal = await resolvePrincipal(req, svc);
    if (!principal) return res.status(401).json({ error: 'unauthorized' });

    if (await rateLimited(svc, { key: `suggest:${clientIp(req)}`, max: 5, windowSeconds: 15 * 60 }))
      return res.status(429).json({ error: '건의가 너무 많습니다. 잠시 후 다시 시도해주세요.' });

    const cv = V.str(body.content, { min: 1, max: MAX_TEXT, field: 'content' });
    if (!cv.ok) return res.status(400).json({ error: cv.error });

    const row = { name: principal.name, content: cv.value, date: todayStr() };
    const { error } = await svc.from('suggestions').insert(row);
    if (error) { console.error('[suggest] create error:', error.message); return res.status(500).json({ error: 'create failed' }); }
    return res.status(200).json({ ok: true });
  }

  // ── 댓글 삭제 (admin/editor 모더레이션) ──
  if (action === 'delete') {
    const staff = requireStaff(req, ['admin', 'editor']);
    if (!staff) return res.status(401).json({ error: 'unauthorized' });

    const svc = svcClient(res); if (!svc) return;

    // id는 반드시 양의 정수. .or()는 '원시 필터 문자열'이므로 pgValue 화이트리스트로 한 번 더 차단.
    const idv = V.intId(body.id);
    if (!idv.ok) return res.status(400).json({ error: 'invalid id' });
    const cid = idv.value;
    // 해당 댓글과 그 답글(parent_id)을 함께 삭제
    const { error } = await svc.from('comments').delete().or(`id.eq.${pgValue(cid)},parent_id.eq.${pgValue(cid)}`);
    if (error) { console.error('[comments] delete error:', error.message); return res.status(500).json({ error: 'delete failed' }); }
    await writeAudit(svc, { actor: staff, action: 'comment.delete', targetTable: 'comments', targetId: cid, req });
    await checkMassDeletion(svc, { actor: staff, action: 'comment.delete', req });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'unknown action' });
}
