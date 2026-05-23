-- 북마크(저장한 글) 테이블 — 회원·직원 통합
-- user_id 포맷:
--   회원(이메일/Google): auth.uid() 문자열
--   직원(admin/editor/columnist): 'staff:' + 사용자 ID  (예: 'staff:admin')
--
-- 기존 articles/comments/suggestions 테이블과 동일하게 RLS 비활성 패턴 유지.
-- (학교 신문 프로젝트 — anon 접근 허용)

create table if not exists public.bookmarks (
  user_id     text        not null,
  article_id  bigint      not null references public.articles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists bookmarks_user_id_created_at_idx
  on public.bookmarks (user_id, created_at desc);
