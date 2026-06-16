-- 우려 #3: 계정 표적 분산 무차별 대입(여러 IP) 방어 — 계정(username) 단위 실패 카운터/잠금.
--
-- 문제: 기존 레이트리밋은 IP 단위(login_attempts.ip)뿐이라, 공격자가 IP를 분산하면
--   한 계정을 향한 무차별 대입을 우회할 수 있다(각 IP는 한도 미만이어도 합산은 큼).
-- 방침: 계정(username) 단위 실패 카운터를 병행한다. 윈도우 내 실패가 임계치를 넘으면
--   해당 계정을 일정 시간 '잠금'하고, 잠긴 동안에는 비밀번호가 맞아도 로그인을 거부한다.
--   잠금 발생 시 관리자에게 경보 메일을 1회 보낸다(api/login.js + api/_lib/alert.js).
--
-- 노출/남용 방지: 카운터는 실제 존재하는 계정(api/login.js에서 user 조회 성공)에 대해서만
--   증가시킨다 → 임의 username 으로 테이블을 채우는 플러딩/무한 증가를 막는다. 잠금 응답은
--   IP 한도와 동일한 일반 429 문구를 쓰므로 계정 존재 여부 추가 노출을 최소화한다.
--
-- 접근 제어: RLS 활성 + 정책 없음 => anon/authenticated 전면 차단, service_role(서버)만 접근.
--
-- 적용: Supabase 대시보드 → SQL Editor → Run. (재실행 안전: if not exists / create or replace)

-- 1) 계정 단위 시도 기록 ---------------------------------------------------
create table if not exists public.account_login_attempts (
  account      text        primary key,   -- 로그인 시도된 계정(staff_users.id)
  count        integer     not null default 0,
  reset_at     timestamptz not null,      -- 이 시각 지나면 count 리셋
  locked_until timestamptz,               -- 설정돼 있고 미래면 잠금 상태
  updated_at   timestamptz not null default now()
);

alter table public.account_login_attempts enable row level security;
-- 정책을 만들지 않음 => service_role 만 접근(클라이언트 전면 차단).

-- 2) 계정 실패 카운트 원자적 증가 + 임계 도달 시 잠금 -----------------------
-- 윈도우 만료면 1로 리셋, 아니면 +1. 누적이 임계치(p_max_attempts) 이상이고 아직
-- 잠겨있지 않으면 p_lock_seconds 만큼 새로 잠근다. (count, locked_until, just_locked) 반환.
create or replace function public.register_failed_account_login(
  p_account        text,
  p_window_seconds integer,
  p_max_attempts   integer,
  p_lock_seconds   integer
) returns table(count integer, locked_until timestamptz, just_locked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer;
  v_locked timestamptz;
  v_was_locked boolean;
begin
  insert into public.account_login_attempts (account, count, reset_at, updated_at)
  values (p_account, 1, now() + make_interval(secs => p_window_seconds), now())
  on conflict (account) do update set
    count = case
              when public.account_login_attempts.reset_at < now() then 1
              else public.account_login_attempts.count + 1
            end,
    reset_at = case
                 when public.account_login_attempts.reset_at < now()
                   then now() + make_interval(secs => p_window_seconds)
                 else public.account_login_attempts.reset_at
               end,
    updated_at = now()
  returning public.account_login_attempts.count, public.account_login_attempts.locked_until
    into v_count, v_locked;

  v_was_locked := v_locked is not null and v_locked > now();

  if v_count >= p_max_attempts and not v_was_locked then
    update public.account_login_attempts
      set locked_until = now() + make_interval(secs => p_lock_seconds),
          updated_at = now()
      where account = p_account
      returning public.account_login_attempts.locked_until into v_locked;
    just_locked := true;
  else
    just_locked := false;
  end if;

  count := v_count;
  locked_until := v_locked;
  return next;
end;
$$;

-- service_role 만 실행 가능하도록 (기본 public 실행권한 회수)
revoke all on function public.register_failed_account_login(text, integer, integer, integer) from public;
revoke all on function public.register_failed_account_login(text, integer, integer, integer) from anon;
revoke all on function public.register_failed_account_login(text, integer, integer, integer) from authenticated;
