// 공개 페이지(홈·기사)를 크롤러가 읽을 수 있도록 서버에서 #root에 본문 HTML을
// 주입하기 위한 공용 헬퍼. 네이버(Yeti)·빙처럼 JS를 실행하지 않는 크롤러도
// 본문 텍스트를 보게 만드는 것이 목적이다.
//
// 주의: 사용자의 실제 화면은 여전히 React가 그린다. createRoot().render()가
// #root의 자식을 교체하므로, 여기서 주입한 내용은 React 마운트 직후 사라진다.
// (크롤러는 JS를 안 돌리므로 이 HTML을 그대로 본다.)

const BASE = 'https://campus-voice-green-gamma.vercel.app';

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function summarize(s, max = 180) {
  const clean = String(s || '').replace(/\{사진:[^}\n]*\}/g, '').replace(/\{\/?(작게|크게|아주크게)\}/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + '…';
}

// 인라인 마크다운(**굵게**, _기울임_, {크게}글자 크기{/크게})을 HTML로. 입력은 반드시 이스케이프된 문자열.
const FONT_SIZES = { 작게: '0.85em', 크게: '1.25em', 아주크게: '1.6em' };
function inlineMd(escaped) {
  return escaped
    .replace(/\{(작게|크게|아주크게)\}([\s\S]+?)\{\/\1\}/g, (_, k, inner) => `<span style="font-size:${FONT_SIZES[k]}">${inner}</span>`)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+?)_/g, '<em>$1</em>');
}

// 본문 중간 사진(한 줄 전체): {사진:https://주소|설명|출처} — App.jsx와 동일한 규칙.
const INLINE_IMAGE_RE = /^\{사진:(https:\/\/[^|}\s]+)\|([^|}]*)\|([^|}]*)\}\s*$/;

// 기사 본문(줄바꿈·- 목록·빈 줄 문단 구분·사진 줄)을 안전한 HTML로 변환.
export function renderBodyToHtml(body) {
  const lines = String(body || '').split('\n');
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      out.push('<ul>' + list.map((it) => `<li>${inlineMd(escapeHtml(it))}</li>`).join('') + '</ul>');
      list = [];
    }
  };
  for (const line of lines) {
    const img = INLINE_IMAGE_RE.exec(line);
    if (/^- /.test(line)) {
      list.push(line.slice(2));
    } else if (img) {
      flush();
      const [, src, caption, source] = img.map((v) => String(v).trim());
      out.push(
        `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" loading="lazy" style="max-width:100%">` +
        (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '') +
        (source ? `<p>▲ 사진 출처: ${escapeHtml(source)}</p>` : '') +
        '</figure>'
      );
    } else {
      flush();
      if (line.trim() !== '') out.push(`<p>${inlineMd(escapeHtml(line))}</p>`);
    }
  }
  flush();
  return out.join('\n');
}

// 깨끗한 정적 셸 템플릿을 가져온다. index.html에는 빌드 시 홈 목록이 주입되므로,
// 기사 SSR은 주입 전 원본인 '/_shell.html'을 템플릿으로 쓴다(빌드 스크립트가 생성).
export async function fetchTemplate() {
  const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : BASE;
  const r = await fetch(origin + '/_shell.html');
  return await r.text();
}

// #root(빈 div)에 주입한다. 정적 템플릿은 정확히 <div id="root"></div> 형태다.
export function injectIntoRoot(html, contentHtml) {
  return html.replace('<div id="root"></div>', `<div id="root">${contentHtml}</div>`);
}

// pre-hydration 동안만 잠깐 보이는 폴백의 기본 스타일(크롤러는 무시).
export const SSR_STYLE =
  'max-width:760px;margin:0 auto;padding:24px 16px;' +
  "font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;" +
  'line-height:1.7;color:#1f2937';

export { BASE };
