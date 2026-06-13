// 빌드 후처리: 홈페이지(dist/index.html)의 #root에 기사 목록 HTML을 주입한다.
// 목적: JS를 실행하지 않는 크롤러(네이버 Yeti·빙)가 홈에서 실제 콘텐츠와
//       각 기사 링크(내부 링크)를 보게 하여 색인·발견을 돕는다.
//
//  - dist/index.html  : 홈 목록이 주입된 정적 페이지  ('/' 가 그대로 서빙)
//  - dist/_shell.html : 주입 전 원본 셸  (기사 SSR 함수가 템플릿으로 사용)
//
// 주의: 기사 페이지(/article/:id)는 런타임 SSR이라 항상 최신이다. 홈 목록만
//       배포 시점 기준으로 고정되며, 새 기사는 sitemap.xml + 기사 SSR로 즉시 색인된다.
// 실패해도 빌드를 깨지 않는다(목록 없이 유효한 셸을 남기고 종료).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  BASE,
  escapeHtml,
  summarize,
  injectIntoRoot,
  SSR_STYLE,
} from '../api/_lib/ssr.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const idxPath = join(root, 'dist', 'index.html');
const shellPath = join(root, 'dist', '_shell.html');

if (!existsSync(idxPath)) {
  console.error('[inject-home] dist/index.html 없음 — vite build 먼저 필요. 건너뜀.');
  process.exit(0);
}

// 깨끗한 셸 확보: index.html이 이미 주입된 상태면 보존된 _shell.html을 기준으로.
let shell = readFileSync(idxPath, 'utf8');
if (!shell.includes('<div id="root"></div>')) {
  if (existsSync(shellPath)) shell = readFileSync(shellPath, 'utf8');
  else { console.error('[inject-home] 깨끗한 셸을 찾지 못함. 건너뜀.'); process.exit(0); }
}
writeFileSync(shellPath, shell);

// 하드코딩 폴백 제거 — 빌드 환경의 env 사용. VITE_ 또는 비-VITE 이름 모두 허용(빌드 단계라 둘 다 접근 가능).
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let articles = [];
try {
  if (!url || !key) throw new Error('SUPABASE env 누락 — 홈 기사 주입 생략(셸만 생성)');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, summary, body, category, type, date, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  articles = data || [];
} catch (e) {
  console.error('[inject-home] 기사 조회 실패 — 목록 없이 진행:', e?.message || e);
  writeFileSync(idxPath, shell);
  process.exit(0);
}

if (!articles.length) {
  writeFileSync(idxPath, shell);
  console.log('[inject-home] 게재된 기사 없음 — 셸만 출력.');
  process.exit(0);
}

const items = articles
  .map((a) => {
    const meta = [a.category, a.type, a.date].filter(Boolean).map(escapeHtml).join(' · ');
    const sum = summarize(a.summary || a.body, 120);
    return (
      `<li style="border-bottom:1px solid #e5e7eb;padding:16px 0">` +
      `<a href="/article/${a.id}" style="text-decoration:none;color:inherit">` +
      (meta ? `<p style="font-size:13px;color:#6b7280;margin-bottom:4px">${meta}</p>` : '') +
      `<h2 style="font-size:19px;font-weight:700;line-height:1.4;color:#111827;margin-bottom:4px">${escapeHtml(a.title)}</h2>` +
      (sum ? `<p style="font-size:14px;color:#4b5563">${escapeHtml(sum)}</p>` : '') +
      `</a></li>`
    );
  })
  .join('');

const content =
  `<div id="ssr" style="${SSR_STYLE}">` +
  `<header style="margin-bottom:8px">` +
  `<h1 style="font-size:26px;font-weight:800;color:#1a6b3c;margin-bottom:6px">세계를 알리다 — 표선고등학교 학생 언론사</h1>` +
  `<p style="font-size:15px;color:#4b5563">표선고등학교 학생 언론사 '세계를 알리다'. 경제·문화·기술 분야 학생 기자들이 직접 쓴 기사와 칼럼을 만나보세요.</p>` +
  `</header>` +
  `<ul style="list-style:none;padding:0;margin:0">${items}</ul>` +
  `</div>`;

let out = injectIntoRoot(shell, content);

// ItemList JSON-LD: 검색엔진에 홈의 기사 목록 구조를 명시
const itemList = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: articles.slice(0, 20).map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${BASE}/article/${a.id}`,
    name: a.title,
  })),
};
out = out.replace(
  '</head>',
  `<script type="application/ld+json">${JSON.stringify(itemList)}</script>\n</head>`
);

writeFileSync(idxPath, out);
console.log(`[inject-home] 홈에 기사 ${articles.length}건 주입 완료. _shell.html 보존.`);
