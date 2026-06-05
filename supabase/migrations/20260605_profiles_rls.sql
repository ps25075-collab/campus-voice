-- Stage 2b: profiles(회원) RLS — 회원 실명·이메일(PII) anon 노출 차단 + role 자가 변경(권한 상승) 차단
-- 패턴: 본인 행만 셀프 접근(authenticated), 관리자 열람/승인은 service_role 서버 API(/api/admin/members),
--       role 변경은 service_role 또는 SECURITY DEFINER 함수(request_reapproval)로만.

alter table public.profiles enable row level security;

-- anon은 어떤 정책도 부여하지 않음 → SELECT/INSERT/UPDATE/DELETE 전면 차단(PII 보호).
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

-- 본인 행만 조회(로그인 시 프로필 로드)
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);

-- 본인 행만 생성(가입 시 프로필 upsert; ON CONFLICT DO NOTHING이라 role UPDATE 권한 불필요)
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- 본인 행만 수정(약관 동의/마지막 로그아웃 시각 등) — role 컬럼은 아래 권한 회수로 차단
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 본인 행만 삭제(탈퇴 폴백)
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- 권한 상승 방지: 일반 사용자가 role 컬럼을 직접 변경하지 못하도록 컬럼 UPDATE 권한 회수.
-- (승인/거절은 service_role 서버 API가 RLS·권한을 우회하여 처리)
revoke update (role) on public.profiles from authenticated;
revoke update (role) on public.profiles from anon;

-- 재승인 요청(거절→대기)만 허용하는 SECURITY DEFINER 함수. 그 외 role 전환은 불가.
create or replace function public.request_reapproval()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set role = 'pending'
   where id = auth.uid()
     and role = 'rejected';
end;
$$;

revoke all on function public.request_reapproval() from public;
grant execute on function public.request_reapproval() to authenticated;
