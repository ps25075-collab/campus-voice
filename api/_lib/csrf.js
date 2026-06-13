// CSRF / 교차 출처 상태 변경 방어.
//
// 스태프 인증 토큰은 HttpOnly + SameSite=Strict 쿠키(cv_staff)에 담긴다(cookies.js 참고).
// 쿠키가 자동 전송되므로 CSRF를 막는 책임은 다음 2겹으로 나뉜다:
//  1) SameSite=Strict: 브라우저가 교차 사이트 요청에 쿠키를 아예 붙이지 않음(쿠키 계층 1차 차단).
//  2) enforceSameOrigin: 변경(POST/PUT/PATCH/DELETE) 요청의 Origin/Referer가 화이트리스트에
//     없으면 거부 → 서버 계층에서 교차 출처 변경을 차단(쿠키/헤더 인증 무관하게 동작).
// 회원(Supabase JWT)은 여전히 Authorization 헤더로 인증하므로 자동 전송되지 않는다.
//
// 추가로 applyCors는 와일드카드(*) 없이 '자신의 도메인'만 허용하고 preflight(OPTIONS)를 처리한다.

const PROD_ORIGIN = 'https://campus-voice-green-gamma.vercel.app';

// 화이트리스트 출처 목록(스킴+호스트[:포트]). 와일드카드는 절대 쓰지 않는다.
//  - SITE_URL: 운영 도메인(환경변수)
//  - VERCEL_URL: 이 배포 자신의 도메인(프리뷰 배포의 프런트=백엔드 동일 출처 허용)
//  - localhost: 개발용(vite dev server)
function buildAllowed() {
  const list = new Set([PROD_ORIGIN]);
  const fromEnv = (u) => {
    if (!u) return;
    try { list.add(new URL(u).origin); } catch { /* 무시 */ }
  };
  fromEnv(process.env.SITE_URL);
  if (process.env.VERCEL_URL) fromEnv(`https://${process.env.VERCEL_URL}`);
  // 개발 환경에서만 localhost 허용(운영에선 NODE_ENV=production)
  if (process.env.NODE_ENV !== 'production') {
    list.add('http://localhost:5173');
    list.add('http://localhost:3000');
    list.add('http://127.0.0.1:5173');
  }
  return list;
}

export const ALLOWED_ORIGINS = buildAllowed();

export function isAllowedOrigin(origin) {
  return !!origin && ALLOWED_ORIGINS.has(origin);
}

// Referer 헤더에서 출처(scheme+host)만 추출. 실패 시 null.
function originOfReferer(ref) {
  if (!ref) return null;
  try { return new URL(ref).origin; } catch { return null; }
}

// 변경 요청의 출처를 검증한다. 통과하면 true, 차단했으면(403 응답까지 전송) false.
//
// 정책: Origin(없으면 Referer)이 "존재하는데" 화이트리스트에 없으면 거부한다.
// 브라우저는 교차 사이트 POST에 항상 위조 불가능한 Origin을 붙이므로(공격자가 바꿀 수 없음)
// 이 검사만으로 CSRF가 막힌다. Origin/Referer가 둘 다 없는 경우(서버-서버·curl 등 비브라우저
// 호출 — CSRF 자체가 성립하지 않음)는 통과시켜 정상 자동화/cron이 깨지지 않게 한다.
export function enforceSameOrigin(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  const origin = req.headers.origin || originOfReferer(req.headers.referer || req.headers.referrer);
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ error: 'cross-origin request blocked' });
    return false;
  }
  return true;
}

// CORS 응답 헤더를 화이트리스트 기반으로 설정한다(와일드카드 금지).
// OPTIONS preflight를 직접 처리한 경우 true를 반환 → 호출부는 즉시 return 해야 한다.
export function applyCors(req, res, { methods = 'GET,POST,OPTIONS' } = {}) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    // 허용 출처면 204(preflight 성공), 아니면 ACAO 헤더가 없어 브라우저가 차단한다.
    res.status(204).end();
    return true;
  }
  return false;
}

// 변경 엔드포인트용 통합 가드: CORS 헤더 설정 + preflight 처리 + Origin 검증.
// 반환값 true = 호출부가 즉시 종료해야 함(preflight 응답했거나 403으로 차단함).
export function guardMutation(req, res, opts) {
  if (applyCors(req, res, opts)) return true;      // OPTIONS preflight 처리됨
  if (!enforceSameOrigin(req, res)) return true;   // 교차 출처 차단됨(403)
  return false;
}
