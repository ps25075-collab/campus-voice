-- Stage 2g: article-images 스토리지 버킷 과다 권한 차단.
-- 문제: 버킷이 public인데 (1) 목록조회(SELECT) 허용 → 전체 파일 나열 가능,
--       (2) anon INSERT/DELETE 허용 → 누구나 임의 파일 업로드·타인 이미지 덮어쓰기·삭제,
--       (3) file_size_limit/allowed_mime_types 없음 → 비이미지·대용량 남용.
-- 방침: 버킷에 용량·MIME 제한. 과다 정책(목록/익명 업로드/익명 삭제) 전부 제거.
--       업로드는 서버 서명 URL(/api/upload-url, service_role + 역할검증 + 작성자별 경로)로만.
--       공개 읽기는 public 버킷이라 정책 없이도 공개 URL로 동작(정책 불필요).
-- 적용: Supabase 대시보드 → SQL Editor → Run.

-- (1) 버킷 제한: 공개 유지 + 3MB 상한 + 이미지 MIME만 허용
update storage.buckets
   set public = true,
       file_size_limit = 3145728,  -- 3 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
 where id = 'article-images';

-- (2) 과다 정책 제거
--  - 목록조회(SELECT): 공개 URL 접근에는 불필요 → 제거하면 익명 파일 나열 차단
--  - 익명 업로드/삭제: 서버 서명 업로드(service_role)로 대체 → 제거
drop policy if exists "public read article images"   on storage.objects;
drop policy if exists "anon upload article images"    on storage.objects;
drop policy if exists "anon delete article images"    on storage.objects;

-- 참고: 서명 업로드 토큰과 service_role은 RLS를 우회하므로 정상 업로드/삭제에 영향 없음.
--       이미지 표시는 public 버킷의 공개 엔드포인트(/object/public/...)로 계속 동작한다.
