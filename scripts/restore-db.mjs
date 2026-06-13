// 백업 복구 + 복구 리허설(백업이 실제로 복원되는지 검증).
//
// 사용:
//   node scripts/restore-db.mjs <백업.json>            # (기본) 검증/리허설 — 쓰기 없음
//   node scripts/restore-db.mjs <백업.json> --apply     # 실제 복구(upsert) — 위험, 명시적 플래그 필요
//
// 기본(검증) 모드: 백업 파일 구조·행 유효성을 확인하고, 라이브 DB의 현재 행수와 대조해
//   "이 백업으로 복구가 가능한 상태인가"를 점검한다. 쓰기는 하지 않으므로 안전하게 정기 실행 가능.
//
// --apply 모드: 각 테이블에 onConflict=id 로 upsert 한다. staff_users 는 백업에
//   password_hash 가 없어(보안상 제외) 복구 대상에서 빼고, 계정은 seed-staff.mjs 로 재생성한다.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file || !existsSync(file)) {
  console.error('사용법: node scripts/restore-db.mjs <백업.json> [--apply]');
  process.exit(1);
}

// --apply 시 복구에서 제외(해시 없음 → seed-staff.mjs 로 재생성)
const SKIP_ON_APPLY = new Set(['staff_users']);

let payload;
try {
  payload = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error('[restore] 백업 JSON 파싱 실패:', e.message);
  process.exit(1);
}

// 1) 구조 검증(리허설의 핵심) — meta/data/행 배열이 정상인지.
if (!payload?.data || typeof payload.data !== 'object') {
  console.error('[restore] 잘못된 백업: data 객체 없음');
  process.exit(1);
}
let totalRows = 0;
for (const [table, rows] of Object.entries(payload.data)) {
  if (!Array.isArray(rows)) {
    console.error(`[restore] ${table}: 행이 배열이 아님 — 손상된 백업`);
    process.exit(1);
  }
  totalRows += rows.length;
}
console.log(`[restore] 백업 검증 OK — ${Object.keys(payload.data).length} tables, ${totalRows} rows, 생성시각 ${payload.meta?.created_at || '?'}`);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('[restore] DB 자격증명 없음 — 구조 검증만 수행하고 종료(파일 자체는 유효).');
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const svc = createClient(url, key, { auth: { persistSession: false } });

if (!apply) {
  // 리허설: 라이브 행수와 백업 행수를 대조(쓰기 없음).
  console.log('[restore] 리허설(읽기 전용) — 백업 vs 라이브 행수 대조:');
  for (const [table, rows] of Object.entries(payload.data)) {
    const { count, error } = await svc.from(table).select('*', { count: 'exact', head: true });
    const live = error ? 'ERR' : count;
    console.log(`  ${table}: backup=${rows.length} live=${live}${error ? ' (' + error.message + ')' : ''}`);
  }
  console.log('[restore] 리허설 완료. 실제 복구하려면 --apply 를 붙이세요.');
  process.exit(0);
}

// 실제 복구(upsert)
console.log('[restore] --apply: 복구 시작(upsert)…');
let restored = 0, errors = 0;
for (const [table, rows] of Object.entries(payload.data)) {
  if (SKIP_ON_APPLY.has(table)) {
    console.log(`  ${table}: 건너뜀(보안상 백업 제외 — seed-staff.mjs 로 재생성)`);
    continue;
  }
  if (!rows.length) { console.log(`  ${table}: 0 rows`); continue; }
  const { error } = await svc.from(table).upsert(rows, { onConflict: 'id' });
  if (error) { console.error(`  ${table}: 실패 — ${error.message}`); errors++; }
  else { console.log(`  ${table}: ${rows.length} rows 복구`); restored += rows.length; }
}
console.log(`[restore] 완료 — ${restored} rows 복구, ${errors} 테이블 실패`);
process.exit(errors ? 1 : 0);
