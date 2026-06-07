-- 보안 상태 검증(읽기 전용) — Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.
-- RLS 마이그레이션들이 실제로 적용됐는지 한눈에 확인하기 위한 진단 쿼리.
-- 데이터를 변경하지 않는다. 아래 [1] 체크리스트만 봐도 핵심 상태가 다 나온다.

-- ─────────────────────────────────────────────────────────────
-- [1] 핵심 체크리스트 (이 결과 한 개만 봐도 됨)
-- ─────────────────────────────────────────────────────────────
with checks as (
  -- (a) 각 테이블 RLS 활성화 여부
  select 1 as ord,
         'RLS 활성: '||c.relname as "검사 항목",
         case when c.relrowsecurity then '✅ ON' else '❌ OFF (위험)' end as "상태",
         '' as "상세"
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('articles','comments','profiles','subscribers','suggestions',
                      'staff_users','login_attempts','article_likes','bookmarks')

  union all
  -- (b) 테이블별 정책 개수 (0개면 정책 미생성 의심)
  select 2,
         '정책 수: '||p.tablename,
         '📋 '||count(*)||'개',
         string_agg(p.policyname, ', ')
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('articles','comments','profiles','subscribers')
  group by p.tablename

  union all
  -- (c) anon 에게 부여된 '컬럼 단위' UPDATE 권한 (articles=views,like_count / comments=likes 만 정상)
  select 3,
         'anon 컬럼 권한: '||g.table_name,
         '🔑',
         string_agg(g.privilege_type||'('||g.column_name||')', ', ' order by g.column_name)
  from information_schema.role_column_grants g
  where g.grantee = 'anon' and g.table_schema = 'public'
    and g.table_name in ('articles','comments')
  group by g.table_name

  union all
  -- (d) 스토리지 버킷 article-images 하드닝 (public + 용량/ MIME 제한)
  select 4,
         '스토리지 버킷 article-images',
         case when b.file_size_limit is not null and b.allowed_mime_types is not null
              then '✅ 제한 설정됨' else '⚠️ 제한 없음(미적용 의심)' end,
         'public='||coalesce(b.public::text,'?')||
         ' / size_limit='||coalesce(b.file_size_limit::text,'NULL')||
         ' / mime='||coalesce(array_to_string(b.allowed_mime_types, ','),'NULL')
  from storage.buckets b
  where b.id = 'article-images'
)
select "검사 항목", "상태", "상세"
from checks
order by ord, "검사 항목";

-- 기대값 요약:
--  • RLS 활성: articles / comments / profiles / staff_users 는 반드시 ✅ ON.
--             (article_likes / bookmarks 는 현재 ❌ OFF — 우려 #2, 별도 조치 권장)
--  • 정책 수: articles, comments, profiles 각각 1개 이상.
--  • anon 컬럼 권한: articles = UPDATE(views), UPDATE(like_count) 만.
--                   comments = UPDATE(likes) 만.  (그 외(title 등)가 보이면 위험)
--  • 스토리지 버킷: ✅ 제한 설정됨 (size_limit≈3145728, mime=image/*).

-- ─────────────────────────────────────────────────────────────
-- [2] (선택) 전체 정책 상세 — 누가/무엇을 할 수 있는지 일일이 확인
-- ─────────────────────────────────────────────────────────────
-- select schemaname, tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, cmd, policyname;

-- ─────────────────────────────────────────────────────────────
-- [3] (선택) staff_users 의 password_hash 가 anon 에 노출되지 않는지
--     아래가 0행이면 anon 에게 staff_users 컬럼 권한이 없음 = 안전
-- ─────────────────────────────────────────────────────────────
-- select grantee, privilege_type, column_name
-- from information_schema.role_column_grants
-- where table_schema='public' and table_name='staff_users' and grantee in ('anon','authenticated');
