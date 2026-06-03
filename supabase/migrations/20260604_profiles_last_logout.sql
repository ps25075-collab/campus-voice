-- 회원 로그아웃 시각 기록 (마지막 로그아웃 일시)
alter table public.profiles add column if not exists last_logout_at timestamptz;
