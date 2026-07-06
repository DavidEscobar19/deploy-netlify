// ─────────────────────────────────────────────────────────────
// Netlify Function · proxy de datos en vivo (The Odds API)
// La clave de la API vive AQUÍ, en una variable de entorno del
// servidor (ODDS_API_KEY). Nunca llega al navegador ni al HTML.
// La web llama a  /.netlify/functions/live  y recibe JSON.
// ─────────────────────────────────────────────────────────────
const API = "https://api.the-odds-api.com/v4";

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300", // 5 min de caché en el CDN
    "Access-Control-Allow-Origin": "*"
  };

  const key = process.env.ODDS_API_KEY;
  // Sin clave: respondemos OK pero vacío, para que la web no se rompa.
  if (!key) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: "NO_API_KEY", odds: [], scores: [] }) };
  }

  const q = event.queryStringParameters || {};
  const sport = q.sport || process.env.ODDS_SPORT || "soccer_fifa_world_cup";

  try {
    const oddsUrl  = `${API}/sports/${sport}/odds/?apiKey=${key}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
    const scoreUrl = `${API}/sports/${sport}/scores/?apiKey=${key}&daysFrom=3`;

    const [or, sr] = await Promise.all([ fetch(oddsUrl), fetch(scoreUrl) ]);
    const remaining = or.headers.get("x-requests-remaining");

    const odds   = or.ok ? await or.json() : [];
    const scores = sr.ok ? await sr.json() : [];

    // Si el deporte no está en temporada, odds puede venir vacío: lo indicamos.
    return { statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        sport,
        updated: Date.now(),
        remaining: remaining,
        odds: Array.isArray(odds) ? odds : [],
        scores: Array.isArray(scores) ? scores : []
      }) };
  } catch (e) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: String(e), odds: [], scores: [] }) };
  }
};
