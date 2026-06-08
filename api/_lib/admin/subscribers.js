// 구독자 관리(관리자 전용) — service_role로 RLS 우회, 스태프 토큰으로 인가 검증.
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../staffToken.js';
import { writeAudit } from '../audit.js';

export default async function handler(req, res) {
  const staff = requireStaff(req, ['admin']); // 구독자 관리는 관리자만
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'server not configured' });
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('subscribers').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'load failed' });
    return res.status(200).json({ subscribers: data || [] });
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('subscribers').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'delete failed' });
    await writeAudit(supabase, { actor: staff, action: 'subscriber.delete', targetTable: 'subscribers', targetId: id, req });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
