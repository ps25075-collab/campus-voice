-- 회원 북마크(저장한 글) 테이블
-- 적용: Supabase 대시보드 → SQL Editor에서 실행

create table if not exists public.bookmarks (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  article_id  bigint      not null references public.articles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists bookmarks_user_id_created_at_idx
  on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;

-- 본인 북마크만 조회·추가·삭제 가능
drop policy if exists "bookmarks_select_own" on public.bookmarks;
create policy "bookmarks_select_own"
  on public.bookmarks for select
  using (auth.uid() = user_id);

drop policy if exists "bookmarks_insert_own" on public.bookmarks;
create policy "bookmarks_insert_own"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "bookmarks_delete_own" on public.bookmarks;
create policy "bookmarks_delete_own"
  on public.bookmarks for delete
  using (auth.uid() = user_id);
