// 회원 관리(관리자 전용) — service_role로 RLS 우회, 스태프 토큰(admin) 검증.
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../staffToken.js';
import { writeAudit } from '../audit.js';
import { V } from '../validate.js';

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
    const idv = V.uuid(id);                                  // 회원 id는 반드시 uuid 형식
    const rv = V.oneOf(role, ALLOWED_ROLES, 'role');         // 역할은 허용 목록만
    if (!idv.ok || !rv.ok) return res.status(400).json({ error: 'invalid' });
    const { data: before } = await supabase.from('profiles').select('role').eq('id', idv.value).maybeSingle();
    const { error } = await supabase.from('profiles').update({ role: rv.value }).eq('id', idv.value);
    if (error) return res.status(500).json({ error: 'update failed' });
    await writeAudit(supabase, { actor: staff, action: 'member.role', targetTable: 'profiles', targetId: idv.value, detail: { from: before?.role ?? null, to: rv.value }, req });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
