// 스태프 인증 토큰을 담는 HttpOnly 쿠키 처리.
//
// 토큰을 localStorage가 아니라 HttpOnly 쿠키에 두는 이유:
//  - HttpOnly 쿠키는 JS(document.cookie)로 읽을 수 없어, XSS가 발생해도 토큰을 탈취하지 못한다.
//  - Secure(운영)로 HTTPS에서만 전송되고, SameSite=Strict로 교차 사이트 요청엔 아예 첨부되지 않아
//    CSRF의 1차 차단막이 된다(2차는 csrf.js의 enforceSameOrigin Origin 화이트리스트).
//
// 회원(Supabase 세션 JWT)은 기존대로 Authorization 헤더를 쓰고, 이 쿠키는 스태프 전용이다.

export const STAFF_COOKIE = 'cv_staff';
const TTL_SECONDS = 12 * 60 * 60; // 12시간 — staffToken TTL과 일치

// 요청 Cookie 헤더에서 특정 쿠키 값을 추출. 없으면 null.
export function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header || typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); }
      catch { return part.slice(eq + 1).trim(); }
    }
  }
  return null;
}

// 기존 Set-Cookie를 보존하면서 새 쿠키를 덧붙인다(헤더가 1개여도 안전).
function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', cookie);
  else res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, cookie] : [prev, cookie]);
}

function baseAttrs() {
  // 운영(HTTPS)에서만 Secure. 로컬 dev(http)에선 Secure가 붙으면 브라우저가 쿠키를 저장하지 않으므로 생략.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export function setStaffCookie(res, token) {
  appendSetCookie(res, `${STAFF_COOKIE}=${encodeURIComponent(token)}; Max-Age=${TTL_SECONDS}; ${baseAttrs()}`);
}

export function clearStaffCookie(res) {
  appendSetCookie(res, `${STAFF_COOKIE}=; Max-Age=0; ${baseAttrs()}`);
}
