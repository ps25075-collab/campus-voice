import { getAdminClient } from '../lib/supabaseAdmin.js';
import { verifyPassword } from '../lib/password.js';
import { signStaffToken } from './_lib/staffToken.js';
import { generateCode, hashCode, verifyCode, sendOtpMail, CODE_TTL_MS, MAX_CODE_ATTEMPTS, RESEND_COOLDOWN_MS } from './_lib/emailOtp.js';
import { V } from './_lib/validate.js';
import { guardMutation } from './_lib/csrf.js';
import { setStaffCookie, clearStaffCookie } from './_lib/cookies.js';
import { sendAlert } from './_lib/alert.js';

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60; // 15분

// 계정(username) 단위 잠금 — 분산 IP로 한 계정을 노리는 무차별 대입 방어(우려 #3).
// IP 한도와 별개로, 같은 계정의 실패가 윈도우 내 ACCOUNT_MAX_ATTEMPTS 회 누적되면
// ACCOUNT_LOCK_SECONDS 동안 계정을 잠근다(비번이 맞아도 거부). IP 한도(10)보다 높게 둬
// 정상 사용자의 단순 오타보다는 분산 공격에서만 트립되도록 한다.
const ACCOUNT_MAX_ATTEMPTS = 15;
const ACCOUNT_LOCK_SECONDS = 30 * 60; // 30분

