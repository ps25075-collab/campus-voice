import { getAdminClient } from '../lib/supabaseAdmin.js';
import { verifyPassword } from '../lib/password.js';
import { signStaffToken } from './_lib/staffToken.js';
import { V } from './_lib/validate.js';

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60; // 15분

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

  // 2) 계정 조회 (비밀번호 해시는 service_role 로만 접근 가능 — anon 노출 차단)
  const { data: user } = await supabase
    .from('staff_users')
    .select('id, name, role, password_hash')
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

  // 4) 성공 — 해당 IP의 시도 기록 제거
  await supabase.from('login_attempts').delete().eq('ip', ip);

  // 서버 API 권한 검증용 서명 토큰 발급 (STAFF_TOKEN_SECRET 미설정 시 토큰 없이 반환 → 기존 동작 유지)
  let token;
  try { token = signStaffToken({ id: user.id, name: user.name, role: user.role }); }
  catch { token = undefined; }

  return res.status(200).json({ id: user.id, name: user.name, role: user.role, token });
}
