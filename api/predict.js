export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { games, leagueLabel } = req.body || {};
  if (!games?.length) return res.status(400).json({ error: 'No games' });

  const gamesText = games.slice(0, 6).map((g, i) => {
    const outcomes = g.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
    const h = outcomes.find(o => o.name === g.home_team)?.price ?? '?';
    const a = outcomes.find(o => o.name === g.away_team)?.price ?? '?';
    const d = outcomes.find(o => o.name === 'Draw')?.price ?? null;
    return `${i+1}. ${g.home_team} vs ${g.away_team} H:${h}${d?` X:${d}`:''} A:${a}`;
  }).join('\n');

  const prompt = `Sportwetten-Analyst ${leagueLabel}. Analysiere:\n${gamesText}\n\nNur JSON:\n{"predictions":[{"match":"A vs B","prediction":"HOME","confidence":75,"risk":"safe","reasoning":"Grund DE","bet_tip":"Tipp"}]}\nrisk: safe>=75% niedrige Quote, medium 60-74%, risky<60%`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
        })
      }
    );
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: JSON.stringify(d) });
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: 'No JSON: ' + text.slice(0,200) });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
