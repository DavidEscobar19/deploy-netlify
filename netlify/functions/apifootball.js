// ─────────────────────────────────────────────────────────────
// Netlify Function · API-Football (api-sports.io) — fuente licenciada
// La clave vive en la variable de entorno APIFOOTBALL_KEY del servidor;
// nunca llega al navegador. La web llama a /.netlify/functions/apifootball
//
// Acciones (?a=):
//   live      (por defecto) fixtures del torneo + cuotas de los próximos cruces
//   lineups   ?fixture=ID   alineaciones oficiales (se publican ~1 h antes)
//   squad     ?team=ID      plantilla completa
//   player    ?id=ID        ficha y estadísticas del jugador
//   injuries  ?fixture=ID   bajas y lesiones reales
//
// Las cuotas se devuelven con el MISMO formato que The Odds API para que el
// frontend (oddsPara/h2hDe/totalsDe) siga funcionando sin cambios.
// ─────────────────────────────────────────────────────────────
const BASE = "https://v3.football.api-sports.io";
const LEAGUE = 1;      // Copa Mundial de la FIFA
const SEASON = 2026;

// Caché en memoria del contenedor caliente. Cada acción con su propio TTL:
// una plantilla no cambia en todo el torneo; una alineación sí.
const TTL = { live: 15 * 60e3, lineups: 60e3, squad: 24 * 3600e3, player: 12 * 3600e3, injuries: 30 * 60e3, topscorers: 30 * 60e3,
              fixstats: 6 * 3600e3, events: 6 * 3600e3, fixplayers: 6 * 3600e3, h2h: 24 * 3600e3 };
const cache = new Map();

function fromCache(k) {
  const hit = cache.get(k);
  if (hit && Date.now() < hit.exp) return hit.val;
  if (hit) cache.delete(k);
  return null;
}
function putCache(k, val, ttl) { cache.set(k, { val, exp: Date.now() + ttl }); }

async function af(path, key) {
  const r = await fetch(BASE + path, { headers: { "x-apisports-key": key } });
  if (!r.ok) throw new Error("API_" + r.status);
  const j = await r.json();
  if (j.errors && !Array.isArray(j.errors) && Object.keys(j.errors).length) {
    throw new Error("API_ERR_" + JSON.stringify(j.errors).slice(0, 80));
  }
  return j.response || [];
}

/* "Quarter-finals" → CUARTOS. Sin adivinar por fecha: lo dice la propia API. */
function rondaDe(round) {
  const r = (round || "").toLowerCase();
  if (r.includes("quarter")) return "CUARTOS";
  if (r.includes("semi")) return "SEMIFINAL";
  if (r.includes("3rd place") || r.includes("third place")) return "TERCER PUESTO";
  if (r.includes("final")) return "FINAL";
  if (r.includes("round of 16") || r.includes("8th")) return "OCTAVOS";
  return null;
}

/* Convierte los mercados de API-Football al formato de The Odds API.
   Usamos la casa con más mercados publicados y decimos cuál es. */
