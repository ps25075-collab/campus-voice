// 관리자 2단계 인증(이메일 OTP) 등록/해제 스크립트 (우려 #1).
//
// 스태프 계정에 인증 코드 수신 이메일(보통 본인 Gmail)을 지정한다. 등록하면 이후 그 계정
// 로그인 시, 비밀번호 통과 후 그 주소로 6자리 일회용 코드가 발송되고 입력해야 통과한다.
// Authenticator 앱이 필요 없으며 데스크탑 메일함에서 코드를 받는다.
//
// 선행:
//   1) supabase/migrations/20260614_staff_mfa.sql 을 SQL Editor 에서 Run(mfa_* 컬럼 추가).
//   2) 프로덕션(Vercel)에 GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정돼 있어야
//      코드 메일이 실제로 발송된다(newsletter/subscribe 와 동일 키). 없으면 로그인 불가.
//
// 사용법 (로컬 .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요):
//   등록:  node --env-file=.env scripts/setup-mfa.mjs <staff_id> <email>
//   해제:  node --env-file=.env scripts/setup-mfa.mjs <staff_id> --disable
//
// 등록 후 실제로 그 계정으로 로그인해 메일 코드가 오고 통과되는지 반드시 한 번 확인할 것.

import { createClient } from '@supabase/supabase-js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const staffId = process.argv[2];
const disable = process.argv.includes('--disable');
const email = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3].trim().toLowerCase() : null;

if (!staffId) {
  console.error('❌ 사용법: node --env-file=.env scripts/setup-mfa.mjs <staff_id> <email>  (해제: <staff_id> --disable)');
  process.exit(1);
}
if (!disable && !email) {
  console.error('❌ 등록하려면 수신 이메일이 필요합니다: scripts/setup-mfa.mjs <staff_id> <email>');
  process.exit(1);
}
if (!disable && !EMAIL_RE.test(email)) {
  console.error(`❌ 이메일 형식이 올바르지 않습니다: ${email}`);
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
    .update({ mfa_email: null, mfa_code_hash: null, mfa_code_expires_at: null, mfa_code_attempts: 0, mfa_code_sent_at: null })
    .eq('id', staffId);
  if (error) { console.error('❌ 해제 실패:', error.message); process.exit(1); }
  console.log(`✅ '${staffId}' 2단계 인증 해제 완료. (다시 1단계 로그인)`);
  process.exit(0);
}

const { error } = await supabase.from('staff_users')
  .update({ mfa_email: email, mfa_code_hash: null, mfa_code_expires_at: null, mfa_code_attempts: 0, mfa_code_sent_at: null })
  .eq('id', staffId);
if (error) { console.error('❌ 저장 실패(컬럼 미적용?):', error.message); process.exit(1); }

console.log('\n✅ 이메일 OTP 2단계 인증 등록 완료:', staffId, `(${user.name})`);
console.log('   수신 이메일:', email);
console.log('\n⚠️ 이제 이 계정 로그인 시 위 주소로 6자리 코드가 발송됩니다.');
console.log('   프로덕션에 GMAIL_USER / GMAIL_APP_PASSWORD 가 설정돼 있는지 확인하고,');
console.log('   실제로 한 번 로그인해 코드 메일이 오고 통과되는지 검증하세요.');
