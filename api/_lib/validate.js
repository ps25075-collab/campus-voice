// 의존성 없는 경량 입력 검증기 — API 경계에서 타입·형식·범위를 강제한다.
// 목적: 예기치 않은 타입/구조(객체·배열·연산자 등)가 쿼리 계층까지 흘러들지 않게 막아
//       NoSQL/PostgREST 필터 인젝션·타입 혼동을 차단한다. (zod의 최소 대체)
// 각 검증기는 { ok:true, value } 또는 { ok:false, error } 를 반환한다.

// 표시 왜곡·로그 오염·방향(BiDi)/제로폭 스푸핑에 악용되는 문자인지 코드포인트로 판정.
// (소스에 리터럴 제어문자를 두지 않으려고 숫자 비교로 구현 — 탭 \t, 줄바꿈 \n 은 허용.)
function isDisallowedChar(c) {
  if (c === 0x09 || c === 0x0A) return false;             // tab, newline 허용
  if (c <= 0x1f) return true;                             // C0 제어(\t\n 제외)
  if (c === 0x7f || (c >= 0x80 && c <= 0x9f)) return true; // DEL + C1 제어
  if ((c >= 0x200b && c <= 0x200d) || c === 0x2060 || c === 0xfeff) return true; // 제로폭
  if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return true; // BiDi 오버라이드/격리
  return false;
}

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

  // 사용자 생성 텍스트(댓글·답글·건의 본문) 정제 + 길이 검사 (우려 #4).
  //   str()과 달리, 표시 왜곡·로그 오염·동형이의(homoglyph)/방향 스푸핑에 악용되는
  //   제어문자·양방향(BiDi) 제어·제로폭 문자를 제거한 뒤 길이를 본다. (XSS는 렌더 시
  //   이스케이프로 차단되지만 이런 문자는 이스케이프돼도 무해하지 않으므로 입력 단계에서 제거.)
  //   탭(\t)·줄바꿈(\n)은 보존하고 CR/CRLF는 \n으로 정규화한다.
  text(v, { min = 1, max = 2000, field = 'text' } = {}) {
    if (typeof v !== 'string') return { ok: false, error: `${field}: 문자열이어야 합니다.` };
    const normalized = v.normalize('NFC').replace(/\r\n?/g, '\n');
    let out = '';
    for (const ch of normalized) {
      if (!isDisallowedChar(ch.codePointAt(0))) out += ch;
    }
    const s = out.trim();
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