// 계정 실패를 원자적으로 누적하고, 임계 초과로 '새로' 잠겼으면 관리자에게 1회 경보.
// 존재하는 계정에 대해서만 호출(테이블 플러딩 방지). best-effort — 실패해도 로그인 흐름 불변.
async function registerAccountFailure(supabase, account, ip) {
  try {
    const { data } = await supabase.rpc('register_failed_account_login', {
      p_account: account,
      p_window_seconds: WINDOW_SECONDS,
      p_max_attempts: ACCOUNT_MAX_ATTEMPTS,
      p_lock_seconds: ACCOUNT_LOCK_SECONDS,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.just_locked) {
      await sendAlert(
        `계정 잠금: '${account}' 분산 무차별 대입 의심`,
        [
          `계정 '${account}' 의 로그인 실패가 ${WINDOW_SECONDS / 60}분 내 ${row.count}회 누적되어`,
          `${ACCOUNT_LOCK_SECONDS / 60}분간 잠금했습니다(해제 예정: ${row.locked_until}).`,
          `마지막 시도 IP: ${ip}`,
          ``,
          `여러 IP에서 한 계정을 노리는 무차별 대입일 수 있습니다. 본인 시도가 아니라면`,
          `비밀번호를 변경하고, 잠금은 시간이 지나면 자동 해제됩니다.`,
        ].join('\n')
      );
    }
  } catch (e) {
    console.error('[login] 계정 실패 카운트 기록 실패:', e?.message);
  }
}

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

  // 2b) 계정 단위 잠금 사전 점검(우려 #3): 분산 IP 무차별 대입으로 잠긴 계정은 비번이
  //   맞아도 거부한다. 존재하는 계정에 대해서만 기록되므로 user 가 있을 때만 조회한다.
  //   응답은 IP 한도와 동일한 일반 429 문구 → 계정 존재 여부 추가 노출 최소화.
  if (user) {
    const { data: acct } = await supabase
      .from('account_login_attempts')
      .select('locked_until')
      .eq('account', user.id)
      .maybeSingle();
    if (acct?.locked_until && new Date(acct.locked_until).getTime() > now) {
      return res.status(429).json({ error: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.' });
    }
  }

  // 3) 상수시간 비교. 사용자가 없어도 더미 해시로 검증해 타이밍 누출 방지.
  const ok = verifyPassword(password, user?.password_hash);

  if (!user || !ok) {
    // 실패 시 원자적으로 카운트 증가 (윈도우 만료 시 리셋 포함)
    await supabase.rpc('register_failed_login', {
      p_ip: ip,
      p_window_seconds: WINDOW_SECONDS,
    });
    // 계정 단위 카운터도 누적(존재 계정만) — 분산 IP 공격은 IP 카운터를 우회하므로.
    if (user) await registerAccountFailure(supabase, user.id, ip);
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
      // 코드 요청 단계 — 메일 중복 발송 방지(원자적 슬롯 선점).
      //
      // 과거 버그: "유효 코드 존재 && 쿨다운 이내" 를 메모리에서 읽기로 검사한 뒤 메일을
      //   보내고 그제서야 mfa_code_sent_at 을 기록했다. 같은 계정의 두 요청(더블클릭·클라이언트
      //   재시도·동시 서버리스 호출)이 거의 동시에 도착하면 둘 다 옛 상태를 읽어 쿨다운 검사를
      //   통과 → 메일이 항상 2통 발송됐다(읽기→발송→쓰기 사이의 경쟁 상태).
      //
      // 해결: 쿨다운 통과 여부를 단일 UPDATE 의 WHERE 로 옮긴다. Postgres 가 동시 UPDATE 를
      //   직렬화하고 두 번째 요청의 WHERE 를 '갱신된' 행 기준으로 재평가하므로, 슬롯을 선점한
      //   한 요청만 행을 갱신(=메일 발송)하고 나머지는 0행 → 발송하지 않는다.
      //   (쿨다운 60s < 코드 TTL 10m 이라 "최근 발송됨" 이면 항상 "유효 코드 존재" 이므로,
      //    mfa_code_sent_at 단일 조건으로 기존 의미를 그대로 보존한다.)
      const fresh = generateCode();
      const cutoff = new Date(now - RESEND_COOLDOWN_MS).toISOString();
      const { data: claimed } = await supabase
        .from('staff_users')
        .update({
          mfa_code_hash: hashCode(fresh),
          mfa_code_expires_at: new Date(now + CODE_TTL_MS).toISOString(),
          mfa_code_attempts: 0,
          mfa_code_sent_at: new Date(now).toISOString(),
        })
        .eq('id', user.id)
        .or(`mfa_code_sent_at.is.null,mfa_code_sent_at.lt.${cutoff}`)
        .select('id')
        .maybeSingle();

      // 다른 동시 요청이 이미 쿨다운 내에 발송(슬롯 선점)함 → 재발송 생략(메일 1통 유지).
      if (!claimed) {
        return res.status(401).json({ mfaRequired: true, mfaSent: true });
      }

      const sent = await sendOtpMail(user.mfa_email, fresh);
      if (!sent) {
        // 발송 실패(GMAIL 미설정 등) — 방금 선점한 슬롯을 비워 재요청이 쿨다운에 막히지
        //   않게 한다(best-effort). 미전달 코드를 남겨두지 않는다.
        await supabase.from('staff_users')
          .update({ mfa_code_hash: null, mfa_code_expires_at: null, mfa_code_sent_at: null })
          .eq('id', user.id);
        console.error('[login] MFA 메일 발송 실패(GMAIL 미설정?)');
        return res.status(500).json({ error: '인증 메일 발송에 실패했습니다. 관리자에게 문의하세요.' });
      }
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
      // OTP 오입력도 계정 단위로 누적 — 분산 IP의 코드 추측 공격 방어(우려 #3).
      await registerAccountFailure(supabase, user.id, ip);
      return res.status(401).json({ mfaRequired: true, error: '인증 코드가 올바르지 않습니다.' });
    }
    // 성공 — 일회용 코드 폐기(재사용 차단).
    await supabase.from('staff_users')
      .update({ mfa_code_hash: null, mfa_code_expires_at: null, mfa_code_attempts: 0 }).eq('id', user.id);
  }

  // 4) 성공 — 해당 IP의 시도 기록 + 계정 단위 실패/잠금 기록 제거
  await supabase.from('login_attempts').delete().eq('ip', ip);
  await supabase.from('account_login_attempts').delete().eq('account', user.id);

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
