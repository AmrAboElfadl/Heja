// Vercel serverless function: daily exchange rates for display prices (EGP base).
// Uses the free open.er-api.com feed (no key). Only AED, USD and EUR are returned;
// the Iranian toman rate is set by the shop in config.js and never fetched.
// Responses are cached at the edge for 6 hours.

const WANT = ["AED", "USD", "EUR"];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/EGP");
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.result !== "success" || !data.rates) throw new Error("rates unavailable");
    const rates = {};
    for (const code of WANT) {
      const v = Number(data.rates[code]);
      if (Number.isFinite(v) && v > 0) rates[code] = v;
    }
    if (Object.keys(rates).length === 0) throw new Error("rates missing");
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ base: "EGP", rates, updated: data.time_last_update_utc || null });
  } catch (e) {
    console.error("rates", e.message);
    res.setHeader("Cache-Control", "public, s-maxage=600");
    return res.status(503).json({ error: "Rates unavailable" });
  }
}
