export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  const { games, leagueLabel } = req.body;
  const gamesText = games.map(g => {
    const outcomes = g.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
    const h = outcomes.find(o => o.name === g.home_team)?.price ?? '?';
    const a = outcomes.find(o => o.name === g.away_team)?.price ?? '?';
    const d = outcomes.find(o => o.name === 'Draw')?.price ?? null;
    return `${g.home_team} vs ${g.away_team} | Heim:${h}${d?` X:${d}`:''} Gast:${a} | ${new Date(g.commence_time).toLocaleDateString('de-DE')}`;
  }).join('\n');
  const prompt = `Du bist Sportwetten-Analyst für ${leagueLabel}. Analysiere diese Spiele:\n${gamesText}\n\nAntworte NUR mit JSON:\n{"predictions":[{"match":"A vs B","prediction":"HOME","confidence":75,"risk":"safe","reasoning":"Kurz DE max 70 Zeichen","bet_tip":"Empfehlung mit Quote"}]}\n\nrisk: safe=>=75% niedrige Quote, medium=60-74%, risky=<60%`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    const text = d.content?.map(c => c.text || '').join('') || '';
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) throw new Error('No JSON');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(JSON.parse(json[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
