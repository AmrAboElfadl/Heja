# Heja — Clothing Store Website

A fast, mobile-friendly clothing shop built entirely on **free tiers**:

| Service | What it does | Cost |
|---|---|---|
| **GitHub** | Stores the code; every push redeploys the site | Free |
| **Vercel** | Hosts the website + the AI assistant function | Free (Hobby) |
| **Supabase** | Database for products, orders and settings, plus photo storage | Free |
| **OpenRouter** | AI style assistant (free models) | Free |

Customers browse, pick sizes, add to cart and check out. Each order is **saved in
Supabase** (prices are recalculated on the server, so they can't be tampered with)
and sent to you on **WhatsApp** (or email). Customers pay cash on delivery.

## How it fits together

```
Browser ──► Vercel (index.html, app.js …)
   │            └── /api/chat ──► OpenRouter (key stays on the server)
   └──────────► Supabase: read products · place_order() · settings
```

## Setup

### 1. Supabase
1. Create a project at supabase.com (free plan allows 2 active projects).
2. SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Project Settings → API: copy the **Project URL** and the **anon / publishable key**
   into `config.js` (`supabaseUrl`, `supabaseAnonKey`). This key is safe to be public:
   visitors can only read products and place orders.

**Managing the shop** (no code needed, in Supabase → Table Editor):
- `products`: add, edit or hide (`active` = false) products, and change prices.
- `orders` / `order_items`: see every order and update `status` (new → confirmed → shipped → delivered).
- `store_settings`: shipping fee and free-shipping threshold.
- `promo_codes`: create discount codes (UPPERCASE `code`, plus `percent_off` **or** `amount_off`;
  optional `min_subtotal` and `expires_at`; untick `active` to stop a code). `WELCOME10` is the newsletter reward.
- `subscribers`: newsletter sign-ups (export as CSV from the Table Editor).
- `products.name_ar` / `description_ar`: Arabic text shown when visitors switch to Arabic.
- Order tracking: customers enter their order number + phone; they see the `status` you set on the order.
- Photos: Storage → `product-images` → upload, copy the public URL into the product's `image`.

### 2. OpenRouter
1. Create a free account at openrouter.ai → Keys → create a key.
2. Don't put it in any file. It goes into Vercel (next step).

### 3. Vercel
1. vercel.com → Add New Project → import the `heja` GitHub repo (no build settings needed).
2. Settings → Environment Variables:
   - `OPENROUTER_API_KEY`: your OpenRouter key (required for the assistant)
   - `OPENROUTER_MODEL`: optional, defaults to `openrouter/free` (OpenRouter's free-models router)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`: optional, so the assistant knows the live catalog
3. Redeploy. Your site is live at `https://heja-xxx.vercel.app`.

### 4. Your details
Edit `config.js`: WhatsApp number, email, currency and social links.

## Preview locally

```bash
python3 -m http.server 8000
```

This works without Supabase (it falls back to `products.js`). The assistant only works on Vercel.

## Files

| File | What it is |
|---|---|
| `index.html`, `styles.css` | Page layout and design (colours at the top of `styles.css`) |
| `app.js` | Shop logic: catalog, filters, cart, checkout, assistant widget |
| `config.js` | Store settings + Supabase connection |
| `products.js` | Built-in catalog, used when Supabase isn't connected |
| `api/chat.js` | Vercel function: AI assistant via OpenRouter |
| `supabase/schema.sql` | Tables, security rules, `place_order` function, storage bucket |
| `supabase/seed.sql` | Starter products |
