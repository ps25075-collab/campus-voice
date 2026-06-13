// 관리자 API 단일 진입점(디스패처).
// Vercel 무료 플랜의 서버리스 함수 개수 제한(12개)을 지키기 위해, 기존
// api/admin/{articles,members,subscribers,suggestions} 4개 함수를 1개로 통합한다.
// 실제 로직은 api/_lib/admin/*.js 에 있고('_'로 시작해 함수로 집계되지 않음),
// 클라이언트 URL(/api/admin/<resource>)은 vercel.json rewrite로 그대로 유지된다.
//   /api/admin/:resource  →  /api/admin?resource=:resource
import articles from './_lib/admin/articles.js';
import members from './_lib/admin/members.js';
import subscribers from './_lib/admin/subscribers.js';
import suggestions from './_lib/admin/suggestions.js';
import { guardMutation } from './_lib/csrf.js';

const handlers = { articles, members, subscribers, suggestions };

export default async function handler(req, res) {
  // CSRF/교차 출처 방어: preflight 처리 + 변경 요청 Origin 검증(모든 admin 리소스 공통).
  if (guardMutation(req, res)) return;

  const resource = req.query && req.query.resource;
  const fn = handlers[resource];
  if (!fn) return res.status(404).json({ error: 'unknown admin resource' });
  return fn(req, res);
}
