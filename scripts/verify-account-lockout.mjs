// 계정 단위 무차별 대입 방어(우려 #3) DB 연동 검증 — 마이그레이션 적용 후 실행.
//   node --env-file=.env scripts/verify-account-lockout.mjs
// 필요한 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// 합성 테스트 계정으로 register_failed_account_login RPC를 호출해 카운트 증가·임계 잠금·
// just_locked 신호를 확인하고, 테스트 행을 정리한다(실데이터 미오염). anon 차단(RLS)도 점검.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }

const svc = createClient(url, key, { auth: { persistSession: false } });
let fail = 0;
const ok = (m) => console.log('✅', m);
const bad = (m) => { console.error('❌', m); fail++; };

const testAccount = `__verify_${Date.now()}`;
const MAX = 3;          // 테스트용 낮은 임계치
const WINDOW = 900;     // 15분
const LOCK = 1800;      // 30분

// 1) 테이블 접근(service_role)
const { error: e1 } = await svc.from('account_login_attempts').select('account').limit(1);
if (e1) bad(`account_login_attempts 조회 실패: ${e1.message} (마이그레이션 미적용?)`);
else ok('account_login_attempts 접근 OK (service_role)');

// 2) RPC 카운트 증가 + 임계 도달 시 잠금
let lastRow = null;
for (let i = 1; i <= MAX; i++) {
  const { data, error } = await svc.rpc('register_failed_account_login', {
    p_account: testAccount, p_window_seconds: WINDOW, p_max_attempts: MAX, p_lock_seconds: LOCK,
  });
  if (error) { bad(`RPC 실패(${i}회차): ${error.message}`); break; }
  lastRow = Array.isArray(data) ? data[0] : data;
  const lockTag = lastRow?.just_locked ? ' ← just_locked!' : '';
  console.log(`   ${i}회차: count=${lastRow?.count} just_locked=${lastRow?.just_locked}${lockTag}`);
}
if (lastRow) {
  if (lastRow.count === MAX) ok(`카운트가 임계치까지 정확히 누적됨 (${MAX})`);
  else bad(`카운트 비정상: ${lastRow.count} (기대 ${MAX})`);
  if (lastRow.just_locked && lastRow.locked_until) ok(`임계 도달 시 잠금 설정됨 (해제예정: ${lastRow.locked_until})`);
  else bad('임계 도달했는데 잠금이 설정되지 않음');
}

// 3) 잠금 후 재호출은 just_locked=false (이중 잠금/경보 폭주 방지)
const { data: again } = await svc.rpc('register_failed_account_login', {
  p_account: testAccount, p_window_seconds: WINDOW, p_max_attempts: MAX, p_lock_seconds: LOCK,
});
const againRow = Array.isArray(again) ? again[0] : again;
if (againRow && againRow.just_locked === false) ok('이미 잠긴 계정 재시도는 just_locked=false (경보 1회만)');
else bad(`이미 잠긴 계정인데 just_locked=${againRow?.just_locked}`);

// 4) 잠금 상태 조회가 login.js 사전 점검과 동일하게 읽히는지
const { data: row } = await svc.from('account_login_attempts')
  .select('locked_until').eq('account', testAccount).maybeSingle();
const locked = row?.locked_until && new Date(row.locked_until).getTime() > Date.now();
if (locked) ok('locked_until 조회로 잠금 상태 확인 가능 (login.js 사전 점검 경로 OK)');
else bad('locked_until 조회로 잠금이 확인되지 않음');

// 5) 테스트 행 정리
const { error: eDel } = await svc.from('account_login_attempts').delete().eq('account', testAccount);
if (eDel) bad(`테스트 행 정리 실패: ${eDel.message}`); else ok('테스트 계정 기록 정리 완료');

// 6) anon 키로는 접근 차단되어야 함(RLS)
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: leak, error: eAnon } = await anon.from('account_login_attempts').select('account').limit(1);
  if (!eAnon && leak && leak.length) bad('⚠️ anon 키로 account_login_attempts 가 읽힘 — RLS 점검 필요!');
  else ok('anon 키로 account_login_attempts 접근 차단됨 (RLS 정상)');
} else console.log('ℹ️  ANON 키 미설정 — RLS 노출 테스트 생략');

console.log(fail ? `\n❌ ${fail}건 실패` : '\n🎉 모든 검증 통과');
process.exit(fail ? 1 : 0);
