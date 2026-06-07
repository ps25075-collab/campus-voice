// 스태프 전체 기사 목록 — 세션 없는 스태프(anon)는 RLS상 게재글만 보이므로,
// 대기/반려 포함 검토용 목록을 service_role로 받아온다. (staffToken 검증)
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../staffToken.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const staff = requireStaff(req, ['admin', 'editor', 'columnist']);
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' });
  const svc = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  let q = svc.from('articles').select('*').order('created_at', { ascending: false });
  // 칼럼니스트는 본인 글 + 게재글만, admin/editor는 전체.
  if (staff.role === 'columnist') q = q.or(`author_id.eq.${staff.id},status.eq.published`);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ articles: data || [] });
}
