// 댓글·건의 본문 형식 방어(우려 #4) 검증 — 앱(V.text) + DB(CHECK 제약) 양층 확인.
//   node --env-file=.env scripts/verify-ugc-format.mjs
// 필요한 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// DB 검증은 '거부되어야 하는' insert가 실제로 거부되는지(제어문자·초과 길이) 확인한다.
// 거부 케이스는 행을 만들지 않으므로 오염이 없고, 정상 케이스는 넣은 뒤 즉시 삭제한다.

import { createClient } from '@supabase/supabase-js';
import { V } from '../api/_lib/validate.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }

const svc = createClient(url, key, { auth: { persistSession: false } });
let fail = 0;
const ok = (m) => console.log('✅', m);
const bad = (m) => { console.error('❌', m); fail++; };
const C = String.fromCharCode;
const today = new Date().toISOString().slice(0, 10);
const CTRL = C(0x07); // BEL — 금지 대상 제어문자

// ── 1) 앱 계층: V.text 정제 ──
{
  const r = V.text('a' + CTRL + 'b' + C(0x200b) + 'c' + C(0x202e) + 'd\r\ne\tf', { max: 2000 });
  const clean = r.ok && ![...r.value].some(ch => {
    const n = ch.codePointAt(0); return n < 0x20 && n !== 0x09 && n !== 0x0a;
  });
  if (clean && r.value.includes('\n') && r.value.includes('\t')) ok(`V.text 정제 OK → ${JSON.stringify(r.value)}`);
  else bad(`V.text 정제 비정상 → ${JSON.stringify(r.value)}`);

  if (!V.text('x'.repeat(2001), { max: 2000 }).ok) ok('V.text 초과 길이 거부'); else bad('V.text 초과 길이 통과(비정상)');
  if (!V.text('  ' + CTRL + ' ', { min: 1 }).ok) ok('V.text 제어문자-only→빈문자 거부'); else bad('V.text 빈문자 통과(비정상)');
}

// ── 2) DB 계층: suggestions CHECK ──
async function expectReject(label, table, row, idCol = 'id') {
  const { data, error } = await svc.from(table).insert(row).select(idCol).maybeSingle();
  if (error) { ok(`${label} → DB 거부됨 (${error.code || error.message})`); return; }
  // 예상과 달리 통과 → 정리하고 실패 처리
  if (data?.[idCol]) await svc.from(table).delete().eq(idCol, data[idCol]);
  bad(`${label} → DB가 허용함(CHECK 미적용?) — 정리함`);
}

await expectReject('suggestions 제어문자', 'suggestions', { name: '__verify', content: 'a' + CTRL + 'b', date: today });
await expectReject('suggestions 초과 길이', 'suggestions', { name: '__verify', content: 'x'.repeat(2001), date: today });

// 정상 건의는 통과해야 함 → 넣고 즉시 삭제
{
  const { data, error } = await svc.from('suggestions').insert({ name: '__verify', content: '정상 본문 verify', date: today }).select('id').maybeSingle();
  if (error) bad(`정상 suggestions insert 실패: ${error.message}`);
  else { ok('정상 suggestions insert 허용'); if (data?.id) await svc.from('suggestions').delete().eq('id', data.id); }
}

// ── 3) DB 계층: comments CHECK (기사 1개 필요) ──
const { data: arts } = await svc.from('articles').select('id').limit(1);
const articleId = arts?.[0]?.id;
if (!articleId) {
  console.log('ℹ️  기사가 없어 comments DB 검증은 생략(테이블 CHECK는 동일 패턴).');
} else {
  await expectReject('comments 제어문자', 'comments',
    { article_id: articleId, name: '익명', text: 'a' + CTRL + 'b', date: today, parent_id: null, likes: 0 });
  await expectReject('comments 초과 길이', 'comments',
    { article_id: articleId, name: '익명', text: 'x'.repeat(2001), date: today, parent_id: null, likes: 0 });
  const { data, error } = await svc.from('comments')
    .insert({ article_id: articleId, name: '익명', text: '정상 댓글 verify', date: today, parent_id: null, likes: 0 })
    .select('id').maybeSingle();
  if (error) bad(`정상 comments insert 실패: ${error.message}`);
  else { ok('정상 comments insert 허용'); if (data?.id) await svc.from('comments').delete().eq('id', data.id); }
}

console.log(fail ? `\n❌ ${fail}건 실패` : '\n🎉 모든 검증 통과');
process.exit(fail ? 1 : 0);
