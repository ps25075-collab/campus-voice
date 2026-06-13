# ✅ 적용 완료 (2026-06-13) — 기록용

이 프로젝트의 RLS/권한은 **Supabase SQL Editor에서 사람이 직접 Run** 해야 적용됩니다(자동 배포 아님).
2026-06-13 보안 점검에서 아래 3개가 미적용으로 확인돼 적용했고, `npm run verify:security` **9/9 통과**로 검증 완료.
(아래는 당시 닫은 구멍과 절차 기록. 향후 같은 종류의 드리프트가 생기면 이 절차를 반복.)

## 당시 열려 있던 구멍 (적용으로 닫음)

| 구멍 | 영향 | 닫는 SQL |
|---|---|---|
| `article_likes`·`bookmarks` RLS 꺼짐 | anon이 회원 auth-UUID 열람·좋아요/북마크 위조 | `20260607_likes_bookmarks_rls.sql` (이미 존재, **미적용**) |
| 카운터 임의값 변조 | anon이 views/like_count/댓글 likes를 천만·음수로 덮어쓰기 | `20260613_counter_rpcs.sql` (신규) |
| 댓글 작성자 사칭 | anon이 name에 '편집장' 등 입력해 사칭 | `20260613_comment_identity.sql` (신규) |

## 적용 방법 (순서대로)

Supabase 대시보드 → **SQL Editor** → 각 파일 내용을 붙여넣고 **Run**:

1. `supabase/migrations/20260607_likes_bookmarks_rls.sql`
2. `supabase/migrations/20260613_counter_rpcs.sql`
3. `supabase/migrations/20260613_comment_identity.sql`

모두 **재실행 안전**(`drop ... if exists` / `create or replace`)이라 여러 번 실행해도 됩니다.

## 적용 후 검증 (필수)

로컬에서:

```bash
npm run verify:security
```

`.env`에 `SUPABASE_URL`·`SUPABASE_ANON_KEY`가 있으면 anon 키로 라이브 DB를 두드려
**닫혀야 할 모든 경로가 닫혔는지** 확인하고, 하나라도 열려 있으면 실패(exit 1)합니다.
모두 통과하면 `모든 보안 점검 통과 ✅`.

GitHub Actions의 `security-verify` 워크플로(매일 + 수동 실행)도 같은 점검을 하므로,
저장소 secrets에 `SUPABASE_URL`·`SUPABASE_ANON_KEY`를 넣어두면 향후 드리프트를 자동 감시합니다.

## 참고: 적용 안 해도 코드는 안 깨짐
클라이언트(App.jsx)의 카운터 갱신은 **RPC 우선 + 직접갱신 폴백** 구조라, 위 SQL 적용 전에도 동작합니다.
적용 후에는 직접갱신 권한이 회수되어 RPC 경로(+1/-1)만 남아 변조가 차단됩니다.
