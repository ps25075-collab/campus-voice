-- Threat #2 강화(앱 계정 권한 최소화): anon/authenticated(클라이언트가 쓰는 키)에서
-- '서버 전용 테이블'의 모든 권한을 회수해, 인젝션·키 유출 시에도 직접 읽기/쓰기가 불가능하게 한다.
-- RLS(정책 없음)로 이미 차단되지만, GRANT까지 회수해 이중 방어(defense-in-depth)한다.
--
-- ⚠️ 클라이언트가 직접 쓰는 테이블은 건드리지 않는다(기능 유지):
--    comments(INSERT·likes UPDATE), article_likes·bookmarks(SELECT/INSERT/DELETE),
--    profiles(본인 RLS), articles(views·like_count UPDATE).
-- ⚠️ 클라이언트가 호출하는 RPC(delete_own_account, request_reapproval)도 건드리지 않는다.
--
-- 참고: DROP/TRUNCATE 등 DDL은 Supabase에서 테이블 소유자(postgres)만 가능하며,
--       anon/authenticated 역할에는 애초에 없으므로 'DROP 권한 제한'은 기본 충족 상태다.
-- 적용: 대시보드 SQL Editor → Run (또는 supabase db push).

-- 서버 전용 테이블 — 클라이언트는 SELECT/INSERT/UPDATE/DELETE 모두 불필요(전부 service_role 경유).
revoke all on public.subscribers    from anon, authenticated;
revoke all on public.staff_users     from anon, authenticated;
revoke all on public.login_attempts  from anon, authenticated;
revoke all on public.audit_log       from anon, authenticated;

-- 실패 카운트 RPC는 서버(service_role) 전용 — public/anon/authenticated 실행권한 회수(멱등 재확인).
revoke all on function public.register_failed_login(text, integer) from public, anon, authenticated;
