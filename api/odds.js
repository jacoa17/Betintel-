export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sport } = req.query;
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json({ error: data?.message || 'Odds API error' });

    // Nur 1 Bookmaker pro Spiel behalten um Datenmenge zu reduzieren
    const slim = data.slice(0, 8).map(g => ({
      id: g.id,
      home_team: g.home_team,
      away_team: g.away_team,
      commence_time: g.commence_time,
      bookmakers: g.bookmakers?.slice(0, 1) || []
    }));

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(slim);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
