import { createClient } from '@supabase/supabase-js';

const BASE = 'https://campus-voice-green-gamma.vercel.app';

function escape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function summarize(s, max = 180) {
  const clean = String(s || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + '…';
}

export default async function handler(req, res) {
  const id = (req.query && req.query.id) || (req.url || '').split('/').filter(Boolean).pop();

  // 1) Fetch the built index.html template from our own origin
  let html;
  try {
    const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : BASE;
    const r = await fetch(origin + '/');
    html = await r.text();
  } catch (e) {
    res.status(500).send('Failed to load template');
    return;
  }

  // 2) Look up the article
  let article = null;
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
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
    const url = `${BASE}/article/${id}`;
    const T = escape(title);
    const D = escape(desc);
    const U = escape(url);
    const I = escape(image);

    // Replace existing meta tags
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${T}</title>`)
      .replace(
        /<meta name="description"[^>]*>/,
        `<meta name="description" content="${D}" />`
      )
      .replace(
        /<link rel="canonical"[^>]*>/,
        `<link rel="canonical" href="${U}" />`
      )
      .replace(
        /<meta property="og:title"[^>]*>/,
        `<meta property="og:title" content="${T}" />`
      )
      .replace(
        /<meta property="og:description"[^>]*>/,
        `<meta property="og:description" content="${D}" />`
      )
      .replace(
        /<meta property="og:url"[^>]*>/,
        `<meta property="og:url" content="${U}" />`
      )
      .replace(
        /<meta property="og:type"[^>]*>/,
        `<meta property="og:type" content="article" />`
      )
      .replace(
        /<meta name="twitter:title"[^>]*>/,
        `<meta name="twitter:title" content="${T}" />`
      )
      .replace(
        /<meta name="twitter:description"[^>]*>/,
        `<meta name="twitter:description" content="${D}" />`
      );

    // Inject extra tags + JSON-LD before </head>
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
        logo: {
          '@type': 'ImageObject',
          url: `${BASE}/icon-512.png`,
          width: 512,
          height: 512,
        },
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
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).send(html);
}
