// ─────────────────────────────────────────────────────────────
// Netlify Function · proxy de datos en vivo (The Odds API)
// La clave de la API vive AQUÍ, en una variable de entorno del
// servidor (ODDS_API_KEY). Nunca llega al navegador ni al HTML.
// La web llama a  /.netlify/functions/live  y recibe JSON.
//
// El plan gratuito son 500 créditos/mes y cada llamada gasta ~4
// (odds: markets×regions, scores con daysFrom>1: 2). Sin caché se
// agota en dos días. Por eso cacheamos en tres capas: memoria del
// contenedor caliente, CDN de Netlify y navegador.
// ─────────────────────────────────────────────────────────────
const API = "https://api.the-odds-api.com/v4";

// TTL de la caché en memoria del contenedor (se reutiliza mientras esté caliente).
const TTL_MS = 30 * 60 * 1000; // 30 min
let cache = null; // { at:Number, payload:Object }

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    // Navegador: poco tiempo. CDN de Netlify: mucho, con revalidación en segundo plano.
    "Cache-Control": "public, max-age=120",
    "Netlify-CDN-Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*"
  };

  const key = process.env.ODDS_API_KEY;
  if (!key) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: "NO_API_KEY", odds: [], scores: [] }) };
  }

  // Caché caliente: evita gastar créditos en llamadas seguidas.
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { statusCode: 200, headers,
      body: JSON.stringify(Object.assign({}, cache.payload, { cached: true })) };
  }

  const q = event.queryStringParameters || {};
  const sport = q.sport || process.env.ODDS_SPORT || "soccer_fifa_world_cup";

  try {
    const oddsUrl  = `${API}/sports/${sport}/odds/?apiKey=${key}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
    const scoreUrl = `${API}/sports/${sport}/scores/?apiKey=${key}&daysFrom=3`;

    const [or, sr] = await Promise.all([ fetch(oddsUrl), fetch(scoreUrl) ]);
    const remaining = or.headers.get("x-requests-remaining");

    // Si la API rechaza (401 clave inválida, 429 cuota agotada…), NO lo ocultamos:
    // devolvemos el motivo para que la web pueda decirlo honestamente en pantalla.
    if (!or.ok) {
      const detalle = await or.text().catch(() => "");
      const agotada = or.status === 429 || remaining === "0" || /quota/i.test(detalle);
      const payload = {
        ok: false,
        error: agotada ? "QUOTA" : "UPSTREAM_" + or.status,
        status: or.status,
        remaining: remaining,
        detalle: detalle.slice(0, 200),
        odds: [], scores: []
      };
      // Un fallo de cuota se cachea también: no tiene sentido reintentar cada minuto.
      cache = { at: Date.now(), payload };
      return { statusCode: 200, headers, body: JSON.stringify(payload) };
    }

    const odds   = await or.json();
    const scores = sr.ok ? await sr.json() : [];

    const payload = {
      ok: true,
      sport,
      updated: Date.now(),
      remaining: remaining,
      // Cuota casi agotada: la web puede avisar antes de quedarse a cero.
      lowQuota: remaining != null && Number(remaining) < 25,
      odds: Array.isArray(odds) ? odds : [],
      scores: Array.isArray(scores) ? scores : []
    };
    cache = { at: Date.now(), payload };
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (e) {
    return { statusCode: 200, headers,
      body: JSON.stringify({ ok: false, error: "FETCH_FAIL", detalle: String(e), odds: [], scores: [] }) };
  }
};
