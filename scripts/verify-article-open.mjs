// 기사 열람 흐름 DB 연동 검증 (이전 기사로 가던 버그 수정 관련).
//
// 프런트 흐름: openArticle → setSelected + pushState(/article/:id) + bump_article_views RPC.
//   라우팅(openFromUrl)은 articles 목록에서 id 로 published 기사를 찾아 selected 로 둔다.
//   따라서 DB 측 핵심은 (1) articles 가 id+status 로 정상 조회되는가, (2) bump_article_views
//   RPC 가 살아있고 조회수를 +1 하는가 두 가지다. 둘 다 라이브로 확인하고, 올린 조회수는 원복한다.
//
// 사용법: node --env-file=.env scripts/verify-article-open.mjs [articleId]

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

let failed = false;
const ok = (m) => console.log('  ✅', m);
const bad = (m) => { failed = true; console.error('  ❌', m); };

try {
  // 1) 라우팅이 쓰는 조회와 동일: published 기사 목록을 id 로 찾을 수 있는지
  const { data: list, error: listErr } = await supabase
    .from('articles').select('id, title, status, views').eq('status', 'published').order('id', { ascending: false });
  if (listErr) { bad(`articles 조회 실패: ${listErr.message}`); throw new Error('schema'); }
  ok(`published 기사 ${list.length}건 조회 OK (openFromUrl 의 id→기사 매핑 가능)`);

  // 2) 대상 기사 선택(인자 우선, 없으면 사용자가 공유한 43, 그것도 없으면 최신)
  const wantId = process.argv[2] ? parseInt(process.argv[2]) : 43;
  let target = list.find(a => a.id === wantId) || list[0];
  if (!target) { bad('published 기사가 없어 검증 불가'); throw new Error('noarticle'); }
  ok(`대상 기사: id=${target.id} "${target.title}" (현재 views=${target.views ?? 0})`);

  // 3) bump_article_views RPC 살아있는지 + 조회수 +1 되는지(라우팅과 무관하지만 openArticle 가 호출)
  const before = target.views ?? 0;
  const { error: rpcErr } = await supabase.rpc('bump_article_views', { p_id: target.id });
  if (rpcErr) { bad(`bump_article_views RPC 실패(마이그 미적용?): ${rpcErr.message}`); throw new Error('rpc'); }
  const { data: after1 } = await supabase.from('articles').select('views').eq('id', target.id).single();
  if ((after1?.views ?? 0) === before + 1) ok(`bump_article_views → views ${before} → ${after1.views} (+1 정상)`);
  else bad(`조회수 증가 비정상: ${before} → ${after1?.views}`);

  // 4) 검증으로 올린 조회수 원복(실데이터 오염 방지)
  const { error: restoreErr } = await supabase.from('articles').update({ views: before }).eq('id', target.id);
  if (restoreErr) console.error('  ⚠️ 조회수 원복 실패(수동 확인 필요):', restoreErr.message);
  else ok(`조회수 원복 완료(views=${before})`);
} catch (err) {
  if (!['schema', 'rpc', 'noarticle'].includes(err.message)) bad(`예외: ${err.message}`);
} finally {
  console.log(failed ? '\n❌ 검증 실패' : '\n✅ DB 연동 확인 완료: 기사 id 조회·bump_article_views 정상.');
  process.exit(failed ? 1 : 0);
}
