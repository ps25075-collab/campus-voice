// 댓글 모더레이션 — 삭제는 admin/editor만(service_role로 RLS 우회).
// anon/회원의 직접 삭제는 RLS로 차단되므로 삭제는 이 엔드포인트로만 수행된다.
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from './_lib/staffToken.js';
import { writeAudit } from './_lib/audit.js';
import { V } from './_lib/validate.js';
import { pgValue } from './_lib/pgrest.js';
import { guardMutation } from './_lib/csrf.js';

export default async function handler(req, res) {
  if (guardMutation(req, res)) return; // CSRF: preflight 처리 + 교차 출처 차단
  if (req.method !== 'POST') return res.status(405).end();

  const staff = requireStaff(req, ['admin', 'editor']);
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' });
  const svc = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  const { action, id } = req.body || {};

  if (action === 'delete') {
    // id는 반드시 양의 정수. .or()는 '원시 필터 문자열'이므로 pgValue 화이트리스트로 한 번 더 차단.
    const idv = V.intId(id);
    if (!idv.ok) return res.status(400).json({ error: 'invalid id' });
    const cid = idv.value;
    // 해당 댓글과 그 답글(parent_id)을 함께 삭제
    const { error } = await svc.from('comments').delete().or(`id.eq.${pgValue(cid)},parent_id.eq.${pgValue(cid)}`);
    if (error) { console.error('[comments] delete error:', error.message); return res.status(500).json({ error: 'delete failed' }); }
    await writeAudit(svc, { actor: staff, action: 'comment.delete', targetTable: 'comments', targetId: cid, req });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'unknown action' });
}
