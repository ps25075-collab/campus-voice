-- Stage 2f: profiles INSERT 시 role 자가 지정(권한 상승) 차단.
-- 문제: profiles_insert_own 정책이 with check (auth.uid() = id) 뿐이라 role 값을 제한하지 않았다.
--       revoke update(role)로 '수정'은 막았으나, 신규 가입 INSERT에서 role='admin'을 직접 넣을 수 있었다.
-- 방침: 신규 프로필 생성은 role='pending'만 허용. 승격은 service_role 서버 API(/api/admin/members)로만.
--       (클라이언트 가입 코드는 항상 role:'pending'으로 upsert하므로 정상 동작에는 영향 없음)
-- 적용: Supabase 대시보드 → SQL Editor → Run.

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and role = 'pending');
