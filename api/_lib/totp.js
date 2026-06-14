// 관리자 2단계 인증(TOTP, RFC 6238) — Google Authenticator 등 호환.
//
// 우려 #1: 스태프 로그인이 ID+비밀번호 1단계라 피싱/크리덴셜 도용 한 번이면 관리자 장악.
//   → staff_users.totp_secret 에 비밀키를 두고, 로그인 2단계로 6자리 코드를 검증한다.
//
// 외부 의존성 없이 Node 내장 crypto 로 직접 구현(staffToken.js의 HMAC 직접 구현과 동일 방침).
// 비밀키는 service_role 로만 접근(staff_users는 anon RLS 차단) → 클라이언트로 새지 않는다.
import crypto from 'crypto';

// RFC 4648 base32 알파벳(패딩 없음) — Authenticator 앱 표준.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue; // 비-base32 문자는 무시
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

// HOTP(RFC 4226): 키 + 카운터 → 6자리 코드.
function hotp(keyBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', keyBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

// TOTP(RFC 6238): 현재 30초 스텝 기준 ±window 스텝 내에서 코드가 일치하면 true.
// 시계 오차 허용을 위해 기본 ±1 스텝(±30초). 상수시간 비교로 코드 누출 방지.
export function verifyTotp(secretBase32, token, { window = 1, step = 30 } = {}) {
  if (!secretBase32 || !/^\d{6}$/.test(String(token || ''))) return false;
  const key = base32Decode(secretBase32);
  if (!key.length) return false;
  const counter = Math.floor(Date.now() / 1000 / step);
  const b = Buffer.from(String(token));
  for (let i = -window; i <= window; i++) {
    const a = Buffer.from(hotp(key, counter + i));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

// 새 비밀키(160bit) → base32 문자열. 등록 스크립트에서 사용.
export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

// Authenticator 앱 등록용 otpauth:// URI.
export function otpauthUri({ secret, label, issuer }) {
  const l = encodeURIComponent(label), i = encodeURIComponent(issuer);
  return `otpauth://totp/${i}:${l}?secret=${secret}&issuer=${i}&algorithm=SHA1&digits=6&period=30`;
}