function aOddsApi(fixture, oddsResp) {
  const home = fixture.teams.home.name, away = fixture.teams.away.name;
  const books = (oddsResp[0] && oddsResp[0].bookmakers) || [];
  if (!books.length) return null;
  const bk = books.slice().sort((a, b) => (b.bets || []).length - (a.bets || []).length)[0];
  const bet = (id) => (bk.bets || []).filter((b) => b.id === id)[0];

  const outcomes = [];
  const mw = bet(1); // Match Winner
  if (mw) {
    mw.values.forEach((v) => {
      const n = v.value === "Home" ? home : v.value === "Away" ? away : "Draw";
      outcomes.push({ name: n, price: parseFloat(v.odd) });
    });
  }
  const totals = [];
  const ou = bet(5); // Goals Over/Under → "Over 2.5" / "Under 2.5"
  if (ou) {
    ou.values.forEach((v) => {
      const m = /^(Over|Under)\s+([\d.]+)$/.exec(v.value);
      if (m) totals.push({ name: m[1], point: parseFloat(m[2]), price: parseFloat(v.odd) });
    });
  }
  if (!outcomes.length) return null;

  const markets = [{ key: "h2h", outcomes }];
  if (totals.length) markets.push({ key: "totals", outcomes: totals });
  return {
    home_team: home, away_team: away,
    commence_time: fixture.fixture.date,
    bookmakers: [{ key: bk.name, title: bk.name, markets }]
  };
}

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=120",
    "Netlify-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*"
  };
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: "NO_API_KEY", odds: [], fixtures: [] }) };
  }

  const q = event.queryStringParameters || {};
  const a = q.a || "live";
  const ck = a + ":" + (q.fixture || q.team || q.id || "");
  const hit = fromCache(ck);
  if (hit) return { statusCode: 200, headers, body: JSON.stringify(Object.assign({}, hit, { cached: true })) };

  try {
    let payload;

    if (a === "lineups") {
      payload = { ok: true, lineups: await af(`/fixtures/lineups?fixture=${encodeURIComponent(q.fixture)}`, key) };
    } else if (a === "squad") {
      const r = await af(`/players/squads?team=${encodeURIComponent(q.team)}`, key);
      payload = { ok: true, squad: (r[0] && r[0].players) || [], team: r[0] && r[0].team };
    } else if (a === "player") {
      const r = await af(`/players?id=${encodeURIComponent(q.id)}&season=${SEASON}`, key);
      payload = { ok: true, player: r[0] || null };
    } else if (a === "injuries") {
      payload = { ok: true, injuries: await af(`/injuries?fixture=${encodeURIComponent(q.fixture)}`, key) };
    } else if (a === "fixstats") {
      // Estadísticas oficiales del partido (posesión, tiros, córners, faltas…)
      payload = { ok: true, stats: await af(`/fixtures/statistics?fixture=${encodeURIComponent(q.fixture)}`, key) };
    } else if (a === "events") {
      // Cronología: goles (autor y minuto), tarjetas, penaltis
      const r = await af(`/fixtures/events?fixture=${encodeURIComponent(q.fixture)}`, key);
      payload = { ok: true, events: r.map((e) => ({
        min: e.time && e.time.elapsed, extra: e.time && e.time.extra,
        team: e.team && e.team.name, player: e.player && e.player.name,
        assist: e.assist && e.assist.name, type: e.type, detail: e.detail
      })) };
    } else if (a === "fixplayers") {
      // Notas (ratings) y números de cada jugador en ese partido
      const r = await af(`/fixtures/players?fixture=${encodeURIComponent(q.fixture)}`, key);
      payload = { ok: true, teams: r.map((t) => ({
        team: t.team && t.team.name,
        players: (t.players || []).map((p) => {
          const s = (p.statistics && p.statistics[0]) || {};
          return { id: p.player.id, n: p.player.name,
                   pos: s.games && s.games.position, min: s.games && s.games.minutes,
                   rating: s.games && s.games.rating ? parseFloat(s.games.rating) : null,
                   g: (s.goals && s.goals.total) || 0, a: (s.goals && s.goals.assists) || 0,
                   y: (s.cards && s.cards.yellow) || 0, r: (s.cards && s.cards.red) || 0 };
        })
      })) };
    } else if (a === "h2h") {
      // Cara a cara real entre dos equipos (por id), todos los torneos
      const r = await af(`/fixtures/headtohead?h2h=${encodeURIComponent(q.t1)}-${encodeURIComponent(q.t2)}&last=12`, key);
      payload = { ok: true, h2h: r.map((f) => ({
        date: f.fixture.date, status: f.fixture.status.short,
        home: f.teams.home.name, away: f.teams.away.name,
        gh: f.goals.home, ga: f.goals.away,
        pen: (f.score && f.score.penalty && f.score.penalty.home != null) ? f.score.penalty : null,
        comp: (f.league && f.league.name ? f.league.name : "") + (f.league && f.league.season ? " " + f.league.season : "")
      })) };
    } else if (a === "topscorers") {
      // Bota de Oro real del torneo, reducida a lo que pinta la web.
      const r = await af(`/players/topscorers?league=${LEAGUE}&season=${SEASON}`, key);
      payload = { ok: true, updated: Date.now(), scorers: r.slice(0, 12).map((x) => {
        const s = (x.statistics && x.statistics[0]) || {};
        return { id: x.player.id, n: x.player.name, team: s.team && s.team.name,
                 g: (s.goals && s.goals.total) || 0, a: (s.goals && s.goals.assists) || 0,
                 pj: (s.games && s.games.appearences) || 0, min: (s.games && s.games.minutes) || 0 };
      }) };
    } else {
      // ── live: calendario del torneo + cuotas de los cruces por jugar ──
      const fx = await af(`/fixtures?league=${LEAGUE}&season=${SEASON}`, key);

      const fixtures = fx.map((f) => ({
        id: f.fixture.id,
        date: f.fixture.date,
        status: f.fixture.status.short,
        round: f.league.round,
        ronda: rondaDe(f.league.round),
        venue: f.fixture.venue && f.fixture.venue.name
          ? f.fixture.venue.name + (f.fixture.venue.city ? ", " + f.fixture.venue.city : "")
          : null,
        home: { id: f.teams.home.id, name: f.teams.home.name },
        away: { id: f.teams.away.id, name: f.teams.away.name },
        goals: f.goals,
        // designación arbitral oficial cuando la API la publica; null si no
        referee: f.fixture.referee || null,
        // Quién pasa lo dice la API, no lo deducimos del marcador: en una tanda de
        // penaltis el resultado es 0–0 y aun así hay un clasificado.
        winner: f.teams.home.winner === true ? "home" : (f.teams.away.winner === true ? "away" : null),
        pen: (f.score && f.score.penalty && f.score.penalty.home != null) ? f.score.penalty : null,
        et: (f.score && f.score.extratime && f.score.extratime.home != null) ? f.score.extratime : null
      }));

      // Solo pedimos cuotas de los cruces aún por jugar (hoy son 3 → 3 peticiones).
      const pend = fx.filter((f) => f.fixture.status.short === "NS").slice(0, 6);
      const odds = [];
      for (const f of pend) {
        try {
          const o = await af(`/odds?fixture=${f.fixture.id}`, key);
          const ev = aOddsApi(f, o);
          if (ev) odds.push(ev);
        } catch (e) { /* una casa sin cuotas no debe tumbar el resto */ }
      }
      payload = { ok: true, updated: Date.now(), fixtures, odds, scores: [] };
    }

    putCache(ck, payload, TTL[a] || TTL.live);
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (e) {
    // No fallamos en silencio: la web debe poder decir por qué no hay datos.
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: String(e.message || e), odds: [], fixtures: [] }) };
  }
};
