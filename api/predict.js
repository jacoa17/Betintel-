export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { games, leagueLabel } = req.body;
  if (!games || !games.length) return res.status(400).json({ error: 'No games provided' });

  const gamesText = games.map(g => {
    const outcomes = g.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
    const h = outcomes.find(o => o.name === g.home_team)?.price ?? '?';
    const a = outcomes.find(o => o.name === g.away_team)?.price ?? '?';
    const d = outcomes.find(o => o.name === 'Draw')?.price ?? null;
    return `${g.home_team} vs ${g.away_team} | Heim:${h}${d ? ` X:${d}` : ''} Gast:${a} | ${new Date(g.commence_time).toLocaleDateString('de-DE')}`;
  }).join('\n');

  const prompt = `Du bist Sportwetten-Analyst für ${leagueLabel}. Analysiere diese Spiele:\n${gamesText}\n\nAntworte NUR mit validem JSON:\n{"predictions":[{"match":"Team A vs Team B","prediction":"HOME","confidence":75,"risk":"safe","reasoning":"Kurze Begründung max 70 Zeichen","bet_tip":"Empfehlung mit Quote"}]}\n\nrisk: safe=>=75% niedrige Quote, medium=60-74%, risky=<60%`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
        })
      }
    );
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Kein JSON in Antwort');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
