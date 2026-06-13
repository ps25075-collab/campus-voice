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

// 4) 빌드 env에 실제 서버 시크릿 값이 있으면, 그 '값'이 번들에 박혔는지까지 검사(가장 강력).
//    Vercel 빌드에는 서버 환경변수가 주입되므로, VITE_ 접두 오용·실수 하드코딩으로 값이
//    번들에 새는 경우를 직접 잡는다. (CI엔 시크릿이 없어 자동 스킵 — 길이≥12 값만 대상)
const SECRET_VALUE_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY', 'STAFF_TOKEN_SECRET', 'STAFF_TOKEN_SECRET_PREVIOUS',
  'GMAIL_APP_PASSWORD', 'CRON_SECRET', 'ECOS_API_KEY', 'ADMIN_PW',
];
const secretValues = SECRET_VALUE_VARS
  .flatMap((name) => (process.env[name] || '').split(',').map((v) => [name, v.trim()]))
  .filter(([, v]) => v && v.length >= 12);

// 5) VITE_ 접두 환경변수에 서버 시크릿 값이 들어갔는지(클라 번들로 새는 직접 원인) 검사 —
//    빌드 전에 env만으로 판정 가능. service_role JWT가 VITE_로 노출되는 경우도 차단.
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith('VITE_') || !v) continue;
  for (const [name, secret] of secretValues) {
    if (v === secret) findings.push(`env ${k}: 서버 시크릿(${name}) 값이 VITE_ 변수에 설정됨 → 번들 노출`);
  }
  const seg = (v.match(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\./) || [])[1];
  const payload = seg ? decodeJwtPayload(seg) : null;
  if (payload && payload.role && payload.role !== 'anon')
    findings.push(`env ${k}: 비-anon JWT(role=${payload.role})가 VITE_ 변수에 설정됨 → 번들 노출`);
}

let files;
try { files = walk(DIST); }
catch { console.error(`[check-bundle-secrets] '${DIST}' 디렉터리가 없습니다. 먼저 빌드하세요.`); process.exit(1); }

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  for (const { re, label } of PATTERNS) {
    const m = text.match(re);
    if (m) findings.push(`${file}: ${label} → ${m[0].slice(0, 24)}…`);
  }

  // 6) 서버 시크릿의 '실제 값'이 번들 텍스트에 그대로 들어있는지(이름이 아니라 값) 검사.
  for (const [name, secret] of secretValues) {
    if (text.includes(secret)) findings.push(`${file}: 서버 시크릿 값 노출(${name})`);
  }

  // 7) JWT(eyJ…​.eyJ…​.…) 를 찾아 payload.role 이 service_role 이면 차단. anon 은 허용.
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
