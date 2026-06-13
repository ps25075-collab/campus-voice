// 다크 모드 초기 깜빡임(FOUC) 방지: React 마운트 전에 배경색 결정.
// CSP 강화를 위해 인라인 스크립트에서 분리(외부 파일 → script-src 'self'로 허용, 'unsafe-inline' 불필요).
// <head>에서 동기 로드되어 첫 페인트 전에 실행되므로 FOUC 방지 효과는 동일하다.
try {
  var d = localStorage.getItem('campus_voice_dark');
  document.documentElement.style.backgroundColor =
    d && JSON.parse(d) ? '#030712' : '#f9fafb';
} catch (e) {}
