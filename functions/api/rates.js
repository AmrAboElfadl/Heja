// Cloudflare Pages Function: daily exchange rates for display prices (GET /api/rates, USD base).
// Uses the free open.er-api.com feed (no key). Only AED and EUR are returned;
// the Iranian toman rate is set by the shop in the dashboard and never fetched.
// Results are kept in Cloudflare's cache for 6 hours.

const WANT = ["AED", "EUR"];

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/rates", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.result !== "success" || !data.rates) throw new Error("rates unavailable");
    const rates = {};
    for (const code of WANT) {
      const v = Number(data.rates[code]);
      if (Number.isFinite(v) && v > 0) rates[code] = v;
    }
    if (Object.keys(rates).length === 0) throw new Error("rates missing");
    const res = new Response(JSON.stringify({ base: "USD", rates, updated: data.time_last_update_utc || null }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=21600" }
    });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    console.error("rates", e.message);
    return new Response(JSON.stringify({ error: "Rates unavailable" }), {
      status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" }
    });
  }
}

export function onRequest() {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", Allow: "GET" }
  });
}
