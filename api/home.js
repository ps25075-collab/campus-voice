import { createClient } from '@supabase/supabase-js';
import { fetchTemplate, renderHomeHtml } from './_lib/ssr.js';

// 홈 화면의 서버 렌더링 — 새 기사가 재배포 없이 크롤러용 목록에 바로 들어간다.
// 기사 조회가 실패해도 셸은 그대로 응답해 사용자 화면은 앱이 정상적으로 그린다.
export default async function handler(req, res) {
  let html;
  try {
    html = await fetchTemplate();
  } catch (e) {
    res.status(500).send('Failed to load template');
    return;
  }

  let cacheControl = 's-maxage=60, stale-while-revalidate=86400';
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary, body, category, type, date, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (error) throw error;
    html = renderHomeHtml(html, data || []);
  } catch (e) {
    console.error('[home] 기사 조회 실패:', e?.message || e);
    cacheControl = 'no-store';
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.status(200).send(html);
}
