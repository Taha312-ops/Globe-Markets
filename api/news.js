cat > /mnt/user-data/outputs/news.js << 'EOF'
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
  if (!FINNHUB_KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY not set' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const { type, countryCode, countryName } = body;

    // ── WORLDWIDE or NEWS ─────────────────────────────────────────
    if (type === 'worldwide' || type === 'news') {
      const category = type === 'worldwide' ? 'general' : 'general';
      const url = type === 'news'
        ? `https://finnhub.io/api/v1/news?category=general&minId=0&token=${FINNHUB_KEY}`
        : `https://finnhub.io/api/v1/news?category=general&minId=0&token=${FINNHUB_KEY}`;

      // For country-specific news, search company news for major companies in that country
      let articles = [];

      if (type === 'news' && countryCode !== 'US') {
        // Use market news filtered by country keywords
        const newsUrl = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
        const r = await fetch(newsUrl);
        const data = await r.json();
        if (Array.isArray(data)) {
          articles = data
            .filter(a => a.headline && a.summary)
            .filter(a =>
              a.headline.toLowerCase().includes(countryName.toLowerCase()) ||
              a.summary.toLowerCase().includes(countryName.toLowerCase())
            )
            .slice(0, 8);

          // If no country-specific articles, fallback to latest general
          if (articles.length < 3) {
            articles = data.filter(a => a.headline && a.summary).slice(0, 8);
          }
        }
      } else {
        const newsUrl = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
        const r = await fetch(newsUrl);
        const data = await r.json();
        if (Array.isArray(data)) {
          articles = data.filter(a => a.headline && a.summary).slice(0, 8);
        }
      }

      const mapped = articles.map(a => ({
        title: a.headline,
        summary: a.summary,
        source: a.source,
        url: a.url,
        image: a.image || null,
        time: new Date(a.datetime * 1000).toLocaleString('en-US', {
          month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        sentiment: 'neutral',
      }));

      return res.status(200).json({ articles: mapped });
    }

    // ── MARKET ────────────────────────────────────────────────────
    if (type === 'market') {
      const symbolsMap = {
        US: ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','JPM','V','WMT','JNJ','XOM','BAC','MA','PG'],
        GB: ['HSBA.L','BP.L','GSK.L','SHEL.L','AZN.L','LLOY.L','BARC.L','VOD.L','RIO.L','BT-A.L','ULVR.L','RR.L','NG.L','SSE.L','IMB.L'],
        DE: ['SAP.DE','SIE.DE','ALV.DE','MRK.DE','DTE.DE','MUV2.DE','BMW.DE','VOW3.DE','BAS.DE','DBK.DE','ADS.DE','RWE.DE','LIN.DE','HEN3.DE','FRE.DE'],
        FR: ['MC.PA','TTE.PA','SAN.PA','OR.PA','AIR.PA','BNP.PA','SU.PA','KER.PA','RI.PA','CS.PA','DG.PA','ACA.PA','LR.PA','ORA.PA','PUB.PA'],
        JP: ['7203.T','9984.T','6758.T','8306.T','9432.T','7267.T','4519.T','6861.T','8316.T','9433.T','7741.T','4063.T','6367.T','8411.T','9022.T'],
        CN: ['BABA','JD','BIDU','NIO','XPEV','PDD','TME','BILI','IQ','VIPS','LI','TAL','YUMC','ZTO','CTRP'],
        IN: ['INFY','WIT','HDB','IBN','SIFY','VEDL','REDB','INDM','ICICI','AXBK','HDBK','BHARTIARTL','WIPRO','TECHM','LTIM'],
        BR: ['VALE','ITUB','PBR','BBD','ABEV','SID','ELP','GGB','CIG','ERJ','BRFS','TIMB','VIVO','AZUL','GOL'],
        CA: ['SHOP','CNR','RY','TD','BNS','BMO','CP','ENB','TRI','BCE','MFC','POW','PPL','WCN','CNQ'],
        AU: ['BHP','RIO','FMG','CBA','ANZ','WBC','NAB','MQG','WES','WOW','CSL','TCL','GMG','RMD','AMC'],
        RU: ['SBER','GAZP','LKOH','NVTK','ROSN','GMKN','TATN','MGNT','MTSS','AFLT','POLY','PHOR','ALRS','RTKM','FEES'],
        KR: ['005930.KS','000660.KS','035420.KS','051910.KS','005380.KS','068270.KS','055550.KS','105560.KS','028260.KS','003550.KS','017670.KS','030200.KS','032830.KS','086790.KS','018260.KS'],
        MX: ['AMXL.MX','WALMEX.MX','FEMSAUBD.MX','CEMEXCPO.MX','GFINBURO.MX','TLEVISACPO.MX','BIMBOA.MX','GRUMAB.MX','ALSEA.MX','GMEXICOB.MX','KOFUBL.MX','LABB.MX','IENOVA.MX','CUERVO.MX','ORBIA.MX'],
        ZA: ['BTI','NPN.JO','SOL.JO','ABG.JO','FSR.JO','SBK.JO','MTN.JO','IMP.JO','AGL.JO','REM.JO','CFR.JO','TBS.JO','VOD.JO','BVT.JO','EXX.JO'],
        SA: ['2222.SR','1180.SR','1120.SR','2010.SR','1211.SR','2050.SR','7010.SR','3160.SR','4200.SR','2380.SR','1020.SR','1030.SR','2040.SR','1060.SR','4030.SR'],
        SG: ['D05.SI','O39.SI','U11.SI','Z74.SI','G13.SI','C31.SI','BN4.SI','A17U.SI','ME8U.SI','C38U.SI','J69U.SI','K71U.SI','N2IU.SI','M44U.SI','T82U.SI'],
        CH: ['NESN.SW','ROG.SW','NOVN.SW','ABBN.SW','UBSG.SW','CFR.SW','ZURN.SW','CSGN.SW','SREN.SW','LONN.SW','GEBN.SW','SLHN.SW','SCMN.SW','AMS.SW','PGHN.SW'],
        NG: ['DANGCEM.LG','GTCO.LG','ZENITHBANK.LG','MTNN.LG','AIRTELAFRI.LG','ACCESS.LG','UBA.LG','FBNH.LG','BUACEMENT.LG','SEPLAT.LG','NESTLE.LG','NB.LG','PRESCO.LG','OKOMUOIL.LG','TRANSCORP.LG'],
        AR: ['YPF','GGAL','PAM','TGS','CEPU','BBAR','SUPV','LOMA','EDN','IRSA','BMA','MELI','GLOB','BIOX','CRESY'],
        AE: ['EMAAR.DU','DIB.DU','FAB.AD','ADCB.AD','ALDAR.AD','ETISALAT.AD','DU.DU','DAMAC.DU','AIRARABIA.DU','DEWA.DU','SALIK.DU','ADNOC.AD','TAQA.AD','FERTIGLOBE.AD','MUBADALA.AD'],
      };

      const symbols = symbolsMap[countryCode] || symbolsMap['US'];
      const results = [];

      // Fetch all symbols in parallel
      const fetches = symbols.map(symbol =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`)
          .then(r => r.json())
          .then(q => {
            if (q && q.c && q.c > 0) {
              const change = q.d || 0;
              const changePct = q.dp || 0;
              results.push({
                title: `${symbol.replace(/\.[A-Z]+$/, '')}  $${q.c.toFixed(2)}`,
                summary: `Open: $${q.o?.toFixed(2)} · High: $${q.h?.toFixed(2)} · Low: $${q.l?.toFixed(2)} · Prev Close: $${q.pc?.toFixed(2)}`,
                source: symbol,
                url: `https://finance.yahoo.com/quote/${symbol}`,
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                sentiment: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral',
                change: `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`,
              });
            }
          })
          .catch(() => {})
      );

      await Promise.all(fetches);

      if (results.length === 0) {
        return res.status(500).json({ error: 'No market data returned. Check Finnhub API key.' });
      }

      // Sort by absolute % change descending
      results.sort((a, b) => {
        const getPct = x => Math.abs(parseFloat(x.change?.match(/([-\d.]+)%/)?.[1] || 0));
        return getPct(b) - getPct(a);
      });

      return res.status(200).json({ articles: results });
    }

    return res.status(400).json({ error: 'Invalid type' });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
EOF
echo "done"
