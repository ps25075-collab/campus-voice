// 스태프 전체 기사 목록 — 세션 없는 스태프(anon)는 RLS상 게재글만 보이므로,
// 대기/반려 포함 검토용 목록을 service_role로 받아온다. (staffToken 검증)
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../staffToken.js';
import { pgValue } from '../pgrest.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const staff = requireStaff(req, ['admin', 'columnist']); // editor 스태프 계정은 없음
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.SUPABASE_URL)
    return res.status(500).json({ error: 'server not configured' });
  const svc = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  // 휴지통(soft-deleted) 글은 일반 검토 목록에서 제외. (복구는 /api/articles listTrash/restore)
  let q = svc.from('articles').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  // 칼럼니스트는 본인 글 + 게재글만, admin은 전체.
  // staff.id는 서명 토큰에서 온 값이지만, .or()는 원시 필터 문자열이므로 화이트리스트로 한 번 더 차단.
  if (staff.role === 'columnist') q = q.or(`author_id.eq.${pgValue(staff.id)},status.eq.published`);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ articles: data || [] });
}
