// 댓글 모더레이션 — 삭제는 admin/editor만(service_role로 RLS 우회).
// anon/회원의 직접 삭제는 RLS로 차단되므로 삭제는 이 엔드포인트로만 수행된다.
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from './_lib/staffToken.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const staff = requireStaff(req, ['admin', 'editor']);
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' });
  const svc = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  const { action, id } = req.body || {};

  if (action === 'delete') {
    const cid = parseInt(id, 10);
    if (!Number.isFinite(cid)) return res.status(400).json({ error: 'invalid id' });
    // 해당 댓글과 그 답글(parent_id)을 함께 삭제
    const { error } = await svc.from('comments').delete().or(`id.eq.${cid},parent_id.eq.${cid}`);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'unknown action' });
}
