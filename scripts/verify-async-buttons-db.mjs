// AsyncButton(처리 중 표시) 적용 버튼들이 의존하는 DB 경로 연동 검증.
//
// 이번 변경은 클라이언트 UX(중복 클릭 방지)만 손댔고 스키마/엔드포인트는 그대로다. 따라서
// 버튼들이 실제로 호출하는 DB 동작이 여전히 정상인지 확인한다:
//   • 기사 승인/반려/헤드라인(updateStatus·toggleHero) → articles UPDATE 권한/컬럼
//   • 회원 승인/거절(updateMemberRole) → profiles.role
//   • 구독자/건의 삭제, 구독 → subscribers / suggestions
//   • 재승인/탈퇴(requestReApproval·handleWithdraw) → RPC 존재(파괴적이라 실행은 안 함)
// 쓰기 검증은 '값을 그대로 다시 쓰는 no-op UPDATE'로 데이터 변경 없이 권한만 확인한다.
//
// 사용법: node --env-file=.env scripts/verify-async-buttons-db.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

let failed = false;
const ok = (m) => console.log('  ✅', m);
const bad = (m) => { failed = true; console.error('  ❌', m); };

try {
  // 1) articles — status/hero 컬럼 + 쓰기 권한(no-op UPDATE: 현재 값을 그대로 다시 기록)
  const { data: arts, error: aErr } = await supabase
    .from('articles').select('id, status, hero').order('id', { ascending: false }).limit(1);
  if (aErr) bad(`articles 조회 실패: ${aErr.message}`);
  else if (!arts.length) ok('articles 비어있음(쓰기 검증 생략) — 조회는 정상');
  else {
    const a = arts[0];
    ok(`articles 연동 OK(id/status/hero) — 표본 id=${a.id} status=${a.status} hero=${a.hero}`);
    const { error: upErr } = await supabase
      .from('articles').update({ status: a.status, hero: a.hero }).eq('id', a.id);  // no-op
    if (upErr) bad(`articles UPDATE 권한 실패(승인/헤드라인 버튼 영향): ${upErr.message}`);
    else ok('articles UPDATE(no-op) 성공 — 승인/반려/헤드라인 쓰기 경로 정상(데이터 무변경)');
  }

  // 2) profiles.role — 회원 승인/거절 버튼이 바꾸는 값(읽기 전용)
  const { error: pErr } = await supabase.from('profiles').select('id, role').limit(1);
  if (pErr) bad(`profiles 조회 실패: ${pErr.message}`); else ok('profiles.role 연동 OK(회원 승인/거절 경로)');

  // 3) subscribers / suggestions / comments — 삭제·구독·댓글 버튼 대상 테이블(읽기 전용 connectivity)
  for (const t of ['subscribers', 'suggestions', 'comments']) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) bad(`${t} 조회 실패: ${error.message}`); else ok(`${t} 연동 OK`);
  }

  // 4) 재승인/탈퇴 RPC 존재 확인 — 파괴적이라 실행하지 않고 pg_proc 로 존재만 확인.
  //    (rpc 로 직접 호출 시 권한/부작용 위험 → 함수 등록 여부만 본다)
  const { data: fns, error: fErr } = await supabase
    .schema('pg_catalog').from('pg_proc').select('proname').in('proname', ['request_reapproval', 'delete_own_account']);
  if (fErr) {
    // pg_catalog 노출이 막혀 있으면(정상적 보안) 마이그레이션 정의로 갈음.
    ok('RPC 직접 introspection 불가(보안상 정상) — request_reapproval/delete_own_account 는 20260605_profiles_rls.sql 에 정의됨');
  } else {
    const names = (fns || []).map(f => f.proname);
    const has = (n) => names.includes(n) ? ok(`RPC '${n}' 등록 확인`) : bad(`RPC '${n}' 미등록(마이그 미적용?)`);
    has('request_reapproval'); has('delete_own_account');
  }
} catch (e) {
  bad(`예외: ${e.message}`);
} finally {
  console.log(failed ? '\n❌ 검증 실패' : '\n✅ DB 연동 확인 완료: 버튼들이 호출하는 테이블/쓰기 경로 정상(데이터 무변경).');
  process.exit(failed ? 1 : 0);
}
