// 직원 계정을 Supabase staff_users 테이블에 시드(업서트)한다.
// 평문 비밀번호는 이 스크립트가 로컬에서 한 번 해시할 때만 사용되고, DB엔 해시만 저장된다.
//
// 사용법 (로컬 .env 또는 셸 환경변수 필요):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (서버 전용)
//   ADMIN_PW
//
//   node --env-file=.env scripts/seed-staff.mjs
//
// 시드 완료 후엔 Vercel/호스팅에서 *_PW 평문 환경변수를 삭제해도 된다.
//
// ⚠️ editor1/editor2/columnist1/columnist2 계정은 과거 평문 비밀번호가 공개 git
//    히스토리에 유출돼 삭제되었다(2026-06-13). 재생성 금지 — 필요 시 새 id/비밀번호로
//    추가하고, 같은 비밀번호 재사용은 금지한다.

import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../lib/password.js';

const STAFF = [
  { id: 'admin',      name: '관리자', role: 'admin',     pwEnv: 'ADMIN_PW'      },
];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const rows = [];
const missing = [];
for (const s of STAFF) {
  const pw = process.env[s.pwEnv];
  if (!pw) { missing.push(s.pwEnv); continue; }
  rows.push({
    id: s.id,
    name: s.name,
    role: s.role,
    password_hash: hashPassword(pw),
    updated_at: new Date().toISOString(),
  });
}

if (missing.length) {
  console.error(`❌ 다음 비밀번호 환경변수가 없습니다: ${missing.join(', ')}`);
  process.exit(1);
}

const { error } = await supabase.from('staff_users').upsert(rows, { onConflict: 'id' });
if (error) {
  console.error('❌ 업서트 실패:', error.message);
  process.exit(1);
}

console.log(`✅ ${rows.length}개 직원 계정 시드 완료: ${rows.map(r => r.id).join(', ')}`);
