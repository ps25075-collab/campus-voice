// 빌드 산출물(dist/)에 '서버 전용 시크릿'이 섞여 들어가지 않았는지 검사한다.
// 프론트 번들은 누구나 내려받아 열어볼 수 있으므로, service_role 키·평문 비밀번호·
// 메일/외부 API 시크릿이 한 글자라도 들어가면 즉시 빌드를 실패시켜 배포를 막는다.
//
// 허용: anon(공개) 키 — RLS로 보호되는 '공개 게시 키'라 프론트에 있어도 안전.
// 차단: role=service_role JWT, sb_secret_* 키, *_PW 평문 비밀번호, GMAIL/ECOS/CRON 시크릿 등.
//
// build 스크립트 마지막 단계로 실행된다(package.json). CI에서도 build가 돌면 함께 검사된다.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

// 1) dist 내 모든 텍스트 파일 수집
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(js|mjs|cjs|css|html|json|map|txt|webmanifest)$/i.test(name)) out.push(p);
  }
  return out;
}

// 2) base64url 디코드 헬퍼(JWT payload 검사용)
function decodeJwtPayload(seg) {
  try {
    const json = Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch { return null; }
}

const findings = [];

// 3) 단순 패턴 — 프론트에 절대 있으면 안 되는 시크릿 형태
const PATTERNS = [
  { re: /sb_secret_[A-Za-z0-9_-]{8,}/g,            label: 'Supabase secret key (sb_secret_*)' },
  { re: /SUPABASE_SERVICE_ROLE_KEY/g,              label: 'service_role 환경변수명 노출' },
  { re: /GMAIL_APP_PASSWORD|GMAIL_USER/g,          label: 'Gmail 시크릿 환경변수명 노출' },
  { re: /\bCRON_SECRET\b|\bECOS_API_KEY\b|\bSTAFF_TOKEN_SECRET\b/g, label: '서버 전용 시크릿 환경변수명 노출' },
  { re: /CV_(Admin|Editor\d|Column\d)#?20\d\d/g,   label: '평문 스태프 비밀번호' },
];

let files;
try { files = walk(DIST); }
catch { console.error(`[check-bundle-secrets] '${DIST}' 디렉터리가 없습니다. 먼저 빌드하세요.`); process.exit(1); }

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  for (const { re, label } of PATTERNS) {
    const m = text.match(re);
    if (m) findings.push(`${file}: ${label} → ${m[0].slice(0, 24)}…`);
  }

  // 4) JWT(eyJ…​.eyJ…​.…) 를 찾아 payload.role 이 service_role 이면 차단. anon 은 허용.
  for (const tok of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    const payload = decodeJwtPayload(tok.split('.')[1]);
    if (payload && payload.role && payload.role !== 'anon') {
      findings.push(`${file}: 비-anon JWT 노출 (role=${payload.role})`);
    }
  }
}

if (findings.length) {
  console.error('\n❌ 번들에서 서버 전용 시크릿이 발견됐습니다 — 배포 중단:');
  for (const f of findings) console.error('   • ' + f);
  console.error('\n시크릿은 VITE_ 접두 없이 서버 전용 환경변수로만 두세요(프론트 번들 포함 금지).\n');
  process.exit(1);
}

console.log('✅ check-bundle-secrets: 번들에 서버 시크릿 없음(anon 공개 키만 확인됨).');
