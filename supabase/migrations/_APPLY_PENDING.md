# ✅ 적용 완료 (2026-06-16) — 계정 단위 무차별 대입 방어 (우려 #3)

`supabase/migrations/20260616_account_lockout.sql` **적용 완료.** SQL Editor Run(`Success. No rows
returned`) 후 `node --env-file=.env scripts/verify-account-lockout.mjs` **모든 검증 통과**로 확인:
카운트 누적(1→2→3)·임계 도달 시 잠금(`just_locked`)·이미 잠긴 계정 재시도 경보 1회·`locked_until`
조회(login.js 사전 점검 경로)·anon RLS 차단·테스트 정리까지 정상.

## 무엇을 닫나
기존 레이트리밋은 IP 단위(`login_attempts.ip`)뿐이라, 공격자가 **IP를 분산**하면 한 계정을 노리는
무차별 대입을 우회할 수 있었다. 계정(username) 단위 실패 카운터(`account_login_attempts`)를 병행해,
윈도우(15분) 내 실패가 임계치(`ACCOUNT_MAX_ATTEMPTS`=15)를 넘으면 그 계정을 30분 잠그고(비번이
맞아도 거부), 잠금 발생 시 관리자에게 경보 메일을 1회 보낸다(`api/login.js` + `api/_lib/alert.js`).

## 무중단
- **적용 전에도 안 깨짐**: `login.js`는 테이블/함수가 없으면 조회는 조용히 실패(잠금 없이 통과),
  RPC 호출은 try/catch로 무시 → 기존 IP 레이트리밋 그대로 동작한다. 적용해야 계정 잠금이 활성.
- 카운터는 **존재하는 계정에 대해서만** 증가(임의 username 플러딩 방지). 잠금 응답은 IP 한도와
  동일한 일반 429 문구라 계정 존재 여부 추가 노출을 최소화.

## 재적용/재검증 방법 (필요 시)
1. Supabase 대시보드 → **SQL Editor** → `20260616_account_lockout.sql` 붙여넣고 **Run** (재실행 안전).
2. 로컬에서 DB 연동 검증:
   ```bash
   node --env-file=.env scripts/verify-account-lockout.mjs
   ```
   (합성 테스트 계정으로 카운트 증가·임계 잠금·정리까지 자동 확인. `🎉 모든 검증 통과` 떠야 함)
3. (선택) 경보 메일 수신 주소는 `ALERT_EMAIL`(없으면 `GMAIL_USER`).

---

# ✅ 적용 완료 (2026-06-16) — 관리자 2단계 인증: 이메일 OTP (우려 #1)

`supabase/migrations/20260614_staff_mfa.sql` **적용 완료.** (`setup-mfa.mjs`로 admin 수신 이메일
등록이 성공 → `mfa_email` 등 컬럼 존재 확인. admin 계정 이메일 OTP 2단계 인증 활성.)

> 방식 변경: 기존 TOTP(Authenticator 앱)에서 **이메일 OTP**로 전환했다. 로그인 시 스태프의
> 메일(보통 Gmail)로 6자리 일회용 코드를 보내고, 데스크탑 메일함에서 받아 입력한다.
> (모바일/앱 불필요 — 데스크탑만으로 2단계 유지)

## 무엇을 켜나
`staff_users` 에 `mfa_email`(+ `mfa_code_hash`/`mfa_code_expires_at`/`mfa_code_attempts`/`mfa_code_sent_at`)
컬럼을 추가해, `mfa_email` 이 설정된 계정은 로그인 2단계로 **메일로 받은 6자리 코드**를 추가
검증한다(`api/login.js` + `api/_lib/emailOtp.js`). 비밀번호가 새도 메일함 접근 없이는 로그인 불가.
코드는 평문이 아니라 HMAC-SHA256 해시로 저장되고, 10분 만료·코드당 5회 시도·재발송 쿨다운으로 보호된다.

## 무중단
- **코드는 적용 전에도 안 깨짐**: `login.js` 는 `select('*')` 라 컬럼이 없어도 동작하고,
  `mfa_email` 이 없으면(undefined) 2단계를 건너뛰어 기존 1단계 로그인 그대로다.
- 마이그 적용 후에도 `mfa_email` 이 null 인 동안은 1단계 유지. 등록해야 비로소 MFA 활성.

## 선행 조건
프로덕션(Vercel)에 **`GMAIL_USER` / `GMAIL_APP_PASSWORD`** 가 설정돼 있어야 코드 메일이 발송된다
(newsletter/subscribe 와 동일 키 — 이미 사용 중). 없으면 로그인 단계에서 500(메일 발송 실패)로 막힌다.

## 적용 순서
1. Supabase 대시보드 → **SQL Editor** → `20260614_staff_mfa.sql` 붙여넣고 **Run** (재실행 안전).
2. 로컬에서 관리자 이메일 OTP 등록(수신 이메일 지정):
   ```bash
   node --env-file=.env scripts/setup-mfa.mjs admin you@gmail.com
   ```
3. 로그아웃 후 다시 로그인 → 비밀번호 입력 → 지정한 메일로 **6자리 코드**가 오고, 입력하면
   통과되는지 확인. (해제: `node --env-file=.env scripts/setup-mfa.mjs admin --disable`)

---

# ✅ 적용 완료 (2026-06-14) — UGC 봇/스팸 방어 (우려 #2)

`supabase/migrations/20260613_ugc_antispam.sql` **적용 완료.** 라이브 DB 검증
(`npm run verify:security`, anon 키)에서 **11/11 통과**로 확인:

- ✅ `comments 직접 INSERT 차단(서버 경유 강제)`
- ✅ `suggestions 직접 INSERT 차단(서버 경유 강제)`

## 무엇을 닫았나
댓글·건의가 anon 키로 DB에 **직접 INSERT** 되던 경로를 막아 **서버(/api/comments) 경유를 강제**한다.
서버가 허니팟 + IP 레이트리밋 + 길이검증을 거쳐 service_role로 삽입하므로, 직접 경로를 막아야
레이트리밋 우회가 불가능해진다. (작성자 이름도 서버가 강제 → 사칭 차단)

## 재적용 방법 (필요 시)
Supabase 대시보드 → **SQL Editor** → `20260613_ugc_antispam.sql` 붙여넣고 **Run** (재실행 안전).

---

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
