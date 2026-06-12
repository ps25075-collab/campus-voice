const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://campus-voice-green-gamma.vercel.app';

const YF_HEADERS = { headers: { 'User-Agent': 'Mozilla/5.0' } };

// 야후 차트 API 호스트. 한쪽이 429·차단될 때 다른 쪽이 응답하는 경우가 많아 순차로 시도한다.
const YF_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

// 기준금리 API(한국은행 ECOS) 미설정 시 사용할 최후 폴백값
const RATE_FALLBACK = '2.75%';

function calcChange(closes) {
  const cur  = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const pct  = ((cur - prev) / prev * 100);
  return { cur, change: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' };
}

// 야후 비공식 API는 한국/특정 IP에서 간헐적으로 차단(429 등)되므로,
// query1·query2 두 호스트를 순차로 시도해 한 지표가 통째로 사라지는 일을 줄인다.
// (지표별 개별 파싱은 유지 — 하나가 끝내 실패해도 나머지는 응답)
async function fetchIndex(symbol) {
  let lastErr;
  for (const host of YF_HOSTS) {
    try {
      const res = await fetch(`https://${host}/v8/finance/chart/${symbol}?interval=1d&range=2d`, YF_HEADERS);
      if (!res.ok) throw new Error('bad status ' + res.status);
      const json = await res.json();
      const closes = json.chart.result[0].indicators.quote[0].close.filter(Boolean);
      if (closes.length < 2) throw new Error('not enough data');
      return calcChange(closes);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
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

  const [usdkrw, kospi, kosdaq, nasdaq, sp500, dow, oil, rate] = await Promise.allSettled([
    fetchUsdKrw(),
    fetchIndex('%5EKS11'),  // 코스피
    fetchIndex('%5EKQ11'),  // 코스닥
    fetchIndex('%5EIXIC'),  // 나스닥
    fetchIndex('%5EGSPC'),  // S&P 500
    fetchIndex('%5EDJI'),   // 다우존스
    fetchIndex('CL%3DF'),   // WTI 원유
    fetchBaseRate(),
  ]);

  const ok = (s) => s.status === 'fulfilled';
  const out = {};
  if (ok(usdkrw)) out.usdkrw = usdkrw.value;
  if (ok(kospi))  { out.kospi  = kospi.value.cur.toFixed(2);  out.kospi_change  = kospi.value.change; }
  if (ok(kosdaq)) { out.kosdaq = kosdaq.value.cur.toFixed(2); out.kosdaq_change = kosdaq.value.change; }
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

  // 부분 응답(일부 지표 누락)이 엣지에 오래 고정돼 빈 칸이 지속되는 것을 막는다.
  // 완전한 응답만 길게 캐시하고, 누락이 있으면 짧게만 캐시해 곧 다시 채운다.
  const gotAll = ['usdkrw', 'kospi', 'kosdaq', 'nasdaq', 'sp500', 'dow', 'oil'].every(k => out[k] != null);
  res.setHeader('Cache-Control', gotAll
    ? 's-maxage=120, stale-while-revalidate=600'   // 완전: 직전 데이터 stale 제공
    : 's-maxage=15, stale-while-revalidate=30');    // 불완전: 짧게만 — 빠르게 자가 회복
  res.status(200).json(out);
}
