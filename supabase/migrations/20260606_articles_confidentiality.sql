-- Stage 2e: articles 기밀성 — anon이 대기/반려(미게재) 기사 본문을 읽지 못하도록 SELECT를 제한.
-- 문제: 20260606_articles_rls.sql의 SELECT 정책이 using(true)라 anon이 status가 published가 아닌
--       초안(대기/반려) 본문까지 REST로 조회할 수 있었다.
-- 방침: anon은 게재글만. 로그인 회원은 게재글 + 본인 글. 관리자/스태프(세션 없는 anon)의
--       대기글 검토는 서버 API(/api/admin/articles, service_role)로 받아온다.
-- 적용: Supabase 대시보드 → SQL Editor → Run.
--
-- ⚠️ 중요: 아래는 기존 articles_select_all(using true)을 '반드시' 대체한다. 남겨두면 무력화된다.

drop policy if exists articles_select_all on public.articles;

-- 비로그인(anon): 게재글만
drop policy if exists articles_select_published on public.articles;
create policy articles_select_published on public.articles
  for select to anon
  using (status = 'published');

-- 로그인 회원(authenticated): 게재글 + 본인이 작성한 글(초안 포함)
-- author_id는 text로 회원 uid 문자열을 저장하므로 auth.uid()::text 와 비교.
drop policy if exists articles_select_member on public.articles
;
create policy articles_select_member on public.articles
  for select to authenticated
  using (status = 'published' or author_id = auth.uid()::text);

-- 참고: service_role(서버 API)은 RLS를 우회하므로 관리자 전체 목록 조회에 영향 없음.
