// 중복-클릭 가드를 추가한 버튼들이 의존하는 DB 경로 연동 검증.
//
// 가드 자체는 클라이언트(중복 fetch 차단)라 DB 동작을 바꾸지 않는다. 다만 각 버튼이
// 실제로 쓰는 테이블/컬럼이 살아있는지 라이브로 확인한다:
//   • 건의 보내기 → suggestions INSERT (api/comments action:suggest 와 동일 컬럼)
//   • 회원 로그인/가입 → profiles 조회/업서트 컬럼 존재
// suggestions 검증 행은 marker 로 만들고 즉시 삭제. profiles 는 읽기 전용 probe(무변경).
//
// 사용법: node --env-file=.env scripts/verify-buttons-db.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

let failed = false;
const ok = (m) => console.log('  ✅', m);
const bad = (m) => { failed = true; console.error('  ❌', m); };
const todayStr = () => new Date().toISOString().slice(0, 10);
const marker = `__verify_${Date.now()}__`;

try {
  // 1) profiles — 회원 로그인(loadMemberProfile select)·가입(upsert) 이 쓰는 컬럼 존재 확인(읽기 전용)
  const prof = await supabase.from('profiles')
    .select('id, display_name, role, email, terms_agreed, privacy_agreed, terms_agreed_at').limit(1);
  if (prof.error) bad(`profiles 조회 실패: ${prof.error.message}`);
  else ok('profiles 연동 OK(id/display_name/role/email/terms_agreed/privacy_agreed/terms_agreed_at)');

  // 2) suggestions — 건의 보내기(action:suggest)가 INSERT 하는 경로. 1요청=1행 확인 후 삭제.
  const ins = await supabase.from('suggestions')
    .insert({ name: 'DB검증(임시)', content: `${marker} content`, date: todayStr() })
    .select('id').single();
  if (ins.error) { bad(`suggestions INSERT 실패: ${ins.error.message}`); }
  else {
    ok(`suggestions INSERT OK (id=${ins.data.id}) — 건의 1건 정상 저장`);
    const { data: rows } = await supabase.from('suggestions').select('id').like('content', `${marker}%`);
    if ((rows?.length || 0) === 1) ok('marker 행 정확히 1건 — 서버 경로 단일 INSERT 확인');
    else bad(`marker 행 ${rows?.length}건(1이어야 함)`);
  }
} catch (e) {
  bad(`예외: ${e.message}`);
} finally {
  const { error } = await supabase.from('suggestions').delete().like('content', `${marker}%`);
  if (error) console.error('  ⚠️ suggestions 정리 실패(수동 삭제 필요):', error.message, 'marker=', marker);
  else console.log('  🧹 검증 행 정리 완료');
  console.log(failed ? '\n❌ 검증 실패' : '\n✅ DB 연동 확인 완료: profiles 조회 / suggestions 단일 INSERT 정상.');
  process.exit(failed ? 1 : 0);
}
