-- Stage 2h: article_likes / bookmarks RLS — user_id 열거 및 회원 행 위조/삭제 차단.
--
-- 문제(우려 #2): 두 테이블이 RLS 비활성이라 공개 anon 키로 누구나 전체 행을 읽기/삽입/삭제.
--   ① 회원의 실제 auth UID(bare-UUID)와 'staff:*' 식별자가 그대로 열거됨(내부 구조/PII 노출),
--   ② 임의 user_id로 좋아요 위조, ③ 타인 북마크 삭제 가능.
--
-- 제약: 익명 방문자와 직원(자체 로그인)은 Supabase 세션이 없어 DB에서 'anon' 역할로 동작한다.
--       익명 식별자(anon:UUID, localStorage)는 인증 불가하므로 익명 본인성의 '완벽한' 검증은 불가능하다.
-- 방침:
--   • 회원(authenticated): auth.uid() 로 본인 행만 select/insert/delete (서버 검증, 엄격).
--   • anon 역할(익명+직원): 접두 'anon:'/'staff:' 행만 허용 → 회원 bare-UUID 행의 열거·위조·삭제 차단.
--     (잔여: anon 역할 내에서 anon:/staff: 행 간 조작은 인증 부재상 불가피 — 저영향. 완전 차단은 서버 API 경유 필요.)
--
-- 클라이언트 코드 변경 없음. 회원은 세션 클라이언트(JWT)로, 익명/직원은 anon 으로 동일 호출.
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. (재실행 안전 — drop policy if exists 사용)

-- ───────────────────────── article_likes ─────────────────────────
alter table public.article_likes enable row level security;
-- RLS + GRANT 둘 다 필요. 정상 동작 유지를 위해 명시적으로 부여(이미 있으면 무해).
grant select, insert, delete on public.article_likes to anon, authenticated;

-- 회원(로그인, auth 세션): 본인(auth.uid) 행만
drop policy if exists al_member_select on public.article_likes;
create policy al_member_select on public.article_likes
  for select to authenticated using (user_id = auth.uid()::text);

drop policy if exists al_member_insert on public.article_likes;
create policy al_member_insert on public.article_likes
  for insert to authenticated with check (user_id = auth.uid()::text);

drop policy if exists al_member_delete on public.article_likes;
create policy al_member_delete on public.article_likes
  for delete to authenticated using (user_id = auth.uid()::text);

-- 익명/직원(세션 없음 = anon 역할): 'anon:'/'staff:' 접두 행만. 회원 bare-UUID 행 접근 불가.
drop policy if exists al_anon_select on public.article_likes;
create policy al_anon_select on public.article_likes
  for select to anon using (user_id like 'anon:%' or user_id like 'staff:%');

drop policy if exists al_anon_insert on public.article_likes;
create policy al_anon_insert on public.article_likes
  for insert to anon with check (user_id like 'anon:%' or user_id like 'staff:%');

drop policy if exists al_anon_delete on public.article_likes;
create policy al_anon_delete on public.article_likes
  for delete to anon using (user_id like 'anon:%' or user_id like 'staff:%');

-- ───────────────────────── bookmarks ─────────────────────────────
-- 북마크는 로그인 사용자 전용(회원 + 직원). 익명('anon:') 행은 없음.
alter table public.bookmarks enable row level security;
grant select, insert, delete on public.bookmarks to anon, authenticated;

-- 회원: 본인(auth.uid) 행만
drop policy if exists bm_member_select on public.bookmarks;
create policy bm_member_select on public.bookmarks
  for select to authenticated using (user_id = auth.uid()::text);

drop policy if exists bm_member_insert on public.bookmarks;
create policy bm_member_insert on public.bookmarks
  for insert to authenticated with check (user_id = auth.uid()::text);

drop policy if exists bm_member_delete on public.bookmarks;
create policy bm_member_delete on public.bookmarks
  for delete to authenticated using (user_id = auth.uid()::text);

-- 직원(anon 역할): 'staff:' 접두 행만. 회원 bare-UUID 북마크 노출/삭제 불가.
drop policy if exists bm_staff_select on public.bookmarks;
create policy bm_staff_select on public.bookmarks
  for select to anon using (user_id like 'staff:%');

drop policy if exists bm_staff_insert on public.bookmarks;
create policy bm_staff_insert on public.bookmarks
  for insert to anon with check (user_id like 'staff:%');

drop policy if exists bm_staff_delete on public.bookmarks;
create policy bm_staff_delete on public.bookmarks
  for delete to anon using (user_id like 'staff:%');
