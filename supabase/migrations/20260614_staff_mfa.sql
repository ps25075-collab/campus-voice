-- 우려 #1: 관리자 2단계 인증(TOTP/MFA).
--
-- 문제: 스태프 로그인이 ID+비밀번호 1단계뿐이라, 피싱/크리덴셜 도용 한 번이면 관리자 장악.
-- 방침: staff_users 에 totp_secret(base32) 컬럼을 두고, 값이 있으면 로그인 2단계로
--   6자리 TOTP 코드를 추가 검증한다(api/login.js + api/_lib/totp.js).
--
-- 무중단: totp_secret 이 null(미등록)이면 기존 1단계 로그인 그대로 동작한다. 등록은
--   scripts/setup-mfa.mjs 로 관리자가 직접 수행(새 비밀키 생성 → 이 컬럼에 저장).
--
-- 비밀키 노출 경로: staff_users 는 RLS로 anon 직접 접근이 차단되어 있고, login API 는
--   service_role 로만 이 컬럼을 읽는다. SELECT 에 totp_secret 을 절대 anon 으로 노출하지 말 것.
--
-- 적용: Supabase 대시보드 → SQL Editor → Run. (재실행 안전: if not exists)

alter table public.staff_users
  add column if not exists totp_secret text;

comment on column public.staff_users.totp_secret is
  '관리자 2단계 인증(TOTP) base32 비밀키. service_role 전용. null이면 1단계 로그인.';
