// 일회성: 기존 기사 요약을 앱과 동일한 makeSummary 로직으로 재생성한다.
// 실행: node scripts/regen-summaries.mjs
// RLS 비활성 상태라 anon 키로 read/write 가능. (변경 전/후를 콘솔에 출력)
import { createClient } from '@supabase/supabase-js';

// 하드코딩 폴백 제거 — env 필수(VITE_ 또는 비-VITE 이름 허용).
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('[regen-summaries] SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ── App.jsx 와 동일한 로직 (복사본) ──
const stripMarkdown = (s) => (s || '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/_([^_]+)_/g, '$1')
  .replace(/^\s*[-*]\s+/gm, '')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

const makeSummary = (body) => {
  const clean = stripMarkdown(body);
  if (clean.length <= 90) return clean;
  let cut = clean.slice(0, 90);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 55) cut = cut.slice(0, lastSpace);
  return cut.replace(/[\s.,·…]+$/, '') + '…';
};

const { data, error } = await supabase.from('articles').select('id,title,body,summary');
if (error) { console.error('SELECT 실패:', error.message); process.exit(1); }

let updated = 0, skipped = 0, failed = 0;
for (const a of data) {
  const next = makeSummary(a.body);
  if (next === (a.summary || '')) { skipped++; continue; }
  const { error: e } = await supabase.from('articles').update({ summary: next }).eq('id', a.id);
  if (e) { console.error(`[FAIL] id=${a.id} (${a.title}): ${e.message}`); failed++; continue; }
  console.log(`[OK] id=${a.id} ${a.title}\n   - 이전: ${a.summary}\n   + 이후: ${next}`);
  updated++;
}
console.log(`\n완료. 총 ${data.length}건 / 변경 ${updated} / 변경없음 ${skipped} / 실패 ${failed}`);
