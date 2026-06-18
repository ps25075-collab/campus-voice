// OTP 메일 중복 발송 수정 검증 (api/login.js 의 원자적 슬롯 선점).
//
// 목적: 같은 계정에 두 코드-요청이 '동시에' 도착해도 메일 발송 슬롯을 정확히 한 번만
//   선점하는지(=메일 1통)를 라이브 DB로 확인한다. login.js 와 동일한 조건부 UPDATE
//   (.eq(id) + .or(sent_at.is.null,sent_at.lt.cutoff))를 그대로 사용해 Promise.all 로
//   동시에 실행하고, 행을 반환받은(=발송했을) 요청이 정확히 1개인지 단언한다.
//
// 안전: 임시 테스트 계정(mfa-otp-verify-<rand>)을 만들어서만 검증하고 끝나면 삭제한다.
//   실제 스태프 계정/데이터는 건드리지 않으며, 메일은 실제로 보내지 않는다(슬롯 선점만 검증).
//
// 사용법: node --env-file=.env scripts/verify-mfa-otp-once.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const RESEND_COOLDOWN_MS = 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const id = `mfa-otp-verify-${crypto.randomBytes(4).toString('hex')}`;
let failed = false;
const ok = (m) => console.log('  ✅', m);
const bad = (m) => { failed = true; console.error('  ❌', m); };

// login.js 의 코드-요청 분기와 동일한 원자적 클레임 1회.
async function claimSend() {
  const now = Date.now();
  const cutoff = new Date(now - RESEND_COOLDOWN_MS).toISOString();
  const { data, error } = await supabase
    .from('staff_users')
    .update({
      mfa_code_hash: crypto.randomBytes(16).toString('hex'),
      mfa_code_expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      mfa_code_attempts: 0,
      mfa_code_sent_at: new Date(now).toISOString(),
    })
    .eq('id', id)
    .or(`mfa_code_sent_at.is.null,mfa_code_sent_at.lt.${cutoff}`)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data; // true = 슬롯 선점(메일 발송 대상)
}

try {
  // 0) 컬럼 존재 확인(라이브 마이그레이션 적용 여부)
  const probe = await supabase.from('staff_users')
    .select('id, mfa_email, mfa_code_hash, mfa_code_expires_at, mfa_code_attempts, mfa_code_sent_at')
    .limit(1);
  if (probe.error) { bad(`mfa_* 컬럼 조회 실패(마이그 미적용?): ${probe.error.message}`); throw new Error('schema'); }
  ok('staff_users.mfa_* 컬럼 존재(20260614_staff_mfa 적용됨)');

  // 1) 임시 계정 생성(쿨다운 통과 상태: sent_at = null)
  const ins = await supabase.from('staff_users').insert({
    id, name: 'OTP 검증용(임시)', role: 'reporter',
    password_hash: 'x', mfa_email: 'verify@example.com',
  }).select('id').maybeSingle();
  if (ins.error) { bad(`임시 계정 생성 실패: ${ins.error.message}`); throw new Error('insert'); }

  // 2) 동시 2요청 — 정확히 1건만 슬롯 선점해야 함(=메일 1통)
  const [a, b] = await Promise.all([claimSend(), claimSend()]);
  const wins = [a, b].filter(Boolean).length;
  if (wins === 1) ok(`동시 2요청 → 발송 1건 (메일 1통). 결과=[${a},${b}]`);
  else bad(`동시 2요청 → 발송 ${wins}건 (1이어야 함). 결과=[${a},${b}]`);

  // 3) 쿨다운 내 즉시 재요청은 차단되어야 함
  const c = await claimSend();
  if (!c) ok('쿨다운 내 재요청 → 발송 안 함(차단)');
  else bad('쿨다운 내 재요청이 또 발송됨');

  // 4) 쿨다운 경과 시엔 재발송 허용되어야 함(sent_at 을 과거로 밀어 시뮬레이션)
  await supabase.from('staff_users')
    .update({ mfa_code_sent_at: new Date(Date.now() - RESEND_COOLDOWN_MS - 5000).toISOString() })
    .eq('id', id);
  const d = await claimSend();
  if (d) ok('쿨다운 경과 후 재요청 → 발송 허용');
  else bad('쿨다운 경과 후에도 발송이 차단됨');
} catch (e) {
  if (!['schema', 'insert'].includes(e.message)) bad(`예외: ${e.message}`);
} finally {
  await supabase.from('staff_users').delete().eq('id', id);
  console.log(failed ? '\n❌ 검증 실패' : '\n✅ 전체 검증 통과: OTP 메일은 요청당 1통만 발송됩니다.');
  process.exit(failed ? 1 : 0);
}
