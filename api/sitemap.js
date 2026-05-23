import { createClient } from '@supabase/supabase-js';

const BASE = 'https://campus-voice-green-gamma.vercel.app';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  let articles = [];
  try {
    const { data } = await supabase
      .from('articles')
      .select('id, created_at, status')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    articles = data || [];
  } catch {}

  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    { loc: `${BASE}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    ...articles.map((a) => ({
      loc: `${BASE}/article/${a.id}`,
      lastmod: (a.created_at || today).slice(0, 10),
      changefreq: 'weekly',
      priority: '0.8',
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <url>\n` +
          `    <loc>${e.loc}</loc>\n` +
          `    <lastmod>${e.lastmod}</lastmod>\n` +
          `    <changefreq>${e.changefreq}</changefreq>\n` +
          `    <priority>${e.priority}</priority>\n` +
          `  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
