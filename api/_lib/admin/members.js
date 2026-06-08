// 회원 관리(관리자 전용) — service_role로 RLS 우회, 스태프 토큰(admin) 검증.
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../staffToken.js';
import { writeAudit } from '../audit.js';

const ALLOWED_ROLES = ['reporter', 'columnist', 'rejected', 'pending'];

export default async function handler(req, res) {
  const staff = requireStaff(req, ['admin']); // 회원 승인/거절은 관리자만
  if (!staff) return res.status(401).json({ error: 'unauthorized' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'server not configured' });
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    // 스태프(admin/editor)를 제외한 가입 회원 목록
    const { data, error } = await supabase.from('profiles').select('*').not('role', 'in', '(admin,editor)');
    if (error) return res.status(500).json({ error: 'load failed' });
    return res.status(200).json({ members: data || [] });
  }

  if (req.method === 'POST') {
    const { id, role } = req.body || {};
    if (!id || !ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: 'invalid' });
    const { data: before } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle();
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) return res.status(500).json({ error: 'update failed' });
    await writeAudit(supabase, { actor: staff, action: 'member.role', targetTable: 'profiles', targetId: id, detail: { from: before?.role ?? null, to: role }, req });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
