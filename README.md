# Heja — Clothing Store Website

A fast, mobile-friendly clothing shop built entirely on **free tiers**:

| Service | What it does | Cost |
|---|---|---|
| **GitHub** | Stores the code; every push redeploys the site | Free |
| **Cloudflare Pages** | Hosts the website + the AI assistant and exchange-rate functions (commercial use allowed) | Free |
| **Supabase** | Database for products, orders and settings, plus photo storage | Free |
| **OpenRouter** | AI style assistant (free models) | Free |

Customers browse, pick sizes, add to cart and check out. Each order is **saved in
Supabase** (prices are recalculated on the server, so they can't be tampered with)
and the customer sends you the receipt on **WhatsApp**, then pays by bank transfer.

## Brand identity

Modelled on the design language of international luxury houses: neutral palette, serif headlines,
tracked uppercase sans for navigation, square corners, centred wordmark.

| Colour | Hex | Use |
|---|---|---|
| Noir | `#111111` | Text, buttons, announcement bar |
| Ivory | `#F7F4EF` | Page background |
| Blanc | `#FFFFFF` | Cards, windows, footer |
| Stone | `#E6E0D6` | Hairline borders |
| Greige | `#EDE9E3` | Product photo backdrop, newsletter |
| Taupe | `#7A736B` | Secondary text |
| Heja Clay | `#9A4A2C` | Signature accent, sparingly (sale prices) |

Fonts (Google Fonts, free): **Cormorant Garamond** (headlines, HEJA wordmark), **Jost** (text, menus, buttons),
**Amiri** + **IBM Plex Sans Arabic** for Arabic. Colours live at the top of `styles.css`.

## How it fits together

```
Browser ──► Cloudflare Pages (index.html, app.js …)
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
- `product_variants`: **colours and stock**: one row per product + colour + size. Set `stock` to what you have;
  0 shows "Sold out", 1–3 shows "Only N left". Stock goes down automatically with every order.
- `orders.status` = `cancelled` puts that order's pieces back in stock automatically.
- `orders.tracking_url`: paste the courier's tracking link; the customer sees a "Track with courier" button.
- `reviews`: new reviews arrive hidden. Tick `approved` to show one on the site.
- `restock_requests`: emails of customers waiting for a sold-out size. Email them when it's back.
- `return_requests`: exchange and return requests (reference RT-…). Update `status` as you handle them.
- `products.fabric`, `care` (+ `_ar`) and `fit`: the "Fabric & care" section on each product.
- Photos: Storage → `product-images` → upload, copy the public URL into the product's `image`.

### 2. OpenRouter
1. Create a free account at openrouter.ai → Keys → create a key.
2. Don't put it in any file. It goes into Vercel (next step).

### 3. Cloudflare Pages
1. dash.cloudflare.com → Workers & Pages → Create → **Pages** → Connect to Git → pick the `Heja` repo.
2. Build settings: Framework preset **None**, Build command `sh build.sh`, Build output directory `public`.
3. Settings → Variables and Secrets (Production):
   - `OPENROUTER_API_KEY` (type **Secret**): your OpenRouter key (required for the assistant)
   - `OPENROUTER_MODEL`: optional, defaults to `openrouter/free` (OpenRouter's free-models router)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`: the same values as in `config.js`, so the assistant knows the live catalogue and stock
   - `SITE_URL`: your site address (e.g. `https://heja.pages.dev`), used for Google and social-media previews
4. Deployments → Retry deployment after changing variables. Every push to GitHub redeploys automatically.

Functions live in `functions/api/` (`chat.js`, `rates.js`). `build.sh` copies only the public files, so this README
and the SQL files are not published. `_headers` adds security headers and keeps the dashboard out of search engines.

### 4. Your details
Edit `config.js`: WhatsApp number, email, currency and social links.

**Homepage video:** replace `assets/hero.mp4` (and `assets/hero-poster.jpg`, its first frame) with
your own muted .mp4 (landscape, 10–20 seconds, under ~8 MB). Set `heroVideo: ""` in `config.js` to turn it off.
Free fashion clips you're allowed to use: pexels.com/videos and pixabay.com/videos.

**Languages:** English, Arabic and Persian (فارسی). Website text lives in `i18n.js` and `i18n-fa.js`;
product text in Supabase (`name_ar` / `name_fa`, `description_*`, `fabric_*`, `care_*`, and `color_ar` / `color_fa`
in `product_variants`). Persian uses Vazirmatn, Markazi Text and Noto Nastaliq Urdu (calligraphy headline).

**Currencies:** the store currency is **US dollars (USD)**: product prices, shipping, promo codes,
checkout and payment. Shoppers can also view approximate prices in AED, EUR or Iranian toman. AED and EUR
update daily through `api/rates.js`; set the toman rate yourself in `config.js` → `currencies.IRT.perUsd`
(display only, no Iranian payments). Prices are edited in Supabase → `products.price` (USD).

**Size chart:** edit `size-chart.js` (body measurements in cm; inches are calculated automatically).

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
| `functions/api/chat.js` | Cloudflare function: AI assistant via OpenRouter |
| `functions/api/rates.js` | Cloudflare function: daily AED/EUR rates |
| `build.sh`, `_headers` | Cloudflare build step and security headers |
| `api/` | Old Vercel versions of the functions (can be deleted after the move) |
| `supabase/schema.sql` | Tables, security rules, `place_order` function, storage bucket |
| `supabase/seed.sql` | Starter products |

## Dashboard (admin.html)

Open `https://<your-site>/admin.html` and sign in. It shows:
- **Overview:** visits, unique and returning visitors, average visit time, time from arrival to checkout and to order,
  conversion rate, paid and awaiting revenue, abandoned carts, the shopping funnel, traffic sources, countries
  (from time zone), devices, languages, searches, most viewed and best-selling products.
- **Orders:** mark as paid, change status (cancelling restocks), add courier tracking links, one-click WhatsApp to the
  customer with your bank-details message, and each customer's shopping journey.
- **Visitors:** every visit with its full timeline from arrival to leaving.
- **Customers, products and stock, reviews, returns and restock requests, promo codes, subscribers, settings, social links.**

**Setup (once):**
1. Supabase → Authentication → Users → **Add user**: your email + a strong password (tick "auto confirm").
2. Supabase → Table Editor → `admins` → insert a row with the same email in lowercase.
3. Recommended: Supabase → Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".

**Checkout:** customers place an order, see an on-screen receipt and are sent to WhatsApp with the receipt.
Reply with your bank details (the dashboard's Settings → Payment message prepares this). Mark the order paid in the dashboard.

**Visitor analytics** run only for visitors who click Accept on the analytics notice (UAE PDPL / GDPR).
No names, phone numbers or addresses are stored in analytics; they exist only on orders.
