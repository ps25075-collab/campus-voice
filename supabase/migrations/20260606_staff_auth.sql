-- 스태프 로그인 보호 강화
--   1) staff_users    : 직원 계정 + scrypt 비밀번호 해시 (env 평문 제거)
--   2) login_attempts : IP별 시도 횟수 (서버리스 인스턴스 간 공유되는 영속 레이트리밋)
--   3) register_failed_login() : 실패 시 원자적 카운트 증가 RPC
--
-- 두 테이블 모두 RLS 활성 + 정책 없음 => anon/authenticated 접근 전면 차단.
-- 오직 service_role 키(서버 전용)만 접근 가능 => 해시가 절대 클라이언트로 노출되지 않음.

-- 1) 직원 계정 -------------------------------------------------------------
create table if not exists public.staff_users (
  id            text        primary key,
  name          text        not null,
  role          text        not null,
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.staff_users enable row level security;
-- 정책을 만들지 않음 => anon/authenticated 전면 차단, service_role 만 우회.

-- 2) 레이트리밋 기록 -------------------------------------------------------
create table if not exists public.login_attempts (
  ip         text        primary key,
  count      integer     not null default 0,
  reset_at   timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

-- 3) 실패 카운트 원자적 증가 ----------------------------------------------
-- 윈도우가 만료됐으면 1로 리셋, 아니면 +1. 새 count 반환.
create or replace function public.register_failed_login(
  p_ip text,
  p_window_seconds integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.login_attempts (ip, count, reset_at, updated_at)
  values (p_ip, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (ip) do update set
    count = case
              when public.login_attempts.reset_at < now() then 1
              else public.login_attempts.count + 1
            end,
    reset_at = case
                 when public.login_attempts.reset_at < now()
                   then now() + make_interval(secs => p_window_seconds)
                 else public.login_attempts.reset_at
               end,
    updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

-- service_role 만 실행 가능하도록 (기본 public 실행권한 회수)
revoke all on function public.register_failed_login(text, integer) from public;
revoke all on function public.register_failed_login(text, integer) from anon;
revoke all on function public.register_failed_login(text, integer) from authenticated;
