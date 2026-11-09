// 빌드 후처리: dist/index.html을 dist/_shell.html로 옮긴다.
//  - 홈(/)은 api/home이, 기사(/article/:id)는 api/article/[id]가 이 셸에 최신 기사를 넣어 응답한다.
//  - dist/index.html이 남아 있으면 정적 파일이 우선 서빙되어 홈 목록이 배포 시점에 멈추므로 반드시 없앤다.
import { existsSync, renameSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  console.error('[make-shell] dist/index.html 없음 — vite build가 먼저 실행되어야 합니다.');
  process.exit(1);
}
renameSync('dist/index.html', 'dist/_shell.html');
console.log('[make-shell] dist/_shell.html 생성 완료.');
