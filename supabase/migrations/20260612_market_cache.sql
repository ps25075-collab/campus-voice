-- 주가/금융 지표 last-known-good 캐시.
-- 목적: 야후 비공식 API가 query1·query2 두 호스트 모두 실패하는 드문 경우에도
--       마지막 정상값을 제공해 패널에 '빈 칸'이 생기지 않게 한다.
-- 구조: 단일 행(id='latest') 키-값(JSONB). /api/finance가 service_role로만 읽고/쓴다.
-- 적용: Supabase 대시보드 → SQL Editor에 붙여넣고 Run. (재실행 안전)

create table if not exists public.market_cache (
  id          text        primary key default 'latest',
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- 클라이언트(anon/authenticated)는 이 테이블을 직접 만질 필요가 없다(전부 /api/finance 경유).
-- RLS 활성 + 권한 회수로 직접 접근을 차단한다. service_role(서버)은 RLS를 우회하므로 정책 불필요.
alter table public.market_cache enable row level security;
revoke all on public.market_cache from anon, authenticated;
