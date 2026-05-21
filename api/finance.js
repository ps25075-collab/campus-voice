const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://campus-voice-green-gamma.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const [fxRes, kospiRes, nasdaqRes] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=2d', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?interval=1d&range=2d', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }),
    ]);

    const fxData     = await fxRes.json();
    const kospiData  = await kospiRes.json();
    const nasdaqData = await nasdaqRes.json();

    const usdkrw = Math.round(fxData.rates.KRW).toLocaleString('ko-KR');

    const kospiCloses  = kospiData.chart.result[0].indicators.quote[0].close.filter(Boolean);
    const kospiCur     = kospiCloses[kospiCloses.length - 1];
    const kospiPrev    = kospiCloses[kospiCloses.length - 2];
    const kospiPct     = ((kospiCur - kospiPrev) / kospiPrev * 100);
    const kospiChange  = (kospiPct >= 0 ? '+' : '') + kospiPct.toFixed(2) + '%';

    const nasdaqCloses = nasdaqData.chart.result[0].indicators.quote[0].close.filter(Boolean);
    const nasdaqCur    = nasdaqCloses[nasdaqCloses.length - 1];
    const nasdaqPrev   = nasdaqCloses[nasdaqCloses.length - 2];
    const nasdaqPct    = ((nasdaqCur - nasdaqPrev) / nasdaqPrev * 100);    
    const nasdaqChange = (nasdaqPct >= 0 ? '+' : '') + nasdaqPct.toFixed(2) + '%';

    res.status(200).json({
      kospi:         kospiCur.toFixed(2),
      kospi_change:  kospiChange,
      nasdaq:        nasdaqCur.toFixed(2),
      nasdaq_change: nasdaqChange,
      usdkrw:        usdkrw,
      rate:          '2.75%',
    });
  } catch (err) {
    res.status(500).json({ error: 'fetch failed' });
  }
}
