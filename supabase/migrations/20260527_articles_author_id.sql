-- '내 글' 조회를 이름(author) 문자열 대신 안정적인 ID로 하기 위한 컬럼.
-- 회원: auth.uid (UUID 문자열), 직원: 로그인 ID 문자열을 저장.
-- 이름을 변경해도 마이페이지에서 작성 글이 사라지지 않도록 함.

alter table public.articles add column if not exists author_id text;

create index if not exists articles_author_id_idx on public.articles (author_id);

-- 기존 회원 작성 기사 백필: author(표시명)이 profiles.display_name과 일치하면 해당 id 사용
update public.articles a
set author_id = p.id::text
from public.profiles p
where a.author_id is null
  and a.author is not null
  and a.author = p.display_name;
