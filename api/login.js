import { getAdminClient } from '../lib/supabaseAdmin.js';
import { verifyPassword } from '../lib/password.js';
import { signStaffToken } from './_lib/staffToken.js';
import { generateCode, hashCode, verifyCode, sendOtpMail, CODE_TTL_MS, MAX_CODE_ATTEMPTS, RESEND_COOLDOWN_MS } from './_lib/emailOtp.js';
import { V } from './_lib/validate.js';
import { guardMutation } from './_lib/csrf.js';
import { setStaffCookie, clearStaffCookie } from './_lib/cookies.js';

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60; // 15분

export default async function handler(req, res) {
  if (guardMutation(req, res)) return; // CSRF: preflight 처리 + 교차 출처 차단
  if (req.method !== 'POST') return res.status(405).end();

  // 로그아웃: HttpOnly 스태프 쿠키는 JS로 못 지우므로 서버가 만료시킨다.
  // (별도 함수를 추가하지 않고 login 엔드포인트에 통합 — Vercel 무료 함수 개수 한도 보호)
  if ((req.body || {}).action === 'logout') {
    clearStaffCookie(res);
    return res.status(200).json({ ok: true });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (err) {
    console.error('[login] supabase init 실패:', err.message);
    return res.status(500).json({ error: '서버 설정 오류' });
  }

  // 1) 레이트리밋 사전 점검 (영속 저장소 — 서버리스 인스턴스 간 공유)
  const { data: rl } = await supabase
    .from('login_attempts')
    .select('count, reset_at')
    .eq('ip', ip)
    .maybeSingle();

  const now = Date.now();
  const windowActive = rl?.reset_at && new Date(rl.reset_at).getTime() > now;
  const currentCount = windowActive ? rl.count : 0;
  if (currentCount >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.' });
  }

  // 타입·형식 강제: 문자열이 아니면(객체/배열/연산자 주입 시도) 즉시 거부 → 쿼리 계층 보호.
  const uv = V.str((req.body || {}).username, { min: 1, max: 64, field: 'username' });
  const pv = V.str((req.body || {}).password, { min: 1, max: 200, trim: false, field: 'password' });
  if (!uv.ok || !pv.ok) return res.status(400).json({ error: 'invalid' });
  const username = uv.value, password = pv.value;

  // 2) 계정 조회 (비밀번호 해시·MFA 컬럼은 service_role 로만 접근 — anon 노출 차단)
  //   select('*') 인 이유: mfa_* 컬럼 마이그레이션(20260614_staff_mfa.sql)이 아직
  //   적용되지 않은 DB에서도 깨지지 않도록 — 컬럼이 없으면 user.mfa_email 이 undefined 라
  //   2단계 검증이 자동으로 건너뛰어진다(무중단). 컬럼이 있으면 값이 포함돼 MFA가 켜진다.
  //   (응답으로 내보내는 건 아래에서 id/name/role 뿐 — 해시·코드는 서버에만 머무름)
  const { data: user } = await supabase
    .from('staff_users')
    .select('*')
    .eq('id', username)
    .maybeSingle();

  // 3) 상수시간 비교. 사용자가 없어도 더미 해시로 검증해 타이밍 누출 방지.
  const ok = verifyPassword(password, user?.password_hash);

  if (!user || !ok) {
    // 실패 시 원자적으로 카운트 증가 (윈도우 만료 시 리셋 포함)
    await supabase.rpc('register_failed_login', {
      p_ip: ip,
      p_window_seconds: WINDOW_SECONDS,
    });
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  // 3b) 2단계 인증(우려 #1): mfa_email 이 설정된 계정은 메일로 받은 6자리 코드까지 맞아야 통과.
  //   • 코드 미입력 → 일회용 코드를 생성·메일 발송하고 mfaRequired 응답(쿠키 미발급).
  //       클라이언트가 2단계 입력칸을 띄운다. 유효 코드가 살아있고 쿨다운 내면 재발송 생략(메일폭탄 방지).
  //   • 코드 입력 → 만료·시도횟수·해시 일치를 검증. 불일치는 코드별/IP 실패 카운트 증가 후 거부.
  //   • mfa_email 이 null(미등록)이면 기존 1단계 유지 → 등록 전에도 무중단.
  if (user.mfa_email) {
    const cv = V.str((req.body || {}).code, { min: 0, max: 6, field: 'code' });
    const code = cv.ok ? cv.value : '';

    if (!code) {
      // 코드 요청 단계: 유효한 코드가 이미 있고 쿨다운 이내면 재발송하지 않는다.
      const liveCode = user.mfa_code_hash
        && user.mfa_code_expires_at
        && new Date(user.mfa_code_expires_at).getTime() > now;
      const recentlySent = user.mfa_code_sent_at
        && (now - new Date(user.mfa_code_sent_at).getTime()) < RESEND_COOLDOWN_MS;
      if (liveCode && recentlySent) {
        return res.status(401).json({ mfaRequired: true, mfaSent: true });
      }
      const fresh = generateCode();
      const sent = await sendOtpMail(user.mfa_email, fresh);
      if (!sent) {
        console.error('[login] MFA 메일 발송 실패(GMAIL 미설정?)');
        return res.status(500).json({ error: '인증 메일 발송에 실패했습니다. 관리자에게 문의하세요.' });
      }
      await supabase.from('staff_users').update({
        mfa_code_hash: hashCode(fresh),
        mfa_code_expires_at: new Date(now + CODE_TTL_MS).toISOString(),
        mfa_code_attempts: 0,
        mfa_code_sent_at: new Date(now).toISOString(),
      }).eq('id', user.id);
      return res.status(401).json({ mfaRequired: true, mfaSent: true });
    }

    // 코드 검증 단계.
    const expired = !user.mfa_code_expires_at
      || new Date(user.mfa_code_expires_at).getTime() <= now;
    if (!user.mfa_code_hash || expired) {
      return res.status(401).json({ mfaRequired: true, error: '인증 코드가 만료되었습니다. 다시 요청해주세요.' });
    }
    if ((user.mfa_code_attempts || 0) >= MAX_CODE_ATTEMPTS) {
      // 한 코드 무차별 대입 차단 — 코드를 폐기하고 재발송을 유도한다.
      await supabase.from('staff_users')
        .update({ mfa_code_hash: null, mfa_code_expires_at: null }).eq('id', user.id);
      return res.status(401).json({ mfaRequired: true, error: '시도 횟수를 초과했습니다. 코드를 다시 요청해주세요.' });
    }
    if (!verifyCode(code, user.mfa_code_hash)) {
      await supabase.from('staff_users')
        .update({ mfa_code_attempts: (user.mfa_code_attempts || 0) + 1 }).eq('id', user.id);
      await supabase.rpc('register_failed_login', {
        p_ip: ip,
        p_window_seconds: WINDOW_SECONDS,
      });
      return res.status(401).json({ mfaRequired: true, error: '인증 코드가 올바르지 않습니다.' });
    }
    // 성공 — 일회용 코드 폐기(재사용 차단).
    await supabase.from('staff_users')
      .update({ mfa_code_hash: null, mfa_code_expires_at: null, mfa_code_attempts: 0 }).eq('id', user.id);
  }

  // 4) 성공 — 해당 IP의 시도 기록 제거
  await supabase.from('login_attempts').delete().eq('ip', ip);

  // 서버 API 권한 검증용 서명 토큰 발급 후 HttpOnly 쿠키로 내려준다.
  // 토큰을 응답 본문/ localStorage에 두지 않아 XSS로도 탈취되지 않는다(쿠키는 JS 비가독).
  // STAFF_TOKEN_SECRET 미설정 시엔 토큰 없이 신원만 반환(기존 동작 유지).
  let exp;
  try {
    const token = signStaffToken({ id: user.id, name: user.name, role: user.role });
    setStaffCookie(res, token);
    exp = Date.now() + 12 * 60 * 60 * 1000; // 클라 UI가 만료를 알고 자동 로그아웃하도록(토큰 아님)
  } catch { /* 토큰 미발급 — 쿠키 없이 진행 */ }

  return res.status(200).json({ id: user.id, name: user.name, role: user.role, exp });
}
