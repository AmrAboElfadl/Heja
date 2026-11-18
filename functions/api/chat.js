// Cloudflare Pages Function: Heja AI shopping assistant via OpenRouter (POST /api/chat).
// The OpenRouter key lives only in Cloudflare's environment variables, never in the browser.
//
// Cloudflare → Workers & Pages → heja → Settings → Variables and Secrets:
//   OPENROUTER_API_KEY  (required, type "Secret")  your key from openrouter.ai/keys
//   OPENROUTER_MODEL    (optional)  defaults to the free-models router
//   SUPABASE_URL, SUPABASE_ANON_KEY (optional) so the assistant knows the live catalog

const MAX_MESSAGES = 12;
const MAX_CHARS = 800;

let catalogCache = { text: "", at: 0 };

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

async function getCatalog(env) {
  if (catalogCache.text && Date.now() - catalogCache.at < 5 * 60 * 1000) return catalogCache.text;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) return "";
  try {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const [r, vr] = await Promise.all([
      fetch(`${url}/rest/v1/products?select=id,name,category,price,old_price,sizes,description,fabric,fit&active=eq.true&order=sort_order`, { headers }),
      fetch(`${url}/rest/v1/product_variants?select=product_id,color,size,stock`, { headers })
    ]);
    if (!r.ok) return catalogCache.text;
    const rows = await r.json();
    const variants = vr.ok ? await vr.json() : [];
    const inStock = (id) => {
      const byColour = {};
      variants.filter((v) => v.product_id === id && v.stock > 0).forEach((v) => { (byColour[v.color] = byColour[v.color] || []).push(v.size); });
      const parts = Object.entries(byColour).map(([c, s]) => `${c} (${s.join("/")})`);
      return parts.length ? `in stock: ${parts.join(", ")}` : "currently sold out";
    };
    const text = rows
      .map((p) => `- ${p.name} (${p.category}): ${p.price} USD${p.old_price ? ` (was ${p.old_price})` : ""}; ${p.fit ? p.fit + " fit; " : ""}${p.fabric ? p.fabric + " " : ""}${inStock(p.id)}. ${p.description}`)
      .join("\n");
    catalogCache = { text, at: Date.now() };
    return text;
  } catch {
    return catalogCache.text;
  }
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return json({ error: "Assistant is not configured yet." }, 503);

  let body = {};
  try { body = await request.json(); } catch {}
  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const messages = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "Send a question." }, 400);
  }

  const currency = typeof body.currency === "string" ? body.currency.slice(0, 8) : "";
  const catalog = await getCatalog(env);
  const system = [
    "You are the friendly shopping assistant for Heja, an online store for women's clothing, bags and accessories.",
    "Help customers pick products, sizes and outfits. Keep answers short (2-4 sentences), warm and practical.",
    "Reply in the same language the customer writes in (English, Arabic or Persian).",
    "Only recommend products from the catalog below and never invent prices, stock or discounts. Only suggest colours and sizes listed as in stock.",
    "Ordering: customers add items to the cart and check out; the customer then sends the order receipt to Heja on WhatsApp and pays by bank transfer (Heja sends the bank details on WhatsApp).",
    "If you don't know something (e.g. delivery time to a specific area), suggest contacting Heja on WhatsApp.",
    currency && currency !== "USD" ? `The customer is viewing prices in ${currency}; catalog prices are in USD and the website shows the converted price.` : "",
    catalog ? `Catalog:\n${catalog}` : "The catalog is shown on the website."
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": new URL(request.url).origin,
        "X-Title": "Heja Store"
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || "openrouter/free",
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: 350,
        temperature: 0.6
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("OpenRouter error", r.status, JSON.stringify(data?.error || {}));
      return json({ error: "The assistant is busy, please try again." }, 502);
    }
    const reply = data?.choices?.[0]?.message?.content?.trim();
    return json({ reply: reply || "Sorry, I couldn't answer that. Please try again." });
  } catch (e) {
    console.error(e);
    return json({ error: "The assistant is unavailable right now." }, 502);
  }
}

export function onRequest() {
  return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
}
