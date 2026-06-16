-- 우려 #4: 댓글·건의 본문 형식(제어문자) 서버/DB 강제 — 인젝션/표시 왜곡 완화.
--
-- 현황: 길이 제한은 이미 양쪽에 있다(서버 V.str max=2000, DB comments_len_chk/suggestions_len_chk).
--   그러나 본문 안의 '제어문자'(널바이트·BEL·DEL·C1 등)는 서버·DB 어디서도 거르지 않아,
--   초대형은 아니어도 로그 오염·표시 왜곡·동형이의 스푸핑에 악용될 여지가 있었다.
-- 방침(2층 방어):
--   1) 앱: api/_lib/validate.js 의 V.text() 가 제어문자·BiDi·제로폭 문자를 제거 후 길이 검사.
--      (api/comments.js 의 댓글 text / 건의 content 가 V.text 사용)
--   2) DB(이 파일): 직접 경로/우회 대비 방어적으로, text/content 에 제어문자 금지 CHECK 추가.
--      허용: 탭(\x09)·줄바꿈(\x0A)·복귀(\x0D). 금지: 그 외 C0(\x00-\x1F)·DEL(\x7F).
--   (XSS 자체는 렌더 시 이스케이프로 이미 차단됨 — 여기서는 형식/제어문자만 다룬다.)
--
-- 적용: Supabase 대시보드 → SQL Editor → Run. (재실행 안전: 기존 행 정제 후 제약을 멱등 추가)

-- 금지 문자 집합(정규식, 탭/줄바꿈/복귀 제외): \x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F
--   E'' 문자열에서 백슬래시를 이중화해 정규식 엔진에 \x.. 로 전달(문자열 단계에서 바이트로
--   해석되지 않도록 — E'\xHH' 직접 사용 금지).

-- 1) 기존 행 정제(있으면) — 이후 CHECK 추가가 위반으로 실패하지 않도록 선제 제거.
update public.comments
   set text = regexp_replace(text, E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g')
 where text ~ E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]';

update public.suggestions
   set content = regexp_replace(content, E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g')
 where content ~ E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]';

-- 2) 제어문자 금지 CHECK(멱등) ----------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comments_text_ctrl_chk') then
    alter table public.comments
      add constraint comments_text_ctrl_chk
      check (text !~ E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suggestions_content_ctrl_chk') then
    alter table public.suggestions
      add constraint suggestions_content_ctrl_chk
      check (content !~ E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]');
  end if;
end $$;
