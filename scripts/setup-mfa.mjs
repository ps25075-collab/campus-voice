// 관리자 2단계 인증(TOTP) 등록/해제 스크립트 (우려 #1).
//
// 새 비밀키를 생성해 staff_users.totp_secret 에 저장하고, Authenticator 앱(Google
// Authenticator·1Password 등) 등록용 otpauth:// URI 와 수동 입력용 시크릿을 출력한다.
// 한 번 등록하면 이후 직원 로그인에 6자리 코드가 필요해진다.
//
// 선행: supabase/migrations/20260614_staff_mfa.sql 을 SQL Editor 에서 Run(컬럼 추가).
//
// 사용법 (로컬 .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요):
//   등록:  node --env-file=.env scripts/setup-mfa.mjs <staff_id>
//   해제:  node --env-file=.env scripts/setup-mfa.mjs <staff_id> --disable
//
// 등록 후 출력된 URI 를 Authenticator 에 추가하고, 앱이 만든 6자리 코드로 로그인되는지
// 반드시 한 번 확인한 뒤 이 셸 기록을 지운다(시크릿은 출력에만 노출됨).

import { createClient } from '@supabase/supabase-js';
import { generateTotpSecret, otpauthUri } from '../api/_lib/totp.js';

const ISSUER = '세계를 알리다';

const staffId = process.argv[2];
const disable = process.argv.includes('--disable');
if (!staffId) {
  console.error('❌ 사용법: node --env-file=.env scripts/setup-mfa.mjs <staff_id> [--disable]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// 대상 계정 확인
const { data: user, error: selErr } = await supabase
  .from('staff_users').select('id, name').eq('id', staffId).maybeSingle();
if (selErr) { console.error('❌ 조회 실패:', selErr.message); process.exit(1); }
if (!user) { console.error(`❌ staff_users 에 '${staffId}' 계정이 없습니다.`); process.exit(1); }

if (disable) {
  const { error } = await supabase.from('staff_users')
    .update({ totp_secret: null }).eq('id', staffId);
  if (error) { console.error('❌ 해제 실패:', error.message); process.exit(1); }
  console.log(`✅ '${staffId}' 2단계 인증 해제 완료. (다시 1단계 로그인)`);
  process.exit(0);
}

const secret = generateTotpSecret();
const uri = otpauthUri({ secret, label: staffId, issuer: ISSUER });

const { error } = await supabase.from('staff_users')
  .update({ totp_secret: secret }).eq('id', staffId);
if (error) { console.error('❌ 저장 실패(컬럼 미적용?):', error.message); process.exit(1); }

console.log('\n✅ TOTP 등록 완료:', staffId, `(${user.name})`);
console.log('\n── Authenticator 앱에 아래 중 하나로 추가 ──');
console.log('1) otpauth URI(QR 생성기/딥링크):\n   ' + uri);
console.log('\n2) 수동 입력 시크릿(base32):\n   ' + secret);
console.log('   (계정: ' + staffId + ' / 발급자: ' + ISSUER + ' / SHA1 / 6자리 / 30초)');
console.log('\n⚠️ 앱에 추가한 뒤 6자리 코드로 로그인되는지 즉시 확인하고, 이 출력/셸 기록을 지우세요.');
