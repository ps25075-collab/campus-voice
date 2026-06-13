// 스태프(자체 로그인) 서버 인증용 서명 토큰.
// Supabase 세션이 없는 스태프(admin/editor)의 권한을 서버 API에서 검증하기 위함.
// HMAC-SHA256 서명 + 만료시간. 비밀키는 STAFF_TOKEN_SECRET(서버 환경변수).
import crypto from 'crypto';
import { readCookie, STAFF_COOKIE } from './cookies.js';

const SECRET = process.env.STAFF_TOKEN_SECRET;
const TTL_MS = 12 * 60 * 60 * 1000; // 12시간

const b64url = (s) => Buffer.from(s).toString('base64url');

export function signStaffToken({ id, role, name }) {
  if (!SECRET) throw new Error('STAFF_TOKEN_SECRET not set');
  const body = { id, role, name, exp: Date.now() + TTL_MS };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyStaffToken(token) {
  if (!SECRET || !token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
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
