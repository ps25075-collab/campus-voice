const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://campus-voice-green-gamma.vercel.app';

const YF_HEADERS = { headers: { 'User-Agent': 'Mozilla/5.0' } };

function calcChange(closes) {
  const cur  = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const pct  = ((cur - prev) / prev * 100);
  return { cur, change: (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const [fxRes, kospiRes, nasdaqRes, sp500Res, dowRes, oilRes] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d',  YF_HEADERS),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?interval=1d&range=2d',  YF_HEADERS),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=2d',  YF_HEADERS),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EDJI?interval=1d&range=2d',   YF_HEADERS),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d',   YF_HEADERS),
    ]);

    const fxData     = await fxRes.json();
    const kospiData  = await kospiRes.json();
    const nasdaqData = await nasdaqRes.json();
    const sp500Data  = await sp500Res.json();
    const dowData    = await dowRes.json();
    const oilData    = await oilRes.json();

    const usdkrw = Math.round(fxData.rates.KRW).toLocaleString('ko-KR');

    const kospi  = calcChange(kospiData.chart.result[0].indicators.quote[0].close.filter(Boolean));
    const nasdaq = calcChange(nasdaqData.chart.result[0].indicators.quote[0].close.filter(Boolean));
    const sp500  = calcChange(sp500Data.chart.result[0].indicators.quote[0].close.filter(Boolean));
    const dow    = calcChange(dowData.chart.result[0].indicators.quote[0].close.filter(Boolean));
    const oil    = calcChange(oilData.chart.result[0].indicators.quote[0].close.filter(Boolean));

    res.status(200).json({
      kospi:        kospi.cur.toFixed(2),
      kospi_change: kospi.change,
      nasdaq:       nasdaq.cur.toFixed(2),
      nasdaq_change:nasdaq.change,
      sp500:        sp500.cur.toFixed(2),
      sp500_change: sp500.change,
      dow:          Math.round(dow.cur).toLocaleString('en-US'),
      dow_change:   dow.change,
      oil:          oil.cur.toFixed(2),
      oil_change:   oil.change,
      usdkrw:       usdkrw,
      rate:         '2.75%',
    });
  } catch (err) {
    res.status(500).json({ error: 'fetch failed' });
  }
}
