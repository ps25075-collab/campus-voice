// 의존성 없는 경량 입력 검증기 — API 경계에서 타입·형식·범위를 강제한다.
// 목적: 예기치 않은 타입/구조(객체·배열·연산자 등)가 쿼리 계층까지 흘러들지 않게 막아
//       NoSQL/PostgREST 필터 인젝션·타입 혼동을 차단한다. (zod의 최소 대체)
// 각 검증기는 { ok:true, value } 또는 { ok:false, error } 를 반환한다.

export const V = {
  // 양의 정수 id (articles.id, comments.id, subscribers.id 등). 숫자 또는 '123' 문자열만 허용.
  intId(v) {
    const n = typeof v === 'number' ? v
      : (typeof v === 'string' && /^[0-9]+$/.test(v) ? Number(v) : NaN);
    if (!Number.isInteger(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER)
      return { ok: false, error: 'invalid id' };
    return { ok: true, value: n };
  },

  // UUID (profiles.id 등 회원 uid).
  uuid(v) {
    if (typeof v !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
      return { ok: false, error: 'invalid uuid' };
    return { ok: true, value: v };
  },

  // 문자열 — 반드시 string 타입이어야 하며(객체·배열 거부) 길이 범위를 검사.
  str(v, { min = 0, max = Infinity, trim = true, field = 'value' } = {}) {
    if (typeof v !== 'string') return { ok: false, error: `${field}: 문자열이어야 합니다.` };
    const s = trim ? v.trim() : v;
    if (s.length < min) return { ok: false, error: `${field}: 너무 짧습니다.` };
    if (s.length > max) return { ok: false, error: `${field}: 너무 깁니다.` };
    return { ok: true, value: s };
  },

  // 허용 목록(enum). 문자열 동등성만 — 객체/연산자 주입 차단.
  oneOf(v, allowed, field = 'value') {
    if (typeof v !== 'string' || !allowed.includes(v))
      return { ok: false, error: `invalid ${field}` };
    return { ok: true, value: v };
  },
};
