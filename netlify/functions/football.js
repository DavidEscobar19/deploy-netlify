// ─────────────────────────────────────────────────────────────
// Netlify Function · datos deportivos reales (football-data.org v4)
// Resultados, calendario, clasificación y goleadores. Clave secreta en
// la variable de entorno FOOTBALL_DATA_KEY (nunca en el HTML).
// El plan gratis de football-data.org sí cubre el Mundial (código "WC").
//   /.netlify/functions/football                → partidos (competición/temporada)
//   /.netlify/functions/football?action=standings
//   /.netlify/functions/football?action=topscorers
// La respuesta se normaliza al formato que ya consume el HTML
// (fixture.date, fixture.status.short, goals.home/away, teams.home/away.name)
// para no tener que tocar el front-end al cambiar de proveedor.
// ─────────────────────────────────────────────────────────────
const BASE = "https://api.football-data.org/v4";

const STATUS_MAP = {
  IN_PLAY: "LIVE", PAUSED: "HT", FINISHED: "FT", AWARDED: "FT",
  SCHEDULED: "NS", TIMED: "NS", POSTPONED: "PST", SUSPENDED: "SUSP", CANCELLED: "CANC"
};

function normMatch(m) {
  var ft = m.score && m.score.fullTime ? m.score.fullTime : {};
  return {
    fixture: { date: m.utcDate, status: { short: STATUS_MAP[m.status] || "NS" } },
    goals: { home: ft.home != null ? ft.home : null, away: ft.away != null ? ft.away : null },
    teams: {
      home: { name: m.homeTeam && m.homeTeam.name },
      away: { name: m.awayTeam && m.awayTeam.name }
    }
  };
}

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=120", // 2 min de caché (cuida el límite de 10 llamadas/min)
    "Access-Control-Allow-Origin": "*"
  };

  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: "NO_API_KEY", response: [] }) };
  }

  const q = event.queryStringParameters || {};
  const comp = q.competition || process.env.FD_COMPETITION || "WC"; // WC = Copa del Mundo
  const season = q.season || process.env.FD_SEASON || "2026";
  const action = q.action || "fixtures";

  let url;
  if (action === "standings")       url = `${BASE}/competitions/${comp}/standings?season=${season}`;
  else if (action === "topscorers") url = `${BASE}/competitions/${comp}/scorers?season=${season}`;
  else                               url = `${BASE}/competitions/${comp}/matches?season=${season}`;

  try {
    const r = await fetch(url, { headers: { "X-Auth-Token": key } });
    const j = await r.json();
    if (!r.ok) {
      return { statusCode: 200, headers,
        body: JSON.stringify({ ok: false, error: j.message || String(r.status), response: [] }) };
    }
    let response = [];
    if (action === "standings")       response = j.standings || [];
    else if (action === "topscorers") response = j.scorers || [];
    else                               response = (j.matches || []).map(normMatch);
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: true, action, updated: Date.now(), response }) };
  } catch (e) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: String(e), response: [] }) };
  }
};
