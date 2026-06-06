-- Stage 2h: 구독 double opt-in — 무제한 등록/제3자 메일폭탄 차단.
-- 문제: /api/subscribe에 rate limit·봇차단·확인절차가 없어 임의 이메일을 대량 등록할 수 있고,
--       등록 즉시 뉴스레터 발송 대상이 되어 타인 주소로 메일폭탄을 보낼 수 있었다.
-- 방침: 이메일 확인(double opt-in). 확인(confirmed=true)된 주소에만 뉴스레터 발송.
--       (rate limit·허니팟은 api/subscribe.js 서버에서 처리)
-- 적용: Supabase 대시보드 → SQL Editor → Run.

alter table public.subscribers add column if not exists confirmed       boolean      not null default false;
alter table public.subscribers add column if not exists confirm_token   text;
alter table public.subscribers add column if not exists confirm_sent_at timestamptz;

-- 기존 구독자는 이미 동의한 것으로 간주(소급 확인) → 마이그레이션으로 발송 누락 방지.
-- (이 시점엔 아직 미확인 신규 행이 없으므로 전체를 confirmed 처리)
update public.subscribers set confirmed = true where confirmed = false;

-- 토큰 조회용 인덱스(확인 엔드포인트 성능)
create index if not exists subscribers_confirm_token_idx on public.subscribers (confirm_token);
