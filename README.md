# Heja — Clothing Store Website

A fast, mobile-friendly clothing shop that is **100% free to run**:
no server, no database, no monthly fees, no payment-gateway fees.

Customers browse, pick sizes, add to cart, and send their order to you on
**WhatsApp** (or email) with all their delivery details. They pay cash on delivery.

## Make it yours (5 minutes)

1. **`config.js`**: set your WhatsApp number, email, currency, shipping fee and social links.
2. **`products.js`**: add or edit your products (name, price, sizes, category, description).
3. **Photos**: put product photos in `assets/` and set `image: "assets/your-photo.jpg"`.
   Until then, each product shows a built-in illustration in its colour.

## Preview on your computer

Open `index.html` in your browser, or run:

```bash
python3 -m http.server 8000
```

Then go to http://localhost:8000

## Publish for free

**Option A: Netlify Drop (easiest, no account setup)**
1. Go to https://app.netlify.com/drop
2. Drag the whole `heja` folder onto the page.
3. You get a free link like `heja-shop.netlify.app`.

**Option B: GitHub Pages**
1. Create a free GitHub repository and upload these files.
2. Settings → Pages → Source: `main` branch, root folder.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

**Option C: Vercel or Cloudflare Pages.** Both are free and let you import the GitHub repo.

A custom domain such as `heja.com` is the only thing that costs money (about $10/year),
and it's optional.

## Files

| File | What it is |
|---|---|
| `index.html` | Page layout |
| `styles.css` | Design (colours are at the top under `:root`) |
| `app.js` | Shop logic: filters, search, cart, checkout |
| `config.js` | Your store settings |
| `products.js` | Your product catalog |
