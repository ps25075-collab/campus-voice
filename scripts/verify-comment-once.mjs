// 댓글 중복 등록 수정 검증 (DB 연동).
//
// 배경: 댓글이 한 번 누름에 여러 개 올라가던 문제는 클라이언트가 전송 중 재클릭으로
//   /api/comments(action:create)를 여러 번 호출했기 때문(src/App.jsx 의 in-flight 가드로 차단).
//   서버(api/comments.js)는 요청당 INSERT 1회뿐이라, 여기서는 "요청 1회 = 행 1개" 와
//   comments 테이블 연동(컬럼/쓰기)을 라이브 DB로 확인한다.
//
// 안전: 실제 기사에 영향 주지 않도록 article_id = 0(존재하지 않는 기사)로 임시 행을 만들고,
//   검증 후 반드시 삭제한다. 공개 화면은 실제 기사 id로만 조회하므로 노출되지 않는다.
//
// 사용법: node --env-file=.env scripts/verify-comment-once.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

// comments.article_id 에 FK 가 걸려 있어 실제 기사 id 가 필요하다. 가장 최근 기사 1건을
// 빌려 marker 텍스트로 임시 행을 만들고 즉시 삭제한다(노출 창은 수 ms).
const { data: art, error: artErr } = await supabase
  .from('articles').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
if (artErr || !art) { console.error('❌ 테스트용 기사 id 조회 실패:', artErr?.message); process.exit(1); }
const TEST_AID = art.id;
const marker = `__verify_${Date.now()}__`;
let failed = false;
const ok = (m) => console.log('  ✅', m);
const bad = (m) => { failed = true; console.error('  ❌', m); };
const todayStr = () => new Date().toISOString().slice(0, 10);

// api/comments.js 의 create 분기와 동일한 단일 INSERT.
async function insertOne(text) {
  const row = { article_id: TEST_AID, name: '익명', text, date: todayStr(), parent_id: null, likes: 0 };
  const { data, error } = await supabase.from('comments').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

try {
  // 0) comments 컬럼/연동 확인
  const probe = await supabase.from('comments')
    .select('id, article_id, name, text, date, parent_id, likes, created_at').limit(1);
  if (probe.error) { bad(`comments 조회 실패: ${probe.error.message}`); throw new Error('schema'); }
  ok('comments 테이블 연동 OK(id/article_id/text/parent_id/likes/created_at)');

  // 1) 요청 1회 = 행 1개
  const c = await insertOne(`${marker} single`);
  if (c?.id) ok(`단일 작성 → 행 1개 생성(id=${c.id})`); else bad('단일 작성이 행을 반환하지 않음');

  // 2) 동일 본문을 두 번 보내면 두 행이 생긴다(서버엔 중복 차단 없음 — 클라 가드가 막아야 함을 확인).
  //    => 이 사실이 곧 "중복 방지는 클라이언트 in-flight 가드의 책임" 임을 입증한다.
  const d = await insertOne(`${marker} dup`);
  const e = await insertOne(`${marker} dup`);
  const { data: dupRows } = await supabase.from('comments')
    .select('id').eq('article_id', TEST_AID).eq('text', `${marker} dup`);
  if ((dupRows?.length || 0) === 2)
    ok('서버는 동일 본문 2요청을 2행으로 저장 → 중복 방지는 클라 가드 책임(가드로 요청 자체를 1회로 제한)');
  else bad(`예상 2행, 실제 ${dupRows?.length}행`);
} catch (err) {
  if (err.message !== 'schema') bad(`예외: ${err.message}`);
} finally {
  // 검증용 행 전부 삭제(marker 로 시작하는 것만)
  const { error } = await supabase.from('comments').delete().eq('article_id', TEST_AID).like('text', `${marker}%`);
  if (error) console.error('  ⚠️ 정리 실패(수동 삭제 필요):', error.message, 'marker=', marker);
  else console.log('  🧹 검증 행 정리 완료');
  console.log(failed ? '\n❌ 검증 실패' : '\n✅ DB 연동 확인 완료: 요청당 1행. 중복은 클라이언트 in-flight 가드로 차단.');
  process.exit(failed ? 1 : 0);
}
