-- 기사에 (1) 기자 연락 이메일, (3) 사진 출처 컬럼 추가.
-- - author_email: 기사 작성 시 기재하고, 게재된 기사 하단에 공개 표시(독자 문의용).
-- - image_source: 첨부 사진의 출처. 사진 하단 캡션으로 표시.
-- 둘 다 선택 입력이며, 게재글은 anon SELECT로 공개되므로 별도 RLS 변경 불필요.
-- 적용: Supabase 대시보드 → SQL Editor → Run. (재실행 안전: IF NOT EXISTS)

alter table public.articles add column if not exists author_email text;
alter table public.articles add column if not exists image_source text;
