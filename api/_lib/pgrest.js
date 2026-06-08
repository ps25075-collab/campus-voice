// PostgREST 필터 문자열(.or() / .filter())에 값을 안전하게 끼워넣기 위한 헬퍼.
//
// 배경: Supabase 빌더의 .eq()/.in()/.match() 등은 값을 '파라미터'로 인코딩하므로 안전하다.
//       그러나 .or()/.filter()는 'col.op.value,col.op.value' 형태의 '원시 필터 문자열'을
//       받기 때문에, 사용자 입력에 쉼표·괄호·따옴표·점이 섞이면 필터 논리를 바꿔
//       다른 행을 노출시키거나 쿼리를 깨뜨릴 수 있다(필터 인젝션).
//
// 대응: .or() 안에 들어갈 값은 반드시 이 화이트리스트를 통과한 '단순 토큰'만 허용한다.
//       (정수 id, uuid, 로그인 id, 'staff:'/'anon:' 접두 키 등을 모두 커버)
//       위험 문자가 있으면 예외를 던져 즉시 차단한다.

const SAFE_TOKEN = /^[A-Za-z0-9_:-]{1,128}$/;

export function pgValue(v) {
  const s = String(v);
  if (!SAFE_TOKEN.test(s)) throw new Error('unsafe filter value');
  return s;
}
