-- 우려 #1: 관리자 2단계 인증(이메일 OTP/MFA).
--
-- 문제: 스태프 로그인이 ID+비밀번호 1단계뿐이라, 피싱/크리덴셜 도용 한 번이면 관리자 장악.
-- 방침: staff_users 에 mfa_email 컬럼을 두고, 값이 있으면 로그인 2단계로 그 주소(스태프의
--   Google/Gmail 계정)로 6자리 일회용 코드를 메일 발송 → 데스크탑 메일함에서 코드를 받아
--   입력해야 통과한다(api/login.js + api/_lib/emailOtp.js). Authenticator 앱 불필요.
--
-- 무중단: mfa_email 이 null(미등록)이면 기존 1단계 로그인 그대로 동작한다. 등록은
--   scripts/setup-mfa.mjs 로 관리자가 직접 수행(스태프 계정에 수신 이메일 지정).
--
-- 코드 저장 방식: 평문이 아니라 HMAC-SHA256 해시(mfa_code_hash)만 저장한다. 백업 유출
--   시에도 유효 코드가 그대로 새지 않는다. 만료(mfa_code_expires_at)·코드별 시도 제한
--   (mfa_code_attempts)·재발송 쿨다운(mfa_code_sent_at)으로 무차별/메일폭탄을 방어한다.
--
-- 노출 경로: staff_users 는 RLS로 anon 직접 접근이 차단되어 있고, login API 는 service_role
--   로만 이 컬럼들을 읽고 쓴다. SELECT 로 anon 에 절대 노출하지 말 것.
--
-- 적용: Supabase 대시보드 → SQL Editor → Run. (재실행 안전: if not exists / if exists)

alter table public.staff_users
  add column if not exists mfa_email          text,
  add column if not exists mfa_code_hash      text,
  add column if not exists mfa_code_expires_at timestamptz,
  add column if not exists mfa_code_attempts  integer not null default 0,
  add column if not exists mfa_code_sent_at   timestamptz;

comment on column public.staff_users.mfa_email is
  '관리자 2단계 인증(이메일 OTP) 수신 주소(Gmail 등). service_role 전용. null이면 1단계 로그인.';
comment on column public.staff_users.mfa_code_hash is
  '발급된 일회용 코드의 HMAC-SHA256 해시(평문 미저장). 검증 성공/만료 시 비운다.';

-- TOTP(Authenticator 앱) 방식은 이메일 OTP로 대체됨. 라이브 미적용 상태였으므로
-- 컬럼이 있으면 제거(없으면 무동작 — 드리프트 없음).
alter table public.staff_users
  drop column if exists totp_secret;
