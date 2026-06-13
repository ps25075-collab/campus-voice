// DB 보안 상태 드리프트 감지 — "코드는 안전한데 DB는 무방비" 상황을 자동 적발.
//
// 배경(우려 #1): 이 프로젝트의 RLS/권한은 supabase/migrations/*.sql 을 사람이 직접
//   Supabase SQL Editor에서 Run 해야 적용된다. 적용 누락 시 코드가 아무리 안전해도 DB가
//   뚫린 상태가 된다(실제로 20260607 likes/bookmarks RLS가 한동안 미적용이었음).
//
// 이 스크립트는 '공격자가 가진 것과 동일한 anon 키'로 실제 라이브 DB를 두드려, 닫혀 있어야 할
//   경로가 열려 있으면 실패(exit 1)한다. 로컬(npm run verify:security)·CI 양쪽에서 실행 가능.
//
// 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY (anon 키는 공개용이라 CI 변수로 둬도 안전).
//   로컬은 .env 자동 로드.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('[verify] SUPABASE_URL / SUPABASE_ANON_KEY 필요');
  process.exit(2);
}

const { createClient } = await import('@supabase/supabase-js');
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const fails = [];
const oks = [];
const FORGED_UUID = '00000000-0000-0000-0000-0000000feeed';
const cleanup = [];

// check: name, 통과조건 함수(true=안전). rows/error 기반.
async function expectBlocked(name, promise, isSafe) {
  try {
    const res = await promise;
    const safe = isSafe(res);
    (safe ? oks : fails).push(name + (safe ? '' : `  ← 열림! status=${res.status} rows=${Array.isArray(res.data) ? res.data.length : (res.data ? 1 : 0)}`));
    return res;
  } catch (e) {
    // 네트워크 등 예외는 '판정 불가'로 실패 처리(보수적)
    fails.push(`${name}  ← 점검 실패(${e.message})`);
  }
}

const noRows = (r) => !r.error ? (Array.isArray(r.data) ? r.data.length === 0 : !r.data) : true; // 권한오류도 안전
const denied = (r) => !!r.error;            // 반드시 에러(권한 거부)여야 안전
const onlyPrefixed = (r) => !r.error && (r.data || []).every(x => /^(anon:|staff:)/.test(x.user_id || '')); // bare UUID 없어야

console.log(`=== DB 보안 드리프트 점검 (anon 키, ${URL.replace(/^https?:\/\//, '').split('.')[0]}) ===\n`);

// 위조 insert 테스트는 '실제 존재하는' article_id 로 해야 FK 오류가 아닌 RLS를 측정한다.
const { data: anyPub } = await anon.from('articles').select('id').eq('status', 'published').limit(1);
const VALID_AID = anyPub && anyPub[0] ? anyPub[0].id : 1;

// #10 미게재 기사 본문 비노출
await expectBlocked('미게재(pending/rejected) 기사 비노출',
  anon.from('articles').select('id').in('status', ['pending', 'rejected']).limit(1), noRows);

// #1 회원 PII 비노출
await expectBlocked('profiles(PII) 비노출',
  anon.from('profiles').select('id').limit(1), noRows);

// #1 기사 직접 쓰기 차단
await expectBlocked('articles 직접 INSERT 차단',
  anon.from('articles').insert({ title: '__verify__', body: 'x', status: 'published' }).select(), denied);

// staff_users 해시 비노출
await expectBlocked('staff_users 비노출',
  anon.from('staff_users').select('id').limit(1), denied);

// #2 article_likes: bare 회원 UUID 비노출 + 위조 insert 차단
await expectBlocked('article_likes: 회원 bare-UUID 비노출',
  anon.from('article_likes').select('user_id'), onlyPrefixed);
{
  const r = await expectBlocked('article_likes: 회원 UUID 위조 insert 차단',
    anon.from('article_likes').insert({ user_id: FORGED_UUID, article_id: VALID_AID }).select(), denied);
  if (r && !r.error) cleanup.push(['article_likes', FORGED_UUID]);
}

// #2 bookmarks: 위조 insert 차단
{
  const r = await expectBlocked('bookmarks: 회원 UUID 위조 insert 차단',
    anon.from('bookmarks').insert({ user_id: FORGED_UUID, article_id: VALID_AID }).select(), denied);
  if (r && !r.error) cleanup.push(['bookmarks', FORGED_UUID]);
}

// #3 카운터 임의값 변조 차단(가능하면 published 기사 1건 대상)
{
  const { data: pub } = await anon.from('articles').select('id').eq('status', 'published').limit(1);
  if (pub && pub[0]) {
    await expectBlocked('articles.views 임의값 변조 차단',
      anon.from('articles').update({ views: 999999 }).eq('id', pub[0].id).select('id'), denied);
    await expectBlocked('articles.like_count 임의값 변조 차단',
      anon.from('articles').update({ like_count: 999999 }).eq('id', pub[0].id).select('id'), denied);
  }
}

// 점검용으로 새어 들어간 위조 행은 service 키가 있으면 정리(없으면 스킵)
if (cleanup.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const [tbl, uid] of cleanup) await svc.from(tbl).delete().eq('user_id', uid);
}

console.log('통과:');
for (const o of oks) console.log('  ✅ ' + o);
if (fails.length) {
  console.log('\n실패(닫혀야 할 경로가 열림 — 해당 마이그레이션 미적용 의심):');
  for (const f of fails) console.log('  ❌ ' + f);
  console.log('\n→ supabase/migrations 의 해당 SQL을 Supabase SQL Editor에서 Run 했는지 확인하세요.');
  process.exit(1);
}
console.log('\n모든 보안 점검 통과 ✅');
