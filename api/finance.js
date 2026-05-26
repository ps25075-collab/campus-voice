const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://campus-voice-green-gamma.vercel.app';

const YF_HEADERS = { headers: { 'User-Agent': 'Mozilla/5.0' } };

// 기준금리 API(한국은행 ECOS) 미설정 시 사용할 최후 폴백값
const RATE_FALLBACK = '2.75%';

function calcChange(closes) {
  const cur  = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const pct  = ((cur - prev) / prev * 100);
  return { cur, change: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' };
}

// 야후 비공식 API는 한국 IP에서 간헐적으로 차단되므로, 하나가 실패해도
// 나머지 지표는 응답하도록 지표별로 개별 파싱한다.
async function fetchIndex(url) {
  const res = await fetch(url, YF_HEADERS);
  if (!res.ok) throw new Error('bad status');
  const json = await res.json();
  const closes = json.chart.result[0].indicators.quote[0].close.filter(Boolean);
  if (closes.length < 2) throw new Error('not enough data');
  return calcChange(closes);
}

async function fetchUsdKrw() {
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error('bad status');
  const json = await res.json();
  return Math.round(json.rates.KRW).toLocaleString('ko-KR');
}

// 한국은행 ECOS API로 실제 기준금리를 조회. ECOS_API_KEY 미설정 시 폴백값 사용.
// 통계표 722Y001(한국은행 기준금리) · 항목 0101000 · 월(M) 주기.
async function fetchBaseRate() {
  const key = process.env.ECOS_API_KEY;
  if (!key) return RATE_FALLBACK;
  try {
    const now = new Date();
    const end = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const start = `${past.getFullYear()}${String(past.getMonth() + 1).padStart(2, '0')}`;
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/12/722Y001/M/${start}/${end}/0101000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('bad status');
    const json = await res.json();
    const rows = json?.StatisticSearch?.row;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('no rows');
    const latest = rows[rows.length - 1];
    const value = parseFloat(latest.DATA_VALUE);
    if (!isFinite(value)) throw new Error('bad value');
    return value.toFixed(2) + '%';
  } catch {
    return RATE_FALLBACK;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const [usdkrw, kospi, nasdaq, sp500, dow, oil, rate] = await Promise.allSettled([
    fetchUsdKrw(),
    fetchIndex('https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d'),
    fetchIndex('https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?interval=1d&range=2d'),
    fetchIndex('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d'),
    fetchIndex('https://query1.finance.yahoo.com/v8/finance/chart/%5EDJI?interval=1d&range=2d'),
    fetchIndex('https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d'),
    fetchBaseRate(),
  ]);

  const ok = (s) => s.status === 'fulfilled';
  const out = {};
  if (ok(usdkrw)) out.usdkrw = usdkrw.value;
  if (ok(kospi))  { out.kospi  = kospi.value.cur.toFixed(2);  out.kospi_change  = kospi.value.change; }
  if (ok(nasdaq)) { out.nasdaq = nasdaq.value.cur.toFixed(2); out.nasdaq_change = nasdaq.value.change; }
  if (ok(sp500))  { out.sp500  = sp500.value.cur.toFixed(2);  out.sp500_change  = sp500.value.change; }
  if (ok(dow))    { out.dow    = Math.round(dow.value.cur).toLocaleString('en-US'); out.dow_change = dow.value.change; }
  if (ok(oil))    { out.oil    = oil.value.cur.toFixed(2);    out.oil_change    = oil.value.change; }
  out.rate = ok(rate) ? rate.value : RATE_FALLBACK;

  // 지표를 하나도 못 받은 경우에만 실패 처리
  const gotAny = Object.keys(out).some(k => k !== 'rate');
  if (!gotAny) {
    res.status(500).json({ error: 'fetch failed' });
    return;
  }

  // Vercel 엣지 캐시: 야후 일시 차단 시에도 직전 데이터를 제공(stale-while-revalidate)
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  res.status(200).json(out);
}
