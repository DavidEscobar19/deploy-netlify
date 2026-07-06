// ─────────────────────────────────────────────────────────────
// Netlify Function · datos deportivos reales (API-Football v3)
// Resultados, marcadores en vivo, calendario, estadísticas,
// clasificación, goleadores y alineaciones. Clave secreta en
// la variable de entorno API_FOOTBALL_KEY (nunca en el HTML).
//   /.netlify/functions/football                → fixtures (liga/temporada)
//   /.netlify/functions/football?action=stats&fixture=ID
//   /.netlify/functions/football?action=lineups&fixture=ID
//   /.netlify/functions/football?action=standings
//   /.netlify/functions/football?action=topscorers
// ─────────────────────────────────────────────────────────────
const BASE = "https://v3.football.api-sports.io";

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=120", // 2 min de caché (cuida la cuota diaria)
    "Access-Control-Allow-Origin": "*"
  };

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: "NO_API_KEY", response: [] }) };
  }

  const q = event.queryStringParameters || {};
  const league = q.league || process.env.AF_LEAGUE || "1";     // 1 = Copa del Mundo
  const season = q.season || process.env.AF_SEASON || "2026";
  const action = q.action || "fixtures";

  let url;
  if (action === "stats")        url = `${BASE}/fixtures/statistics?fixture=${encodeURIComponent(q.fixture || "")}`;
  else if (action === "lineups") url = `${BASE}/fixtures/lineups?fixture=${encodeURIComponent(q.fixture || "")}`;
  else if (action === "standings")  url = `${BASE}/standings?league=${league}&season=${season}`;
  else if (action === "topscorers") url = `${BASE}/players/topscorers?league=${league}&season=${season}`;
  else                           url = `${BASE}/fixtures?league=${league}&season=${season}`;

  try {
    const r = await fetch(url, { headers: { "x-apisports-key": key } });
    const j = await r.json();
    return { statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        action,
        updated: Date.now(),
        results: j.results,
        errors: j.errors,
        response: Array.isArray(j.response) ? j.response : []
      }) };
  } catch (e) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: String(e), response: [] }) };
  }
};
