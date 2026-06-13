// 건의함 — 열람 + 삭제 모두 관리자(admin) 전용. service_role로 RLS 우회.
// (스태프 계정은 현재 admin뿐 — editor 스태프 계정은 없음.)
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../staffToken.js';
import { writeAudit } from '../audit.js';
import { checkMassDeletion } from '../alert.js';
import { V } from '../validate.js';

export default async function handler(req, res) {
  const staff = requireStaff(req, ['admin']);
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

  if (req.method === 'DELETE') {
    // id는 반드시 양의 정수 — 객체/배열/연산자 등 비정상 타입을 쿼리에 넘기지 않는다.
    const idv = V.intId((req.query && req.query.id) ?? (req.body && req.body.id));
    if (!idv.ok) return res.status(400).json({ error: 'invalid id' });
    const { error } = await supabase.from('suggestions').delete().eq('id', idv.value);
    if (error) return res.status(500).json({ error: 'delete failed' });
    await writeAudit(supabase, { actor: staff, action: 'suggestion.delete', targetTable: 'suggestions', targetId: idv.value, req });
    await checkMassDeletion(supabase, { actor: staff, action: 'suggestion.delete', req });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
