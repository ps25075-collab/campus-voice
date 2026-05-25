-- article-images 스토리지 버킷 생성 및 공개 읽기 정책 설정
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

-- 누구나 읽기 가능 (public)
create policy if not exists "public read article images"
  on storage.objects for select
  using ( bucket_id = 'article-images' );

-- 인증된 사용자(anon 포함)가 업로드 가능
create policy if not exists "anon upload article images"
  on storage.objects for insert
  with check ( bucket_id = 'article-images' );

-- 업로드한 파일 삭제 가능
create policy if not exists "anon delete article images"
  on storage.objects for delete
  using ( bucket_id = 'article-images' );
