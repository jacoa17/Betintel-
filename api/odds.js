export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }
  const { sport } = req.query;
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`;
  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
