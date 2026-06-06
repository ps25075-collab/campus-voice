import { createClient } from '@supabase/supabase-js';

// 서버 전용 관리자 클라이언트.
// service_role 키는 RLS를 우회하므로 절대 클라이언트(VITE_*)로 노출하지 말 것.
let _client = null;

export function getAdminClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
