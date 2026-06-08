-- Threat #1 강화: 관리자 권한 탈취 시 '데이터 영구 소실'을 막는 3종 세트.
--   1) articles 소프트 삭제(deleted_at/deleted_by) — DELETE를 '휴지통 이동'으로 전환.
--      공격자/실수로 삭제가 일어나도 행이 물리적으로 사라지지 않아 복구 가능.
--   2) RLS SELECT 정책에 'deleted_at is null' 추가 — 휴지통 글은 공개·회원에게 비노출.
--   3) audit_log — 관리자/스태프의 민감 작업(삭제/복구/영구삭제/권한변경 등) 감사 기록.
--      RLS 활성 + 정책 없음 => anon/authenticated 전면 차단, service_role(서버)만 접근.
-- 적용: supabase db push  (또는 대시보드 SQL Editor에 붙여넣고 Run)

-- ── 1) articles 소프트 삭제 컬럼 ─────────────────────────────────
alter table public.articles add column if not exists deleted_at timestamptz;
alter table public.articles add column if not exists deleted_by text;

-- 활성 기사 조회 최적화(부분 인덱스) — 목록 쿼리는 대부분 deleted_at is null.
create index if not exists articles_active_idx
  on public.articles (created_at desc)
  where deleted_at is null;

-- ── 2) RLS: 소프트 삭제된 행 비노출 ─────────────────────────────
-- 기존 정책(20260606_articles_confidentiality.sql)을 'deleted_at is null' 조건을 더해 대체.
drop policy if exists articles_select_published on public.articles;
create policy articles_select_published on public.articles
  for select to anon
  using (status = 'published' and deleted_at is null);

drop policy if exists articles_select_member on public.articles;
create policy articles_select_member on public.articles
  for select to authenticated
  using ((status = 'published' or author_id = auth.uid()::text) and deleted_at is null);

-- 참고: service_role(서버 API)은 RLS를 우회하므로 휴지통 조회/복구/영구삭제에 영향 없음.

-- ── 3) 감사 로그 ────────────────────────────────────────────────
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     text,                         -- 행위자(스태프 로그인 id 또는 회원 uid)
  actor_name   text,
  actor_role   text,
  action       text not null,                -- 예: article.delete, article.purge, member.role
  target_table text,
  target_id    text,
  detail       jsonb,                        -- 추가 맥락(제목, 변경 전후 값 등)
  ip           text,
  created_at   timestamptz not null default now()
);

alter table public.audit_log enable row level security;
-- 정책을 만들지 않음 => anon/authenticated 전면 차단, service_role 만 접근.
revoke all on public.audit_log from anon, authenticated;

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx  on public.audit_log (action, created_at desc);
