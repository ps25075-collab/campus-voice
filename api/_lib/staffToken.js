// 스태프(자체 로그인) 서버 인증용 서명 토큰.
// Supabase 세션이 없는 스태프(admin)의 권한을 서버 API에서 검증하기 위함.
// HMAC-SHA256 서명 + 만료시간. 비밀키는 STAFF_TOKEN_SECRET(서버 환경변수).
//
// 키 위생(우려 #8): 이 비밀키가 약하거나 새면 관리자 토큰을 위조할 수 있다. 그래서
//  - 발급은 항상 현재 키(STAFF_TOKEN_SECRET)로 서명한다.
//  - 검증은 현재 키 + 과거 키(STAFF_TOKEN_SECRET_PREVIOUS, 쉼표구분 다중 허용)로 한다.
//    → 무중단 로테이션: PREVIOUS=<옛키> 두고 SECRET=<새키>로 교체·배포하면, 이미 발급된
//      토큰(옛키 서명)은 만료(12h)까지 유효하고 신규 토큰만 새키로 서명된다. 12h 뒤
//      PREVIOUS를 지우면 옛키 완전 폐기 → 사용자 강제 로그아웃 없이 키 교체 완료.
import crypto from 'crypto';
import { readCookie, STAFF_COOKIE } from './cookies.js';

const SECRET = process.env.STAFF_TOKEN_SECRET;
// 과거 키 목록(검증 전용). 로테이션 기간에만 설정한다.
const PREVIOUS_SECRETS = (process.env.STAFF_TOKEN_SECRET_PREVIOUS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const MIN_SECRET_LEN = 32; // 권장: 32바이트+ 무작위 (예: openssl rand -base64 48)
const TTL_MS = 12 * 60 * 60 * 1000; // 12시간

const b64url = (s) => Buffer.from(s).toString('base64url');

// 비밀키 강도 경고 목록(부팅 시 1회 로깅 + 검증 스크립트에서 게이트로 사용).
export function staffSecretWarnings() {
  const w = [];
  if (!SECRET) w.push('STAFF_TOKEN_SECRET 미설정 — 스태프 토큰 발급 불가');
  else if (SECRET.length < MIN_SECRET_LEN)
    w.push(`STAFF_TOKEN_SECRET이 너무 짧음(${SECRET.length}자 < ${MIN_SECRET_LEN}) — 32바이트+ 무작위 권장(위조 위험)`);
  return w;
}
// 콜드스타트 시 1회 경고(약한 키 조기 발견). 운영 토큰 발급은 막지 않는다.
for (const msg of staffSecretWarnings()) console.warn('[staffToken] ⚠️', msg);

export function signStaffToken({ id, role, name }) {
  if (!SECRET) throw new Error('STAFF_TOKEN_SECRET not set');
  const body = { id, role, name, exp: Date.now() + TTL_MS };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// 주어진 키로 서명이 일치하는지 상수시간 비교.
function sigMatches(data, sig, key) {
  const expected = crypto.createHmac('sha256', key).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyStaffToken(token) {
  if (!token || typeof token !== 'string') return null;
  const keys = [SECRET, ...PREVIOUS_SECRETS].filter(Boolean);
  if (!keys.length) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  // 현재 키 → 과거 키 순으로 서명 검증(로테이션 기간 호환). 어느 키와도 안 맞으면 거부.
  if (!keys.some((k) => sigMatches(data, sig, k))) return null;
  let body;
  try { body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!body.exp || Date.now() > body.exp) return null;
  return body; // { id, role, name, exp }
}

// 스태프 토큰 추출: HttpOnly 쿠키(cv_staff) 우선, 없으면 Authorization: Bearer 폴백.
// 쿠키 우선이 정책. 헤더 폴백은 비브라우저 도구/하위호환용이며, 토큰이 더는 JS로 읽히지
// 않으므로(쿠키가 HttpOnly) XSS가 헤더에 실어 보낼 토큰을 구할 수 없다 → 보안 약화 없음.
export function staffTokenFromReq(req) {
  const cookie = readCookie(req, STAFF_COOKIE);
  if (cookie) return cookie;
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// 요청의 스태프 토큰을 검증하고, roles가 주어지면 역할까지 확인. 통과 시 claims 반환, 아니면 null.
export function requireStaff(req, roles) {
  const claims = verifyStaffToken(staffTokenFromReq(req));
  if (!claims) return null;
  if (roles && roles.length && !roles.includes(claims.role)) return null;
  return claims;
}
