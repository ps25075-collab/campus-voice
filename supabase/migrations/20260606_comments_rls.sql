-- Stage 2d: comments RLS — 익명 댓글 작성은 유지하되, anon의 댓글 수정/삭제를 차단.
-- 문제: comments가 anon에 완전 개방되어 누구나 모든 댓글을 삭제(대량 파괴)하거나
--       타인 댓글의 text/name을 수정(사칭)할 수 있었다. (소유자 컬럼이 없어 RLS로 본인성 검증 불가)
-- 방침: INSERT는 공개 유지(익명 댓글 기능). UPDATE는 likes 카운터만 허용. DELETE는 차단 →
--       댓글 삭제는 admin/editor 서버 API(/api/comments)로만.
-- 적용: Supabase 대시보드 → SQL Editor → Run.

alter table public.comments enable row level security;

-- 조회: 공개
drop policy if exists comments_select_all on public.comments;
create policy comments_select_all on public.comments
  for select using (true);

-- 작성: 공개 유지(비로그인 익명 댓글 허용)
drop policy if exists comments_insert_all on public.comments;
create policy comments_insert_all on public.comments
  for insert with check (true);

-- 수정: 행 수준은 통과시키되, 변경 가능한 컬럼을 likes(좋아요 카운터)로만 제한.
--       → text/name/parent_id 등 내용 변조(사칭 편집) 불가.
drop policy if exists comments_update_likes on public.comments;
create policy comments_update_likes on public.comments
  for update using (true) with check (true);
revoke update on public.comments from anon, authenticated;
grant  update (likes) on public.comments to anon, authenticated;

-- 삭제: 클라이언트 직접 차단 (정책 없음 + revoke). 삭제는 서버 API(admin/editor)만.
revoke delete on public.comments from anon, authenticated;

-- 입력 크기 제한(대용량 스팸 완화). 기존 행은 짧아 검증 통과.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comments_len_chk') then
    alter table public.comments
      add constraint comments_len_chk
      check (char_length(text) <= 2000 and char_length(coalesce(name,'')) <= 60);
  end if;
end $$;
