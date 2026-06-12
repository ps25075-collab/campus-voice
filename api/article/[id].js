import { createClient } from '@supabase/supabase-js';
import {
  BASE,
  escapeHtml,
  summarize,
  renderBodyToHtml,
  fetchTemplate,
  injectIntoRoot,
  SSR_STYLE,
} from '../_lib/ssr.js';
import { V } from '../_lib/validate.js';

// 기사 상세 페이지의 서버 사이드 렌더링.
//  - <head> 메타태그(title/description/canonical/OG/Twitter)를 기사에 맞게 교체
//  - JSON-LD(NewsArticle) 주입
//  - #root에 기사 본문 HTML 주입  ← 네이버·빙 같은 비(非)JS 크롤러가 본문을 읽게 함
// 매 요청 시 Supabase에서 최신 데이터를 읽으므로 항상 최신 상태가 색인된다.
export default async function handler(req, res) {
  const rawId = (req.query && req.query.id) || (req.url || '').split('/').filter(Boolean).pop();
  // id는 반드시 양의 정수 — 잘못된 입력(객체/문자열 등)이 쿼리 계층으로 흐르지 않게 한다.
  const idv = V.intId(rawId);

  // 1) 깨끗한 정적 템플릿 로드
  let html;
  try {
    html = await fetchTemplate();
  } catch (e) {
    res.status(500).send('Failed to load template');
    return;
  }

  // 2) 기사 조회 (게재된 글만) — 유효한 정수 id일 때만 조회
  let article = null;
  if (idv.ok) try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('id', idv.value)
      .eq('status', 'published')
      .single();
    article = data;
  } catch {}

  if (article) {
    const title = `${article.title} — 세계를 알리다`;
    const desc = summarize(article.summary || article.body, 180);
    const image =
      article.image && /^https?:/.test(article.image)
        ? article.image
        : `${BASE}/icon-512.png`;
    const url = `${BASE}/article/${article.id}`;
    const T = escapeHtml(title);
    const D = escapeHtml(desc);
    const U = escapeHtml(url);
    const I = escapeHtml(image);

    // ── <head> 메타태그 교체 ──
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${T}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${D}" />`)
      .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${U}" />`)
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${T}" />`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${D}" />`)
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${U}" />`)
      .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="article" />`)
      .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${T}" />`)
      .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${D}" />`);

    // ── JSON-LD(NewsArticle) + og:image 주입 ──
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: desc,
      datePublished: article.created_at || article.date || undefined,
      dateModified: article.created_at || article.date || undefined,
      author: {
        '@type': article.author ? 'Person' : 'Organization',
        name: article.author || '세계를 알리다 편집부',
      },
      publisher: {
        '@type': 'Organization',
        name: '세계를 알리다',
        logo: { '@type': 'ImageObject', url: `${BASE}/icon-512.png`, width: 512, height: 512 },
      },
      image: [image],
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      articleSection: article.category,
    };

    const extras =
      `<meta property="og:image" content="${I}" />\n` +
      `<meta name="twitter:card" content="${image.endsWith('/icon-512.png') ? 'summary' : 'summary_large_image'}" />\n` +
      `<meta name="twitter:image" content="${I}" />\n` +
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`;
    html = html.replace('</head>', extras + '</head>');

    // ── #root에 기사 본문 HTML 주입 (크롤러용 실제 콘텐츠) ──
    const meta = [article.category, article.type, article.date]
      .filter(Boolean)
      .map(escapeHtml)
      .join(' · ');
    const imgTag =
      article.image && /^https?:/.test(article.image)
        ? `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" style="width:100%;border-radius:12px;margin:16px 0" />`
        : '';
    const content =
      `<article id="ssr" style="${SSR_STYLE}">` +
      `<p style="margin-bottom:8px"><a href="/" style="color:#1a6b3c;text-decoration:none;font-weight:600">← 세계를 알리다</a></p>` +
      (meta ? `<p style="font-size:13px;color:#6b7280;margin-bottom:8px">${meta}</p>` : '') +
      `<h1 style="font-size:28px;font-weight:800;line-height:1.3;margin-bottom:12px">${escapeHtml(article.title)}</h1>` +
      (article.summary ? `<p style="font-size:18px;color:#374151;margin-bottom:16px">${escapeHtml(article.summary)}</p>` : '') +
      imgTag +
      `<div>${renderBodyToHtml(article.body)}</div>` +
      `</article>`;
    html = injectIntoRoot(html, content);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.status(200).send(html);
}
