// 서비스워커 등록(PWA). CSP 강화를 위해 인라인 스크립트에서 분리.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
