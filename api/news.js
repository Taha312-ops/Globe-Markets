export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const { type, country, countryName, market } = body;

    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

    // ── NEWS button ──────────────────────────────────────────────
    if (type === 'news' || type === 'worldwide') {
      if (!NEWS_API_KEY) return res.status(500).json({ error: 'NEWS_API_KEY not set' });

      const query = type === 'worldwide'
        ? 'finance OR economy OR stock market OR trading'
        : `${countryName} finance OR economy OR stock market`;

      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=6&apiKey=${NEWS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'ok') {
        return res.status(500).json({ error: data.message || 'NewsAPI error' });
      }

      const articles = data.articles.map(a => ({
        title: a.title,
        summary: a.description || 'No description available.',
        source: a.source.name,
        url: a.url,
        time: new Date(a.publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sentiment: 'neutral',
      }));

      return res.status(200).json({ articles });
    }

    // ── MARKET button ────────────────────────────────────────────
    if (type === 'market') {
      if (!ALPHA_VANTAGE_KEY) return res.status(500).json({ error: 'ALPHA_VANTAGE_KEY not set' });

      // Map country to relevant stock symbols
      const symbolMap = {
        US: ['SPY', 'QQQ', 'DIA'],
        GB: ['HSBC', 'BP', 'GSK'],
        DE: ['SIEGY', 'VOWG', 'DTE'],
        FR: ['LVMUY', 'TOTF', 'SNYNF'],
        JP: ['TM', 'SONY', '7203.T'],
        CN: ['BABA', 'JD', 'BIDU'],
        IN: ['INFY', 'WIT', 'HDB'],
        BR: ['VALE', 'ITUB', 'PBR'],
        CA: ['SHOP', 'CNR', 'RY'],
        AU: ['BHP', 'CBA', 'RIO'],
        RU: ['SBER', 'GAZP', 'LKOH'],
        KR: ['005930.KS', 'SSNLF', '000660.KS'],
        MX: ['AMXL', 'WALMEX', 'FEMSAUBD'],
        ZA: ['NPN', 'SOL', 'ABG'],
        SA: ['2222.SR', 'AL-RAJHI', 'SABIC'],
        SG: ['D05.SI', 'O39.SI', 'Z74.SI'],
        CH: ['NESN', 'ROG', 'NOVN'],
        NG: ['DANGCEM', 'GTCO', 'ZENITHBANK'],
        AR: ['YPF', 'GGAL', 'PAM'],
        AE: ['DIB', 'FAB', 'EMAAR'],
      };

      const symbols = symbolMap[country] || ['SPY'];
      const results = [];

      for (const symbol of symbols.slice(0, 3)) {
        try {
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
          const r = await fetch(url);
          const d = await r.json();
          const q = d['Global Quote'];
          if (q && q['05. price']) {
            const change = parseFloat(q['09. change']);
            results.push({
              title: `${symbol}: $${parseFloat(q['05. price']).toFixed(2)}`,
              summary: `Open: $${parseFloat(q['02. open']).toFixed(2)} · High: $${parseFloat(q['03. high']).toFixed(2)} · Low: $${parseFloat(q['04. low']).toFixed(2)} · Volume: ${parseInt(q['06. volume']).toLocaleString()}`,
              source: `${market} · ${q['07. latest trading day']}`,
              url: `https://finance.yahoo.com/quote/${symbol}`,
              time: q['07. latest trading day'],
              sentiment: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral',
              change: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${q['10. change percent']})`,
            });
          }
        } catch (e) {
          console.error(`Symbol ${symbol} error:`, e.message);
        }
      }

      if (results.length === 0) {
        return res.status(500).json({ error: 'Could not fetch market data. Alpha Vantage rate limit may have been reached.' });
      }

      return res.status(200).json({ articles: results });
    }

    return res.status(400).json({ error: 'Invalid type. Use news, worldwide, or market.' });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
