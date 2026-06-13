-- 우려 #2: 익명/회원 UGC(댓글·답글·건의) 대량 스팸/봇 방어 (앱 계층 IP 레이트리밋 + 허니팟).
--
-- 배경: 댓글·건의는 클라이언트가 anon 키로 DB에 '직접 INSERT' 했다. 이러면 서버를 거치지 않아
--   IP 레이트리밋/허니팟을 우회할 수 있다(봇이 무한 작성 → DB 폭주). 사칭 차단 트리거
--   (20260613_comment_identity.sql)도 "대량 스팸은 앱 계층 필요"라고 남겨둔 과제다.
--
-- 방침: 직접 INSERT를 막아 '서버(service_role) 경유'를 강제한다. 서버(/api/comments)가
--   허니팟 + IP 레이트리밋 + 길이검증을 거쳐 service_role로 삽입한다(service_role은 RLS 우회).
--   작성자 이름은 서버가 resolvePrincipal로 강제 → 사칭 불가.
--
-- 적용: Supabase 대시보드 → SQL Editor → Run. (재실행 안전: drop if exists / create or replace)
-- 배포 순서: 코드(서버 엔드포인트) 먼저 배포 → 이 SQL 적용. 서버 insert는 적용 전·후 모두 동작하므로 무중단.

-- ── comments: 클라이언트 직접 INSERT 차단 (서버 경유 강제) ──
-- (SELECT 공개 / likes UPDATE / DELETE 차단 정책은 20260606_comments_rls.sql 그대로 유지)
drop policy if exists comments_insert_all on public.comments;
revoke insert on public.comments from anon, authenticated;

-- 작성자 식별 트리거 갱신: 서버(service_role) 경유 삽입은 서버가 이미 신원 검증 → name 신뢰.
--   직접 경로(혹시 grant 복구 시 대비)는 기존대로 익명/회원명 강제(방어적 유지).
create or replace function public.enforce_comment_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;  -- 서버가 검증·세팅한 name 신뢰
  end if;
  if auth.uid() is null then
    new.name := '익명';
  else
    new.name := coalesce(
      (select display_name from public.profiles where id = auth.uid()),
      '회원'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists comments_enforce_identity on public.comments;
create trigger comments_enforce_identity
  before insert on public.comments
  for each row execute function public.enforce_comment_identity();

-- ── suggestions: RLS 켜고 직접 접근 차단 (작성·열람 모두 서버 service_role 경유만) ──
alter table public.suggestions enable row level security;
-- 정책을 두지 않으므로 anon/authenticated는 RLS로 전부 차단. service_role은 RLS를 우회한다.
revoke insert, select, update, delete on public.suggestions from anon, authenticated;

-- 입력 크기 제한(대용량 스팸 완화). 기존 행은 짧아 검증 통과.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suggestions_len_chk') then
    alter table public.suggestions
      add constraint suggestions_len_chk
      check (char_length(content) <= 2000 and char_length(coalesce(name, '')) <= 60);
  end if;
end $$;
