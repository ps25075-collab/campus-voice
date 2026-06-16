// 관리자 2단계 인증(이메일 OTP) — Authenticator 앱 없이 데스크탑 메일함으로 코드 수신 (우려 #1).
//
// 흐름: 비밀번호 통과 후, mfa_email 이 설정된 계정이면 6자리 일회용 코드를 생성해 그 주소
//   (스태프의 Gmail 등)로 발송한다. 사용자는 데스크탑 메일에서 코드를 확인해 입력한다.
//
// 저장: 평문 대신 HMAC-SHA256 해시만 DB에 둔다(STAFF_TOKEN_SECRET 키 사용). 키가 없으면
//   토큰 발급도 안 되는 상태이므로 고정 폴백 키로 해시(여전히 짧은 만료로 보호).
// 함수 수 영향 없음(_lib). 메일은 newsletter/subscribe/alert 와 동일한 GMAIL 환경변수 재사용.
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const CODE_TTL_MS = 10 * 60 * 1000;   // 코드 유효시간(10분)
export const MAX_CODE_ATTEMPTS = 5;          // 한 코드당 허용 오입력 횟수(무차별 대입 방어)
export const RESEND_COOLDOWN_MS = 60 * 1000; // 유효 코드 존재 중 재발송 최소 간격(메일폭탄 방지)

const HMAC_KEY = process.env.STAFF_TOKEN_SECRET || 'cv-email-otp-fallback';

// 균등 분포 6자리(앞자리 0 허용). Math.random 아닌 CSPRNG 사용.
export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(code) {
  return crypto.createHmac('sha256', HMAC_KEY).update(String(code)).digest('hex');
}

// 상수시간 비교 — 길이 다르면 즉시 false.
export function verifyCode(code, storedHash) {
  if (!storedHash) return false;
  const a = Buffer.from(hashCode(code), 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function mailer() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

// 메일 미설정이면 false(호출부에서 설정 오류로 처리 — 코드 없이 통과시키지 않음).
export async function sendOtpMail(to, code) {
  const t = mailer();
  if (!t) return false;
  await t.sendMail({
    from: `세계를 알리다 <${process.env.GMAIL_USER}>`,
    to,
    subject: `[세계를 알리다] 관리자 로그인 인증 코드 ${code}`,
    text: [
      `관리자 로그인 2단계 인증 코드입니다.`,
      ``,
      `    ${code}`,
      ``,
      `이 코드는 ${Math.round(CODE_TTL_MS / 60000)}분간 유효합니다.`,
      `본인이 로그인을 시도하지 않았다면 이 메일을 무시하고 비밀번호를 변경하세요.`,
    ].join('\n'),
  });
  return true;
}
