-- Stage 2c: articles RLS — 권한 상승/무단 게재 차단.
-- 문제: articles가 anon에 INSERT/UPDATE/DELETE 전면 개방되어, 누구나 anon 키로
--       status='published' 기사를 직접 꽂거나 임의 글을 수정·삭제할 수 있었다.
-- 방침: 클라이언트(anon·authenticated)의 직접 쓰기를 차단하고, 생성/수정/승인/삭제/헤드라인은
--       서버 API(/api/articles, service_role + staffToken/회원 JWT 검증)로만 수행한다.
--       단, 조회수·좋아요 카운터(views, like_count)는 열람자가 직접 증가시키므로 그 두 컬럼만 허용.
-- 적용: Supabase 대시보드 → SQL Editor에 붙여넣고 Run. (service_role 필요, 클라이언트에서 실행 불가)

alter table public.articles enable row level security;

-- ── 조회: 공개 유지 ──────────────────────────────────────────────
-- 관리자(스태프)는 Supabase 세션이 없어 anon으로 동작하며 승인 대기 글을 읽어야 하므로 SELECT는 열어 둔다.
-- (대기/반려 글의 anon 가독성은 별도 기밀성 과제 — 본 패치 범위는 '쓰기 권한 상승' 차단)
drop policy if exists articles_select_all on public.articles;
create policy articles_select_all on public.articles
  for select using (true);

-- ── INSERT/DELETE: 클라이언트 직접 차단 ─────────────────────────
-- 정책을 만들지 않으면 RLS가 막는다. 명시적 revoke로 이중 안전장치.
revoke insert, delete on public.articles from anon, authenticated;

-- ── UPDATE: 카운터 컬럼(views, like_count)만 허용 ────────────────
-- 행 수준은 통과시키되(정책), 변경 가능한 컬럼은 권한(GRANT)으로 제한한다.
-- → status/hero/title/body/author 등 민감 컬럼은 클라이언트가 절대 수정 불가.
drop policy if exists articles_update_counters on public.articles;
create policy articles_update_counters on public.articles
  for update using (true) with check (true);

revoke update on public.articles from anon, authenticated;        -- 전체 컬럼 회수
grant  update (views, like_count) on public.articles to anon, authenticated;  -- 카운터만 부여

-- 참고: service_role 키(서버 API)는 RLS를 우회하고 모든 컬럼 권한을 가지므로
--       /api/articles 의 생성/수정/승인/삭제/헤드라인 동작에는 영향이 없다.
