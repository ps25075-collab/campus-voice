// Supabase 핵심 테이블 논리 백업 — 침해/실수로 인한 영구 소실에 대비한 정기 백업.
//
// 사용:
//   node scripts/backup-db.mjs [--out <파일경로>]
// 환경변수(둘 중 하나):
//   - CI: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (GitHub Actions secrets)
//   - 로컬: 루트 .env 에서 자동 로드
//
// 출력: { meta:{created_at, counts}, data:{table: rows[]} } 형태의 단일 JSON.
//   GitHub Actions가 이 파일을 '아티팩트'로 업로드 → 깃허브 인프라(오프사이트)에 보관.
//
// 보안: staff_users 는 password_hash 를 제외하고 백업한다(해시가 백업물로 새지 않게).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 로컬 실행 편의: .env 가 있으면 로드(CI에선 env가 이미 주입됨).
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('[backup] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

// 백업 대상 테이블과 컬럼 화이트리스트.
//  - '*' : 모든 컬럼
//  - 배열: 지정 컬럼만(민감 컬럼 제외용)
const TABLES = {
  articles: '*',
  comments: '*',
  subscribers: '*',
  profiles: '*',
  suggestions: '*',
  audit_log: '*',
  market_cache: '*',
  bookmarks: '*',
  article_likes: '*',
  staff_users: ['id', 'name', 'role', 'created_at', 'updated_at'], // password_hash 제외
};

const { createClient } = await import('@supabase/supabase-js');
const svc = createClient(url, key, { auth: { persistSession: false } });

const data = {};
const counts = {};
let failed = 0;

for (const [table, cols] of Object.entries(TABLES)) {
  const select = Array.isArray(cols) ? cols.join(',') : cols;
  const { data: rows, error } = await svc.from(table).select(select).range(0, 99999);
  if (error) {
    console.error(`[backup] ${table} 실패: ${error.message}`);
    failed++;
    continue;
  }
  data[table] = rows || [];
  counts[table] = data[table].length;
  console.log(`[backup] ${table}: ${counts[table]} rows`);
}

if (failed > 0 && Object.keys(data).length === 0) {
  console.error('[backup] 모든 테이블 백업 실패 — 중단');
  process.exit(1);
}

const payload = {
  meta: {
    created_at: new Date().toISOString(),
    source: url.replace(/^https?:\/\//, '').split('.')[0], // 프로젝트 ref만(전체 URL 노출 안 함)
    counts,
    table_failures: failed,
  },
  data,
};

// 출력 경로
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0 && process.argv[outArg + 1]
  ? process.argv[outArg + 1]
  : join(root, 'backups', `backup-${payload.meta.created_at.replace(/[:.]/g, '-')}.json`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`[backup] 완료 → ${outPath} (${Object.values(counts).reduce((a, b) => a + b, 0)} rows, ${Object.keys(counts).length} tables)`);
