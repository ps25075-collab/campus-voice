// 건의함 열람(편집부 전용) — service_role로 RLS 우회, 스태프 토큰(admin/editor) 검증.
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../_lib/staffToken.js';

export default async function handler(req, res) {
  const staff = requireStaff(req, ['admin', 'editor']); // 건의함 열람은 편집부(admin/editor)
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'server not configured' });
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('suggestions').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'load failed' });
    return res.status(200).json({ suggestions: data || [] });
  }
  return res.status(405).end();
}
