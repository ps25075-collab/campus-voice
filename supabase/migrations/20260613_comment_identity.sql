-- Stage 3b: 댓글 작성자 사칭 차단 (우려 #4의 사칭 부분)
--
-- 문제: comments INSERT 가 anon 에 완전 개방(with check true)이고 name 이 사용자 입력 그대로라,
--   누구나 name 에 '편집장'·실명 등을 넣어 사칭 댓글을 달 수 있다(소유자 컬럼 없음).
--
-- 방침: BEFORE INSERT 트리거로 작성자 신원을 서버(DB)가 강제한다.
--   • 비로그인(auth.uid() 없음): name 을 '익명' 으로 고정 → 사칭 불가.
--   • 로그인 회원: name 을 profiles.display_name 으로 고정 → 클라이언트가 보낸 임의 이름 무시.
--   (직원은 Supabase 세션이 없어 anon 으로 동작 → 댓글 시 '익명'. 직원 발언은 기사/공식 경로로.)
--
-- 남은 과제(별도): 익명 댓글/건의 '대량 스팸'은 IP 레이트리밋/캡차가 필요(앱 계층). 본 트리거는 사칭만 차단.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. (재실행 안전)

create or replace function public.enforce_comment_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
