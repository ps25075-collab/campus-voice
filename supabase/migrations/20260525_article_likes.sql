-- 기사 공감(좋아요) 테이블 — 회원·직원 통합
-- user_id 포맷:
--   회원(이메일/Google): auth.uid() 문자열
--   직원(admin/editor/columnist): 'staff:' + 사용자 ID
--
-- 비로그인 사용자는 클라이언트 localStorage에만 저장됨.
-- 동일 (user_id, article_id) 조합으로 중복 공감 방지 (primary key).
-- bookmarks/comments와 동일하게 RLS 비활성 (학교 신문 프로젝트).

create table if not exists public.article_likes (
  user_id     text        not null,
  article_id  bigint      not null references public.articles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists article_likes_article_id_idx
  on public.article_likes (article_id);
