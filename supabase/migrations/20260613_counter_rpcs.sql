-- Stage 3a: 카운터(조회수·좋아요) 임의 변조 차단 (우려 #3)
--
-- 문제: 20260606_articles_rls.sql 이 anon/authenticated 에게 articles.(views, like_count)
--   컬럼 UPDATE 를 부여하고, comments_rls.sql 이 comments.likes UPDATE 를 부여한다.
--   그래서 anon 키로 REST 요청을 직접 보내면 views/like_count/likes 를 음수·천만 등
--   '임의의 절대값'으로 덮어쓸 수 있어 통계가 조작된다(콘텐츠 변조는 이미 차단됨).
--
-- 방침: 직접 UPDATE 권한을 회수하고, 카운터 변경은 +1/-1 만 하는 SECURITY DEFINER RPC로만 허용한다.
--   RPC는 절대값을 받지 않고 증감만 하며 0 미만으로 내려가지 않게 클램프 → 임의값 주입 불가.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. (재실행 안전)
-- 검증: 적용 후 `npm run verify:security` 가 views/like_count 변조 항목을 통과해야 한다.

-- ── 1) 직접 UPDATE 권한 회수 ────────────────────────────────────
-- articles: 카운터 컬럼 직접 수정 권한 제거(서비스롤=서버 API는 RLS 우회라 영향 없음).
revoke update (views, like_count) on public.articles from anon, authenticated;

-- comments: likes 컬럼 직접 수정 권한 제거.
revoke update (likes) on public.comments from anon, authenticated;

-- ── 2) 증감 전용 RPC (절대값 불가, 0 클램프) ────────────────────
-- 조회수 +1 (게재된 글만).
create or replace function public.bump_article_views(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articles
     set views = coalesce(views, 0) + 1
   where id = p_id and status = 'published' and deleted_at is null;
$$;

-- 좋아요 카운터 +1/-1 (그 외 값은 부호만 취함, 0 미만 클램프). 게재된 글만.
create or replace function public.bump_article_like(p_id bigint, p_delta int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articles
     set like_count = greatest(0, coalesce(like_count, 0) + sign(p_delta)::int)
   where id = p_id and status = 'published' and deleted_at is null;
$$;

-- 댓글 좋아요 +1/-1 (0 미만 클램프).
create or replace function public.bump_comment_like(p_id bigint, p_delta int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comments
     set likes = greatest(0, coalesce(likes, 0) + sign(p_delta)::int)
   where id = p_id;
$$;

-- ── 3) 실행 권한: 클라이언트(anon/authenticated)만, public 일반 회수 ──
revoke all on function public.bump_article_views(bigint)        from public;
revoke all on function public.bump_article_like(bigint, int)    from public;
revoke all on function public.bump_comment_like(bigint, int)    from public;
grant execute on function public.bump_article_views(bigint)     to anon, authenticated;
grant execute on function public.bump_article_like(bigint, int) to anon, authenticated;
grant execute on function public.bump_comment_like(bigint, int) to anon, authenticated;
