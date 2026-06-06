// 스태프 인증 DB 연동 검증 (마이그레이션 + 시드 완료 후 실행).
//   node --env-file=.env scripts/verify-staff-auth.mjs
// 필요한 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   (특정 계정 비밀번호 검증까지 하려면 VERIFY_USER, VERIFY_PW 도)

import { createClient } from '@supabase/supabase-js';
import { verifyPassword } from '../lib/password.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }

const svc = createClient(url, key, { auth: { persistSession: false } });
let fail = 0;
const ok = (m) => console.log('✅', m);
const bad = (m) => { console.error('❌', m); fail++; };

// 1) staff_users 테이블 + 데이터
const { data: staff, error: e1 } = await svc.from('staff_users').select('id, role, password_hash');
if (e1) bad(`staff_users 조회 실패: ${e1.message}`);
else {
  ok(`staff_users 접근 OK — ${staff.length}개 계정 (${staff.map(s => s.id).join(', ') || '비어있음'})`);
  const plain = staff.filter(s => !String(s.password_hash || '').startsWith('scrypt:'));
  if (plain.length) bad(`해시 형식이 아닌 계정: ${plain.map(s => s.id).join(', ')}`);
  else if (staff.length) ok('모든 비밀번호가 scrypt 해시로 저장됨 (평문 없음)');
}

// 2) login_attempts 테이블
const { error: e2 } = await svc.from('login_attempts').select('ip').limit(1);
if (e2) bad(`login_attempts 조회 실패: ${e2.message}`); else ok('login_attempts 접근 OK');

// 3) register_failed_login RPC (테스트 IP로 호출 후 정리)
const testIp = `__verify_${Date.now()}`;
const { data: c1, error: e3 } = await svc.rpc('register_failed_login', { p_ip: testIp, p_window_seconds: 900 });
if (e3) bad(`RPC register_failed_login 실패: ${e3.message}`);
else {
  const { data: c2 } = await svc.rpc('register_failed_login', { p_ip: testIp, p_window_seconds: 900 });
  if (c1 === 1 && c2 === 2) ok(`RPC 카운트 증가 정상 (${c1} → ${c2})`);
  else bad(`RPC 카운트 비정상 (${c1}, ${c2})`);
  await svc.from('login_attempts').delete().eq('ip', testIp);
  ok('테스트 레이트리밋 기록 정리 완료');
}

// 4) anon 키로는 해시가 노출되지 않아야 함 (RLS 확인)
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: leak } = await anon.from('staff_users').select('password_hash').limit(1);
  if (leak && leak.length) bad('⚠️ anon 키로 staff_users 가 읽힘 — RLS 점검 필요!');
  else ok('anon 키로 staff_users 접근 차단됨 (RLS 정상)');
} else console.log('ℹ️  ANON 키 미설정 — RLS 노출 테스트 생략');

// 5) (선택) 실제 비밀번호 검증
if (process.env.VERIFY_USER && process.env.VERIFY_PW) {
  const u = staff?.find(s => s.id === process.env.VERIFY_USER);
  if (!u) bad(`VERIFY_USER(${process.env.VERIFY_USER}) 계정 없음`);
  else if (verifyPassword(process.env.VERIFY_PW, u.password_hash)) ok(`비밀번호 검증 성공: ${u.id}`);
  else bad(`비밀번호 검증 실패: ${u.id}`);
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n🎉 모든 검증 통과');
process.exit(fail ? 1 : 0);
