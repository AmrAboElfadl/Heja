(() => {
  const CFG = window.HEJA_CONFIG;
  const I18N = window.HEJA_I18N;
  const withDefaults = (p, i) => ({ nameAr: "", descriptionAr: "", colors: [], fabric: "", fabricAr: "", care: "", careAr: "", fit: "", order: i, ...p });
  let PRODUCTS = window.HEJA_PRODUCTS.map(withDefaults);
  let catalogReady = !CFG.supabaseUrl; // the cart is only checked against the live catalog once it has loaded
  let REVIEWS = {}; // product id -> approved reviews
  const SB = CFG.supabaseUrl && CFG.supabaseAnonKey
    ? { url: CFG.supabaseUrl.replace(/\/$/, ""), headers: { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}` } }
    : null;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- storage (never breaks the page) ----------
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // ---------- language ----------
  const LANGS = ["en", "ar", "fa"];
  const browserLang = (navigator.language || "").toLowerCase().slice(0, 2);
  let lang = store.get("heja-lang", null);
  if (!LANGS.includes(lang)) lang = LANGS.includes(browserLang) ? browserLang : "en";
  const isRtl = () => lang === "ar" || lang === "fa";
  const numLocale = () => (lang === "fa" ? "fa-IR" : "en-US");
  const fmtNum = (n, digits = 0) => Number(n).toLocaleString(numLocale(), { maximumFractionDigits: digits });
  const t = (key, vars = {}) => {
    const s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (typeof vars[k] === "number" ? fmtNum(vars[k]) : vars[k] ?? ""));
  };
  // Localised product text: nameAr / nameFa, falling back to English
  const loc = (o, field) => {
    const k = field + (lang === "ar" ? "Ar" : lang === "fa" ? "Fa" : "");
    return (lang !== "en" && o[k]) || o[field] || "";
  };
  const pName = (p) => loc(p, "name");
  const pDesc = (p) => loc(p, "description");
  const catName = (c) => (I18N[lang][`cat.${c}`] ?? c);
  const badgeName = (b) => (I18N[lang][`badge.${b}`] ?? b);

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl() ? "rtl" : "ltr";
    $$("[data-lang-select]").forEach((el) => { el.value = lang; });
    $$("[data-cur-select]").forEach((el) => { el.value = cur; });
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  }
  function rerenderOpen() {
    renderAll();
    if (!$("#productOverlay").hidden && pm.id) openProduct(pm.id, { keepFocus: true });
    if (!$("#sizesOverlay").hidden) renderSizeGuide();
  }
  $$("[data-lang-select]").forEach((el) =>
    el.addEventListener("change", () => {
      if (!LANGS.includes(el.value)) return;
      lang = el.value; store.set("heja-lang", lang);
      rerenderOpen();
    })
  );
  $$("[data-cur-select]").forEach((el) =>
    el.addEventListener("change", () => {
      if (!CFG.currencies || !CFG.currencies[el.value]) return;
      cur = el.value; store.set("heja-cur", cur);
      rerenderOpen();
    })
  );

  // ---------- helpers ----------
  // ---------- currencies (prices are stored in the store currency, USD) ----------
  const BASE = CFG.currency || "USD";
  const CURS = CFG.currencies || { [BASE]: { perUsd: 1 } };
  let cur = store.get("heja-cur", BASE);
  if (!CURS[cur]) cur = BASE; // e.g. a shopper who had EGP saved
  const LABELS = {
    AED: { en: "AED", ar: "د.إ", fa: "درهم" },
    USD: { en: "$", ar: "$", fa: "دلار" },
    EUR: { en: "€", ar: "€", fa: "یورو" },
    IRT: { en: "Toman", ar: "تومان", fa: "تومان" }
  };
  const curName = (code) => ({ AED: "AED", USD: "USD", EUR: "EUR", IRT: lang === "en" ? "Toman" : "تومان" })[code] || code;
  const fmtMoney = (amount, code) => {
    const lab = (LABELS[code] || {})[lang] || code;
    const n = Number(amount);
    // whole amounts stay clean ($20); cents shown when needed ($1.25); toman always whole
    const cents = code !== "IRT" && Math.abs(n - Math.round(n)) > 0.004;
    const v = n.toLocaleString(numLocale(), { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
    if (lang === "en" && (code === "USD" || code === "EUR")) return `${lab}${v}`;
    if (lang === "en" && code === "AED") return `${lab} ${v}`;
    return `${v} ${lab}`;
  };
  // money(n): price in the shopper's currency. paid(n): the amount actually paid (store currency).
  const money = (n) => fmtMoney(Number(n) * (CURS[cur] ? CURS[cur].perUsd : 1), CURS[cur] ? cur : BASE);
  const paid = (n) => fmtMoney(Number(n), BASE);
  async function loadRates() {
    const KEY = "heja-rates-usd"; // rates saved under the old EGP base are ignored
    const cached = store.get(KEY, null);
    const apply = (rates) => Object.entries(rates || {}).forEach(([c, v]) => {
      if (CURS[c] && c !== "IRT" && c !== BASE && Number(v) > 0) CURS[c].perUsd = Number(v);
    });
    if (cached && Date.now() - cached.at < 6 * 3600 * 1000) { apply(cached.rates); return false; }
    try {
      const r = await fetch("/api/rates");
      if (!r.ok) throw new Error("rates " + r.status);
      const d = await r.json();
      apply(d.rates);
      store.set(KEY, { at: Date.now(), rates: d.rates });
      return true;
    } catch {
      if (cached) apply(cached.rates); // older rates are better than none
      return false;
    }
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const isSale = (p) => p.oldPrice > p.price;
  const isNew = (p) => p.badge === "New";

  // ---------- colours and stock ----------
  const LOW_STOCK = 3;
  const hasColors = (p) => p.colors && p.colors.length > 0;
  const colorName = (c) => (c ? loc(c, "name") : "");
  const findColor = (p, name) => (hasColors(p) ? p.colors.find((c) => c.name === name) : null);
  // A colour without stock numbers (built-in catalogue) counts as available.
  const stockOf = (p, color, size) => {
    if (!hasColors(p)) return p.sizes.includes(size) ? Infinity : 0;
    const c = findColor(p, color);
    if (!c || !p.sizes.includes(size)) return 0;
    return c.stock ? c.stock[size] ?? 0 : Infinity;
  };
  const colorStock = (p, c) => p.sizes.reduce((n, s) => n + stockOf(p, c.name, s), 0);
  const isSoldOut = (p) => hasColors(p) && p.colors.every((c) => colorStock(p, c) === 0);
  const firstColor = (p) => (hasColors(p) ? p.colors.find((c) => colorStock(p, c) > 0) || p.colors[0] : null);
  const sizeAvailable = (p, size) =>
    hasColors(p) ? p.colors.some((c) => stockOf(p, c.name, size) > 0) : p.sizes.includes(size);

  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (x) => Math.max(0, Math.min(255, x + amt));
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; };
  const SHAPES = {
    tee: (f, d) => `<path d="M30 18 L42 12 Q50 20 58 12 L70 18 L84 32 L74 42 L68 37 L68 88 L32 88 L32 37 L26 42 L16 32 Z" fill="${f}"/><path d="M42 12 Q50 22 58 12" fill="none" stroke="${d}" stroke-width="2"/>`,
    shirt: (f, d) => `<path d="M30 16 L42 10 L50 18 L58 10 L70 16 L86 40 L76 46 L68 34 L68 90 L32 90 L32 34 L24 46 L14 40 Z" fill="${f}"/><path d="M42 10 L50 24 L58 10 M50 24 L50 90" fill="none" stroke="${d}" stroke-width="2"/><circle cx="50" cy="34" r="1.6" fill="${d}"/><circle cx="50" cy="48" r="1.6" fill="${d}"/><circle cx="50" cy="62" r="1.6" fill="${d}"/><circle cx="50" cy="76" r="1.6" fill="${d}"/>`,
    hoodie: (f, d) => `<path d="M38 18 Q50 0 62 18 L72 22 L86 52 L76 56 L68 40 L68 90 L32 90 L32 40 L24 56 L14 52 L28 22 Z" fill="${f}"/><path d="M40 20 Q50 34 60 20" fill="none" stroke="${d}" stroke-width="2"/><path d="M38 64 L62 64 L58 78 L42 78 Z" fill="none" stroke="${d}" stroke-width="2"/><path d="M46 30 L46 42 M54 30 L54 42" stroke="${d}" stroke-width="1.6"/>`,
    pants: (f, d) => `<path d="M30 10 L70 10 L76 92 L56 92 L50 36 L44 92 L24 92 Z" fill="${f}"/><path d="M30 18 L70 18" stroke="${d}" stroke-width="2"/><path d="M50 18 L50 36" stroke="${d}" stroke-width="1.6"/>`,
    dress: (f, d) => `<path d="M40 8 L42 22 Q50 26 58 22 L60 8 L64 8 L64 28 L60 40 L80 92 L20 92 L40 40 L36 28 L36 8 Z" fill="${f}"/><path d="M38 40 L62 40" stroke="${d}" stroke-width="2"/>`,
    jacket: (f, d) => `<path d="M32 14 L42 10 L50 20 L58 10 L68 14 L84 30 L82 90 L70 90 L68 40 L68 86 L32 86 L32 40 L30 90 L18 90 L16 30 Z" fill="${f}"/><path d="M42 10 L46 30 L50 20 L54 30 L58 10 M50 20 L50 86" fill="none" stroke="${d}" stroke-width="2"/><rect x="36" y="40" width="10" height="8" fill="none" stroke="${d}" stroke-width="1.6"/><rect x="54" y="40" width="10" height="8" fill="none" stroke="${d}" stroke-width="1.6"/>`,
    skirt: (f, d) => `<path d="M34 16 L66 16 L82 88 L18 88 Z" fill="${f}"/><path d="M34 22 L66 22" stroke="${d}" stroke-width="2"/><path d="M42 22 L34 88 M50 22 L50 88 M58 22 L66 88" stroke="${d}" stroke-width="1.2" opacity=".7"/>`,
    cap: (f, d) => `<path d="M22 60 Q22 28 50 28 Q78 28 78 60 Z" fill="${f}"/><path d="M22 60 Q50 54 92 66 Q60 72 22 60 Z" fill="${d}"/><circle cx="50" cy="28" r="3" fill="${d}"/><path d="M50 28 L50 60 M36 32 Q32 46 34 60 M64 32 Q68 46 66 60" stroke="${d}" stroke-width="1.2" fill="none" opacity=".7"/>`
  };
  const illustration = (p, hex) => {
    const fill = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : p.color;
    const detail = lum(fill) < 110 ? shade(fill, 50) : shade(fill, -45);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${(SHAPES[p.shape] || SHAPES.tee)(fill, detail)}</svg>`;
  };
  const bgFor = () => "#EDE9E3"; // Greige studio backdrop for every product
  const media = (p, hex) => (p.image ? `<img src="${esc(p.image)}" alt="${esc(pName(p))}" loading="lazy">` : illustration(p, hex || (firstColor(p) || {}).hex));
  const stars = (n) => `<span class="stars" aria-label="${n.toFixed(1)} / 5">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
  const ratingOf = (id) => { const r = REVIEWS[id] || []; return r.length ? { avg: r.reduce((a, x) => a + x.rating, 0) / r.length, n: r.length } : null; };
  const priceHtml = (p) => isSale(p) ? `<s>${money(p.oldPrice)}</s><span class="now-sale">${money(p.price)}</span>` : money(p.price);
  const heartSvg = `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`;
  const miniCard = (p) => `<button class="mini" data-open-product="${p.id}"><div class="mini-media" style="background:${bgFor(p)}">${media(p)}</div><span>${esc(pName(p))}</span><small>${money(p.price)}</small></button>`;

  // ---------- static content ----------
  $("#year").textContent = new Date().getFullYear();
  $("#waContact").href = `https://wa.me/${CFG.whatsappNumber}`;
  const realEmail = CFG.orderEmail && !/example\.(com|org|net)$/i.test(CFG.orderEmail);
  $("#mailContact").href = `mailto:${CFG.orderEmail}`;
  $("#mailContact").textContent = CFG.orderEmail;
  $("#mailContact").hidden = !realEmail;
  $("#emailOrderBtn").hidden = !realEmail;
  $("#social").innerHTML = Object.entries(CFG.social || {})
    .filter(([, url]) => url)
    .map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${name[0].toUpperCase() + name.slice(1)}</a>`)
    .join("");

  function renderAnnounce() {
    const ship = CFG.freeShippingOver > 0 ? t("announce.free", { amount: money(CFG.freeShippingOver) }) : t("announce.fast");
    const now = new Date(), m = now.getMonth() + 1, d = now.getDate();
    const nowruz = (m === 3 && d >= 14) || (m === 4 && d <= 2); // Newroz / Nowruz, around 21 March
    $("#announce").textContent = `${nowruz ? t("announce.nowruz") + " · " : ""}${ship} · ${t("announce.cod")} · ${t("announce.welcome")}`;
  }

  function renderHero() {
    const preferred = ["summer-dress", "everyday-hoodie", "pleated-skirt"].map(byId).filter(Boolean);
    const picks = preferred.length === 3 ? preferred : PRODUCTS.slice(0, 3);
    $$(".hero-card").forEach((el, i) => {
      const p = picks[i];
      if (!p) return;
      el.style.backgroundColor = bgFor(p);
      el.style.backgroundImage = p.image
        ? `url("${p.image}")`
        : `url("data:image/svg+xml,${encodeURIComponent(illustration(p).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))}")`;
      el.style.backgroundSize = p.image ? "cover" : "";
    });
  }

  // ---------- favourites ----------
  let favs = new Set(store.get("heja-favs", []));
  const saveFavs = () => store.set("heja-favs", [...favs]);
  function toggleFav(id) {
    if (favs.has(id)) { favs.delete(id); toast(t("fav.removed")); } else { favs.add(id); toast(t("fav.added")); }
    saveFavs(); renderFavCount(); renderGrid();
    if (pm.id === id) renderPmFav();
  }
  function renderFavCount() {
    const n = [...favs].filter(byId).length;
    $("#favCount").textContent = n;
    $("#favCount").hidden = n === 0;
  }

  // ---------- shop: filters, search, sort ----------
  const state = { cat: "All", tag: "", size: "", color: "", maxPrice: Infinity, query: "", sort: "featured" };
  const priceStep = () => (Math.max(0, ...PRODUCTS.map((p) => p.price)) > 500 ? 50 : 1);
  const maxPriceAll = () => Math.ceil(Math.max(0, ...PRODUCTS.map((p) => p.price)) / priceStep()) * priceStep();

  function renderFilters() {
    const CAT_ORDER = ["Women", "Unisex", "Accessories", "Men", "Kids"];
    const rank = (c) => (CAT_ORDER.indexOf(c) + 1) || 99;
    const cats = [...new Set(PRODUCTS.map((p) => p.category))].sort((a, b) => rank(a) - rank(b));
    if (state.cat !== "All" && !cats.includes(state.cat)) state.cat = "All";
    const chip = (attr, val, label, extra = "") =>
      `<button class="chip ${extra}" ${attr}="${esc(val)}">${esc(label)}</button>`;
    $("#filters").innerHTML =
      chip("data-cat", "All", t("filter.all")) +
      cats.map((c) => chip("data-cat", c, catName(c))).join("") +
      chip("data-tag", "new", t("filter.new")) +
      chip("data-tag", "sale", t("filter.sale"), "sale") +
      chip("data-tag", "favs", t("filter.favs"));

    const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2Y", "4Y", "6Y", "8Y", "One size"];
    const srank = (s) => (SIZE_ORDER.indexOf(s) + 1) || 99;
    const sizes = [...new Set(PRODUCTS.flatMap((p) => p.sizes))].sort((a, b) => srank(a) - srank(b));
    $("#sizeFilter").innerHTML = `<option value="">${esc(t("filter.anySize"))}</option>` +
      sizes.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    $("#sizeFilter").value = state.size;

    const colours = new Map();
    PRODUCTS.forEach((p) => (p.colors || []).forEach((c) => { if (!colours.has(c.name)) colours.set(c.name, c); }));
    $("#colorFilter").hidden = colours.size === 0;
    if (state.color && !colours.has(state.color)) state.color = "";
    $("#colorFilter").innerHTML = `<option value="">${esc(t("filter.anyColour"))}</option>` +
      [...colours.values()].map((c) => `<option value="${esc(c.name)}">${esc(colorName(c))}</option>`).join("");
    $("#colorFilter").value = state.color;

    const max = maxPriceAll();
    const r = $("#priceFilter");
    r.max = max; r.step = priceStep(); r.min = Math.min(priceStep() * 2, max);
    r.value = Number.isFinite(state.maxPrice) ? state.maxPrice : max;
  }

  const searchText = (p) => `${p.name} ${p.nameAr} ${p.nameFa || ""} ${p.category} ${catName(p.category)} ${p.description} ${p.descriptionAr} ${p.descriptionFa || ""} ${(p.colors || []).map((c) => `${c.name} ${c.nameAr} ${c.nameFa || ""}`).join(" ")}`.toLowerCase();
  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = PRODUCTS.filter((p) =>
      (state.cat === "All" || p.category === state.cat) &&
      (!state.tag || (state.tag === "new" && isNew(p)) || (state.tag === "sale" && isSale(p)) || (state.tag === "favs" && favs.has(p.id))) &&
      (!state.size || sizeAvailable(p, state.size)) &&
      (!state.color || (findColor(p, state.color) && colorStock(p, findColor(p, state.color)) > 0)) &&
      p.price <= state.maxPrice &&
      (!q || searchText(p).includes(q))
    );
    const by = {
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      name: (a, b) => pName(a).localeCompare(pName(b), lang),
      new: (a, b) => (isNew(b) - isNew(a)) || (b.order - a.order)
    }[state.sort];
    return by ? [...list].sort(by) : list;
  }

  function renderGrid() {
    const list = filtered();
    $$("#filters [data-cat]").forEach((c) => c.classList.toggle("active", c.dataset.cat === state.cat));
    $$("#filters [data-tag]").forEach((c) => c.classList.toggle("active", c.dataset.tag === state.tag));
    const max = maxPriceAll();
    $("#priceLabel").textContent = t("filter.maxPrice", { amount: money(Number.isFinite(state.maxPrice) ? state.maxPrice : max) });
    $("#resultCount").textContent = list.length === 1 ? t("filter.count1") : t("filter.count", { n: list.length });
    $("#clearFilters").hidden = !(state.cat !== "All" || state.tag || state.size || state.color || Number.isFinite(state.maxPrice) || state.query);
    $("#empty").hidden = list.length > 0;
    $("#empty").textContent = state.tag === "favs" && !favs.size ? t("fav.empty") : t("empty");
    $("#grid").innerHTML = list.map((p) => {
      const badges = [];
      if (p.badge && p.badge !== "Sale") badges.push(`<span class="badge">${esc(badgeName(p.badge))}</span>`);
      if (isSale(p)) badges.push(`<span class="badge sale">${esc(t("badge.off", { n: Math.round((1 - p.price / p.oldPrice) * 100) }))}</span>`);
      const out = isSoldOut(p);
      if (out) badges.unshift(`<span class="badge out">${esc(t("badge.soldOut"))}</span>`);
      const fav = favs.has(p.id);
      const shown = state.color && findColor(p, state.color) ? findColor(p, state.color) : firstColor(p);
      const sw = hasColors(p)
        ? `<span class="swatches" aria-label="${esc(p.colors.map(colorName).join(", "))}">${p.colors.slice(0, 5).map((c) =>
            `<i style="background:${esc(c.hex)}" class="${colorStock(p, c) === 0 ? "gone" : ""}" title="${esc(colorName(c))}"></i>`).join("")}${p.colors.length > 5 ? `<small>+${p.colors.length - 5}</small>` : ""}</span>`
        : "";
      const rt = ratingOf(p.id);
      return `
      <article class="card ${out ? "is-out" : ""}" data-id="${p.id}" tabindex="0" aria-label="${esc(pName(p))}">
        <div class="card-media" style="background:${bgFor(p)}">
          <div class="badges">${badges.join("")}</div>
          <button class="heart" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${esc(t(fav ? "fav.remove" : "fav.add"))}">${heartSvg}</button>
          ${media(p, shown && shown.hex)}
          ${out ? "" : `<button class="quick-add" data-quick="${p.id}">${esc(t("card.quickAdd"))}</button>`}
        </div>
        <div class="card-info">
          <div><h3>${esc(pName(p))}</h3><p class="cat">${esc(catName(p.category))}</p></div>
          <p class="price">${priceHtml(p)}</p>
          ${rt ? `<p class="card-rating">${stars(rt.avg)} <small>(${rt.n})</small></p>` : ""}
          ${sw}
        </div>
      </article>`;
    }).join("");
  }

  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    if (b.dataset.cat) { state.cat = b.dataset.cat; state.tag = state.tag === "favs" ? "" : state.tag; }
    if (b.dataset.tag) state.tag = state.tag === b.dataset.tag ? "" : b.dataset.tag;
    renderGrid();
  });
  $("#sizeFilter").addEventListener("change", (e) => { state.size = e.target.value; renderGrid(); });
  $("#colorFilter").addEventListener("change", (e) => { state.color = e.target.value; renderGrid(); });
  $("#priceFilter").addEventListener("input", (e) => {
    const v = Number(e.target.value);
    state.maxPrice = v >= maxPriceAll() ? Infinity : v;
    renderGrid();
  });
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); renderSuggest(); });
  // Search suggestions as you type
  function renderSuggest() {
    const box = $("#searchSuggest"), q = state.query.trim().toLowerCase();
    const hits = q.length < 2 ? [] : PRODUCTS.filter((p) => searchText(p).includes(q)).slice(0, 5);
    box.innerHTML = hits.map((p) => `<li role="option"><button type="button" data-open-product="${p.id}"><span>${esc(pName(p))}</span><small>${money(p.price)}</small></button></li>`).join("");
    box.hidden = hits.length === 0;
    $("#search").setAttribute("aria-expanded", String(!box.hidden));
  }
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $("#searchSuggest").hidden = true; return; }
    if (e.key === "ArrowDown") { const f = $("#searchSuggest button"); if (f) { e.preventDefault(); f.focus(); } }
  });
  $("#searchSuggest").addEventListener("keydown", (e) => {
    const items = $$("#searchSuggest button"), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? items[i - 1] : $("#search")).focus(); }
    if (e.key === "Escape") { $("#searchSuggest").hidden = true; $("#search").focus(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) $("#searchSuggest").hidden = true; });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
  $("#clearFilters").addEventListener("click", () => {
    Object.assign(state, { cat: "All", tag: "", size: "", color: "", maxPrice: Infinity, query: "" });
    $("#search").value = "";
    renderFilters(); renderGrid();
  });

  // Nav links: categories and tags
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-go]");
    if (!a) return;
    const go = a.dataset.go;
    Object.assign(state, { cat: "All", tag: "" });
    if (["new", "sale", "favs"].includes(go)) state.tag = go;
    else if (go !== "all") state.cat = go;
    if (!$("#menuOverlay").hidden) closeOverlay($("#menuOverlay"));
    renderGrid();
  });
  $("#favOpen").addEventListener("click", () => {
    Object.assign(state, { cat: "All", tag: "favs" });
    renderGrid();
    $("#shop").scrollIntoView({ behavior: "smooth" });
  });

  $("#grid").addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
    const quick = e.target.closest("[data-quick]");
    if (quick) {
      e.stopPropagation();
      const p = byId(quick.dataset.quick);
      const c = firstColor(p);
      const oneChoice = p.sizes.length === 1 && (!hasColors(p) || p.colors.length === 1);
      if (oneChoice && stockOf(p, c ? c.name : "", p.sizes[0]) > 0) addToCart(p.id, c ? c.name : "", p.sizes[0], 1);
      else openProduct(p.id);
      return;
    }
    const card = e.target.closest(".card");
    if (card) openProduct(card.dataset.id);
  });
  $("#grid").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("card")) openProduct(e.target.dataset.id);
  });
  document.addEventListener("click", (e) => {
    const m = e.target.closest("[data-open-product]");
    if (!m) return;
    if (!$("#cartOverlay").hidden) closeOverlay($("#cartOverlay"));
    $("#searchSuggest").hidden = true;
    openProduct(m.dataset.openProduct, { keepFocus: !$("#productOverlay").hidden });
  });

  // ---------- overlays ----------
  const focusStack = [];
  function openOverlay(el) {
    if (!el.hidden) return;
    focusStack.push(document.activeElement);
    el.hidden = false;
    document.body.style.overflow = "hidden";
    const f = [...el.querySelectorAll("input:not([type=hidden]), select, textarea, button:not(.close)")].find((x) => x.offsetParent !== null)
      || el.querySelector("button");
    f && f.focus({ preventScroll: true });
  }
  function closeOverlay(el) {
    if (el.hidden) return;
    el.hidden = true;
    if ($$(".overlay").every((o) => o.hidden)) document.body.style.overflow = "";
    if (el.id === "productOverlay") { pm.id = null; clearHash(); }
    const back = focusStack.pop();
    back && back.focus && back.focus({ preventScroll: true });
  }
  $$(".overlay").forEach((o) =>
    o.addEventListener("click", (e) => { if (e.target === o || e.target.closest("[data-close]")) closeOverlay(o); })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = $$(".overlay").filter((o) => !o.hidden).pop();
    open && closeOverlay(open);
  });
  $("#menuOpen").addEventListener("click", () => openOverlay($("#menuOverlay")));
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (!o) return;
    e.preventDefault();
    if (!$("#menuOverlay").hidden) closeOverlay($("#menuOverlay"));
    if (o.dataset.open === "sizes") {
      if ($("#productOverlay").hidden) { sg.highlight = null; sg.unisex = false; }
      renderSizeGuide();
    }
    openOverlay($(`#${o.dataset.open}Overlay`));
  });

  // ---------- product modal + shareable links ----------
  const pm = { id: null, color: null, size: null, qty: 1 };
  const productHash = (id) => `#p/${encodeURIComponent(id)}`;
  function clearHash() {
    if (location.hash.startsWith("#p/")) history.replaceState(null, "", location.pathname + location.search);
  }
  function renderPmFav() {
    const on = favs.has(pm.id);
    const b = $("#pmFav");
    b.innerHTML = heartSvg;
    b.setAttribute("aria-pressed", on);
    b.setAttribute("aria-label", t(on ? "fav.remove" : "fav.add"));
  }
  function openProduct(id, { keepFocus = false } = {}) {
    const p = byId(id);
    if (!p) return;
    const same = pm.id === id;
    pm.id = id;
    if (!same) {
      const fc = state.color && findColor(p, state.color) && colorStock(p, findColor(p, state.color)) > 0 ? findColor(p, state.color) : firstColor(p);
      pm.color = fc ? fc.name : "";
      pm.size = p.sizes.length === 1 ? p.sizes[0] : null;
      pm.qty = 1;
      $("#finder").hidden = true; $("#finderOut").textContent = "";
      $("#revForm").hidden = true; $("#revMsg").textContent = "";
      $("#pmNotify").hidden = true; $("#pmDetails").open = false;
      $("#pmMedia").classList.remove("zoomed");
    }
    $("#pmMedia").style.background = bgFor(p);
    $("#pmCat").textContent = catName(p.category);
    $("#pmName").textContent = pName(p);
    $("#pmPrice").innerHTML = priceHtml(p);
    $("#pmDesc").textContent = pDesc(p);
    $("#pmQty").textContent = pm.qty;
    renderPmOptions();
    renderPmFav();
    renderFit();
    renderDetails(p);
    renderReviews(p);
    const related = [...PRODUCTS.filter((x) => x.id !== id && x.category === p.category), ...PRODUCTS.filter((x) => x.id !== id && x.category !== p.category)].slice(0, 4);
    $("#pmRelated").innerHTML = related.map(miniCard).join("");
    $("#productOverlay .modal").scrollTop = 0;
    if (location.hash !== productHash(id)) history.replaceState(null, "", productHash(id));
    addRecent(id);
    if (!keepFocus) openOverlay($("#productOverlay"));
  }
  // Colour swatches, sizes with stock, "Only 2 left", add / notify button
  function renderPmOptions() {
    const p = byId(pm.id);
    const col = findColor(p, pm.color);
    $("#pmMedia").innerHTML = media(p, col && col.hex);
    $("#pmColorBlock").hidden = !hasColors(p);
    if (hasColors(p)) {
      $("#pmColorName").textContent = colorName(col);
      $("#pmColors").innerHTML = p.colors.map((c) => {
        const out = colorStock(p, c) === 0;
        return `<button type="button" role="radio" class="swatch ${out ? "gone" : ""}" data-color="${esc(c.name)}" aria-checked="${c.name === pm.color}"
          aria-label="${esc(colorName(c))}${out ? " – " + esc(t("stock.outAll")) : ""}" title="${esc(colorName(c))}"><i style="background:${esc(c.hex)}"></i></button>`;
      }).join("");
    }
    $("#pmSizes").innerHTML = p.sizes.map((s) => {
      const out = stockOf(p, pm.color, s) === 0;
      return `<button type="button" class="size ${s === pm.size ? "active" : ""} ${out ? "out" : ""}" data-size="${esc(s)}" aria-pressed="${s === pm.size}"
        ${out ? `aria-label="${esc(s)} – ${esc(t("stock.out"))}"` : ""}>${esc(s)}</button>`;
    }).join("");
    const left = pm.size ? stockOf(p, pm.color, pm.size) : null;
    const note = $("#pmStock");
    note.className = "stock-note";
    if (isSoldOut(p)) { note.textContent = t("stock.outAll"); note.classList.add("out"); }
    else if (left === 0) { note.textContent = t("stock.out"); note.classList.add("out"); }
    else if (left !== null && left <= LOW_STOCK) { note.textContent = t("stock.low", { n: left }); note.classList.add("low"); }
    else note.textContent = "";
    if (left && Number.isFinite(left) && pm.qty > left) { pm.qty = left; $("#pmQty").textContent = pm.qty; }
    const add = $("#pmAdd");
    if (left === 0) { add.textContent = t("notify.cta"); add.dataset.mode = "notify"; }
    else { add.textContent = t("pm.add"); add.dataset.mode = "add"; $("#pmNotify").hidden = true; }
  }
  $("#pmColors").addEventListener("click", (e) => {
    const b = e.target.closest("[data-color]");
    if (!b) return;
    pm.color = b.dataset.color;
    $("#pmNotify").hidden = true;
    renderPmOptions(); renderFit();
  });
  $("#pmSizes").addEventListener("click", (e) => {
    const b = e.target.closest(".size");
    if (!b) return;
    pm.size = b.dataset.size;
    $("#pmNotify").hidden = true;
    renderPmOptions(); renderFit();
  });
  $("#pmMinus").addEventListener("click", () => { pm.qty = Math.max(1, pm.qty - 1); $("#pmQty").textContent = pm.qty; });
  $("#pmPlus").addEventListener("click", () => {
    const p = byId(pm.id);
    const max = pm.size ? Math.min(20, stockOf(p, pm.color, pm.size)) : 20;
    if (pm.qty >= max) { if (max < 20) toast(t("stock.limit", { n: max })); return; }
    pm.qty += 1; $("#pmQty").textContent = pm.qty;
  });
  $("#pmFav").addEventListener("click", () => toggleFav(pm.id));
  $("#pmAdd").addEventListener("click", () => {
    if (!pm.size) { toast(t("pm.chooseSize")); return; }
    const p = byId(pm.id);
    if ($("#pmAdd").dataset.mode === "notify") {
      $("#pmNotifyText").textContent = t("stock.notifyText", { colour: colorName(findColor(p, pm.color)) || pName(p), size: pm.size });
      $("#pmNotify").hidden = false;
      $("#notifyEmail").focus();
      return;
    }
    if (!addToCart(pm.id, pm.color || "", pm.size, pm.qty)) return;
    closeOverlay($("#productOverlay"));
  });
  $("#pmNotify").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!SB) { toast(t("news.offline")); return; }
    const btn = $("button", e.target); btn.disabled = true;
    try {
      await rpc("request_restock", { p_product: pm.id, p_color: pm.color || "", p_size: pm.size, p_contact: e.target.email.value });
      e.target.reset(); e.target.hidden = true;
      toast(t("notify.ok"));
    } catch (err) { toast(/email/i.test(err.message) ? t("news.bad") : t("news.offline")); }
    finally { btn.disabled = false; }
  });

  // Fabric & care, fit
  function renderDetails(p) {
    const fabric = loc(p, "fabric");
    const care = loc(p, "care");
    $("#pmDetails").hidden = !(fabric || care || p.fit);
    $("#pmFitLine").textContent = p.fit ? t("pm.fitLine", { fit: t(`fit.${p.fit}`) }) : "";
    $("#pmFabricText").textContent = fabric;
    $("#pmCareText").textContent = care;
  }

  // "Find my size" from height and weight
  $("#finderToggle").addEventListener("click", () => {
    const f = $("#finder");
    f.hidden = !f.hidden;
    if (!f.hidden) $("#finderH").focus();
  });
  function recommendSize(p, h, w, pref) {
    const chart = chartFor(p);
    if (chart === "accessories" || chart === "kids") return null;
    // Weight bands per size, adjusted for height and preferred fit
    const bands = chart === "men" ? [55, 65, 77, 90] : [50, 58, 66, 76];
    let idx = bands.filter((b) => w >= b).length; // 0 = XS … 4 = XL
    if (h >= 175) idx += 0.5; else if (h <= 155) idx -= 0.5;
    if (pref === "loose") idx += 0.5; else if (pref === "snug") idx -= 0.5;
    if (chart === "men" && p.category === "Unisex") idx -= 0.5; // unisex runs larger for women
    if (p.fit === "oversized" || p.fit === "relaxed") idx -= 0.25;
    const order = ["XS", "S", "M", "L", "XL"];
    const want = order[Math.max(0, Math.min(order.length - 1, Math.round(idx)))];
    if (p.sizes.includes(want)) return want;
    const avail = p.sizes.filter((s) => order.includes(s));
    if (!avail.length) return null;
    return avail.reduce((best, s) => (Math.abs(order.indexOf(s) - order.indexOf(want)) < Math.abs(order.indexOf(best) - order.indexOf(want)) ? s : best));
  }
  $("#finder").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = byId(pm.id);
    const size = recommendSize(p, Number(e.target.h.value), Number(e.target.w.value), e.target.pref.value);
    const out = $("#finderOut");
    if (!size) { out.textContent = t("finder.none"); return; }
    out.innerHTML = `<span>${esc(t("finder.result", { size }))}</span> <button type="button" class="link-btn" data-pick="${esc(size)}">${esc(t("finder.select", { size }))}</button>`;
  });
  $("#finderOut").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    pm.size = b.dataset.pick;
    renderPmOptions(); renderFit();
    $("#finder").hidden = true;
  });

  // Reviews (shown after approval)
  function renderReviews(p) {
    const list = REVIEWS[p.id] || [];
    const rt = ratingOf(p.id);
    if (!rt) {
      $("#revSummary").innerHTML = `<p class="small">${esc(t("rev.none"))}</p>`;
      $("#revList").innerHTML = "";
      return;
    }
    const fits = { small: 0, true: 0, large: 0 };
    list.forEach((r) => { fits[r.fit] = (fits[r.fit] || 0) + 1; });
    const topFit = Object.entries(fits).sort((a, b) => b[1] - a[1])[0][0];
    $("#revSummary").innerHTML = `<p class="rev-sum">${stars(rt.avg)} <strong>${rt.avg.toFixed(1)}</strong>
      <span class="small">${esc(rt.n === 1 ? t("rev.count1") : t("rev.count", { n: rt.n }))} · ${esc(t("rev.fitSummary", { label: t(`rev.${topFit}`) }))}</span></p>`;
    $("#revList").innerHTML = list.slice(0, 6).map((r) => `<li>
      <p>${stars(r.rating)} <strong>${esc(r.name)}</strong> <span class="small">· ${esc(t(`rev.${r.fit}`))}</span></p>
      ${r.comment ? `<p>${esc(r.comment)}</p>` : ""}</li>`).join("");
  }
  $("#revWrite").addEventListener("click", () => {
    const f = $("#revForm");
    f.hidden = !f.hidden;
    $("#revMsg").textContent = "";
    if (!f.hidden) f.querySelector("input").focus();
  });
  $("#revForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, d = Object.fromEntries(new FormData(f));
    if (!d.rating || !d.fit || !String(d.name || "").trim()) { $("#revMsg").textContent = t("rev.err"); return; }
    if (!SB) { $("#revMsg").textContent = t("news.offline"); return; }
    const btn = $("button[type=submit]", f); btn.disabled = true;
    try {
      await rpc("submit_review", { p_product: pm.id, p_name: d.name, p_rating: Number(d.rating), p_fit: d.fit, p_comment: d.comment || "" });
      f.reset(); f.hidden = true;
      $("#revMsg").textContent = t("rev.ok");
    } catch (err) { $("#revMsg").textContent = err.message; }
    finally { btn.disabled = false; }
  });

  // Tap to zoom the product image
  $("#pmMedia").addEventListener("click", (e) => {
    const m = $("#pmMedia");
    m.classList.toggle("zoomed");
    const r = m.getBoundingClientRect();
    m.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
    m.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
  });
  $("#pmMedia").addEventListener("mousemove", (e) => {
    const m = $("#pmMedia");
    if (!m.classList.contains("zoomed")) return;
    const r = m.getBoundingClientRect();
    m.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
    m.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
  });
  $("#pmShare").addEventListener("click", async () => {
    const p = byId(pm.id);
    const url = location.origin + location.pathname + productHash(pm.id);
    if (navigator.share) {
      try { await navigator.share({ title: `${pName(p)} | Heja`, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); toast(t("pm.copied")); } catch { prompt("", url); }
  });
  function openFromHash() {
    const m = location.hash.match(/^#p\/(.+)$/);
    if (m) openProduct(decodeURIComponent(m[1]));
    if (location.hash === "#track") { history.replaceState(null, "", location.pathname); openOverlay($("#trackOverlay")); }
    if (location.hash === "#return") { history.replaceState(null, "", location.pathname); openOverlay($("#returnsOverlay")); }
  }
  window.addEventListener("hashchange", openFromHash);

  // ---------- international size chart ----------
  const SIZES = window.HEJA_SIZES || {};
  const sg = { chart: "women", unit: store.get("heja-unit", "cm"), highlight: null, unisex: false };
  const chartFor = (p) =>
    ({ Women: "women", Men: "men", Unisex: "men", Kids: "kids", Accessories: "accessories" })[p.category] ||
    (p.sizes.some((s) => /^\d+Y$/.test(s)) ? "kids" : p.sizes.length === 1 ? "accessories" : "women");
  const unitLabel = () => t(sg.unit === "in" ? "sg.in" : "sg.cm");
  const range = ([a, b]) => (sg.unit === "in" ? `${(a / 2.54).toFixed(1)}–${(b / 2.54).toFixed(1)}` : `${a}–${b}`);

  function renderSizeGuide() {
    const tabs = [["women", "sg.women"], ["men", "cat.Unisex"], ["accessories", "sg.acc"]].filter(([k]) => SIZES[k]);
    $("#sgTabs").innerHTML = tabs.map(([k, l]) =>
      `<button type="button" role="tab" aria-selected="${k === sg.chart}" data-chart="${k}">${esc(t(l))}</button>`).join("");
    $("#sgUnits").innerHTML = ["cm", "in"].map((u) =>
      `<button type="button" aria-pressed="${u === sg.unit}" data-unit="${u}">${esc(t(u === "in" ? "sg.in" : "sg.cm"))}</button>`).join("");
    const c = SIZES[sg.chart];
    if (!c) return;
    $("#sgIntro").textContent = t("sg.intro", { unit: unitLabel() });
    const head = [t("sg.size"), ...c.cols.map((k) => t(`sg.${k}`)), ...c.body.map((k) => t(`sg.${k}`))];
    $("#sgTable").innerHTML =
      `<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
      Object.entries(c.rows).map(([size, r]) =>
        `<tr class="${size === sg.highlight ? "hl" : ""}"><th scope="row">${esc(size)}</th>${c.cols.map((k) => `<td>${esc(r[k])}</td>`).join("")}${c.body.map((k) => `<td>${range(r[k])}</td>`).join("")}</tr>`
      ).join("") + "</tbody>";
    const extra = sg.chart === "accessories"
      ? t("sg.oneSize", { range: `${range(c.rows["One size"].head)} ${unitLabel()}` })
      : sg.unisex && sg.chart === "men" ? t("sg.unisex") : "";
    $("#sgExtra").textContent = extra;
    $("#sgExtra").hidden = !extra;
    const how = $$(".how-list li");
    const kids = sg.chart === "kids";
    how[1].hidden = how[2].hidden = kids;
    how[3].hidden = !kids;
    $(".how").hidden = sg.chart === "accessories";
  }
  $("#sgTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-chart]");
    if (b) { sg.chart = b.dataset.chart; renderSizeGuide(); }
  });
  $("#sgUnits").addEventListener("click", (e) => {
    const b = e.target.closest("[data-unit]");
    if (!b) return;
    sg.unit = b.dataset.unit; store.set("heja-unit", sg.unit);
    renderSizeGuide(); if (pm.id) renderFit();
  });

  // "Your size M = EU 38 · UK 10 · US 6" under the size buttons
  function renderFit() {
    const p = byId(pm.id);
    const key = chartFor(p);
    const c = SIZES[key];
    sg.chart = key; sg.highlight = pm.size; sg.unisex = p.category === "Unisex";
    const box = $("#pmFit");
    const link = `<button type="button" class="link-btn" data-open="sizes">${esc(t("pm.findSize"))}</button>`;
    if (!c) { box.innerHTML = link; return; }
    if (key === "accessories") {
      box.innerHTML = `<span>${esc(t("sg.oneSize", { range: `${range(c.rows["One size"].head)} ${unitLabel()}` }))}</span>`;
      return;
    }
    const r = pm.size && c.rows[pm.size];
    if (!r) { box.innerHTML = link; return; }
    const intl = c.cols.map((k) => `${t(`sg.${k}`)} ${r[k]}`).join(" · ");
    const body = c.body.map((k) => `${t(`sg.${k}`)} ${range(r[k])}`).join(" · ");
    box.innerHTML = `<strong>${esc(t("pm.yourSize", { size: pm.size }))}</strong>
      <span class="fit-intl">${esc(intl)}</span>
      <span class="fit-body">${esc(body)} ${esc(unitLabel())}</span>
      ${sg.unisex ? `<span class="fit-note">${esc(t("sg.unisex"))}</span>` : ""}
      ${link}`;
  }

  // ---------- background video ----------
  function setupVideo() {
    const v = $("#heroVideo"), hero = $("#hero"), btn = $("#videoToggle");
    if (!CFG.heroVideo) return;
    hero.classList.add("has-video");
    if (CFG.heroPoster) v.poster = CFG.heroPoster;
    v.src = CFG.heroVideo;
    btn.hidden = false;
    let userPaused = false;
    const setBtn = (playing) => {
      btn.classList.toggle("paused", !playing);
      btn.setAttribute("aria-pressed", String(!playing));
      btn.dataset.i18nAria = playing ? "hero.pause" : "hero.play";
      btn.setAttribute("aria-label", t(btn.dataset.i18nAria));
    };
    v.addEventListener("play", () => setBtn(true));
    v.addEventListener("pause", () => setBtn(false));
    btn.addEventListener("click", () => {
      if (v.paused) { userPaused = false; v.play().catch(() => {}); } else { userPaused = true; v.pause(); }
    });
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduce || saveData) { userPaused = true; setBtn(false); v.preload = "metadata"; return; }
    v.play().catch(() => setBtn(false));
    // Pause while scrolled away to save battery and data
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (userPaused) return;
        if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
      }).observe(hero);
    }
  }

  // ---------- recently viewed ----------
  let recent = store.get("heja-recent", []);
  function addRecent(id) {
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, 10);
    store.set("heja-recent", recent);
    renderRecent();
  }
  function renderRecent() {
    const items = recent.map(byId).filter(Boolean);
    $("#recent").hidden = items.length === 0;
    $("#recentRow").innerHTML = items.map(miniCard).join("");
  }

  // ---------- cart ----------
  let cart = store.get("heja-cart", []);
  let promo = store.get("heja-promo", null); // { code }
  let promoDiscount = 0;
  // Keep the cart in line with the live catalogue: drop missing items, cap quantities to stock
  function pruneCart() {
    if (!catalogReady) return false;
    let changed = false;
    cart = cart.filter((l) => {
      const p = byId(l.id);
      if (!p) { changed = true; return false; }
      if (hasColors(p) && !findColor(p, l.color)) { changed = true; return false; }
      const left = stockOf(p, hasColors(p) ? l.color : "", l.size);
      if (left === 0) { changed = true; return false; }
      if (l.qty > left) { l.qty = left; changed = true; }
      if (!hasColors(p)) l.color = "";
      return true;
    });
    return changed;
  }
  const save = () => store.set("heja-cart", cart);
  const knownLines = () => cart.filter((l) => byId(l.id));

  function addToCart(id, color, size, qty) {
    const p = byId(id);
    const left = Math.min(20, stockOf(p, color, size));
    const line = cart.find((l) => l.id === id && l.size === size && (l.color || "") === color);
    const have = line ? line.qty : 0;
    if (left <= 0) { toast(t("stock.out")); return false; }
    if (have + qty > left) { toast(t("stock.limit", { n: left })); if (have >= left) return false; qty = left - have; }
    if (line) line.qty += qty; else cart.push({ id, color, size, qty });
    save(); renderCart(); refreshPromo();
    const c = $("#cartCount");
    c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
    const col = findColor(p, color);
    toast(t("toast.added", { name: pName(p), size: col ? `${colorName(col)} · ${size}` : size }));
    return true;
  }

  function totals() {
    const subtotal = knownLines().reduce((s, l) => s + byId(l.id).price * l.qty, 0);
    const discount = promo ? Math.min(promoDiscount, subtotal) : 0;
    const free = CFG.freeShippingOver > 0 && subtotal >= CFG.freeShippingOver;
    const shipping = subtotal === 0 || free ? 0 : CFG.shippingFee;
    return { subtotal, discount, shipping, total: subtotal - discount + shipping };
  }

  function renderCart() {
    const lines = knownLines();
    $("#cartCount").textContent = lines.reduce((s, l) => s + l.qty, 0);
    $("#cartFoot").hidden = lines.length === 0;
    const t0 = totals();
    const prog = $("#shipProgress");
    prog.hidden = !(CFG.freeShippingOver > 0 && lines.length);
    if (!prog.hidden) {
      const left = CFG.freeShippingOver - t0.subtotal;
      prog.classList.toggle("done", left <= 0);
      $("#shipNote").textContent = left > 0 ? t("cart.freeLeft", { amount: money(left) }) : t("cart.freeGot");
      $("#shipBar").style.width = `${Math.min(100, (t0.subtotal / CFG.freeShippingOver) * 100)}%`;
    }
    if (!lines.length) {
      $("#cartItems").innerHTML = `<div class="cart-empty"><p>${esc(t("cart.empty"))}</p><a href="#shop" class="btn btn-ghost" data-close>${esc(t("cart.start"))}</a></div>`;
      return;
    }
    $("#cartItems").innerHTML = cart.map((l, i) => {
      const p = byId(l.id);
      if (!p) return "";
      return `<div class="line">
        <button class="line-thumb" style="background:${bgFor(p)};border:0;padding:0" data-open-product="${p.id}" aria-label="${esc(pName(p))}">${media(p, (findColor(p, l.color) || {}).hex)}</button>
        <div><h4>${esc(pName(p))}</h4><p class="meta">${esc(findColor(p, l.color) ? t("cart.colourSize", { colour: colorName(findColor(p, l.color)), s: l.size }) : t("cart.size", { s: l.size }))} · ${money(p.price)}</p>
          <div class="qty sm"><button data-dec="${i}" aria-label="−">−</button><span>${l.qty}</span><button data-inc="${i}" aria-label="+">+</button></div>
        </div>
        <div class="end"><strong>${money(p.price * l.qty)}</strong><button class="remove" data-rm="${i}">${esc(t("cart.remove"))}</button></div>
      </div>`;
    }).join("");
    $("#cartSubtotal").textContent = money(t0.subtotal);
    $("#discountRow").hidden = !t0.discount;
    $("#discountLabel").textContent = promo ? t("cart.discount", { code: promo.code }) : "";
    $("#cartDiscount").textContent = `−${money(t0.discount)}`;
    $("#cartShipping").textContent = t0.shipping ? money(t0.shipping) : t("cart.free");
    $("#cartTotal").textContent = money(t0.total);
    $("#promoForm").hidden = !!promo;
    $("#promoApplied").hidden = !promo;
    $("#promoText").textContent = promo ? t("promo.ok", { code: promo.code }) : "";
    const approx = cur !== BASE;
    $("#coTotal").textContent = approx ? t("cur.pay", { amount: paid(t0.total) }) : t("co.total", { amount: money(t0.total) });
    ["#curNote", "#coCurNote"].forEach((id) => { $(id).hidden = !approx; $(id).textContent = approx ? t("cur.note", { cur: curName(cur) }) : ""; });
  }

  $("#cartItems").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.inc) {
      const l = cart[b.dataset.inc], max = Math.min(20, stockOf(byId(l.id), l.color || "", l.size));
      if (l.qty >= max) { toast(t("stock.limit", { n: max })); return; }
      l.qty += 1;
    }
    else if (b.dataset.dec) { const l = cart[b.dataset.dec]; l.qty > 1 ? l.qty-- : cart.splice(b.dataset.dec, 1); }
    else if (b.dataset.rm) cart.splice(b.dataset.rm, 1);
    else return;
    save(); renderCart(); refreshPromo();
  });
  $("#cartOpen").addEventListener("click", () => openOverlay($("#cartOverlay")));
  $("#checkoutBtn").addEventListener("click", () => {
    closeOverlay($("#cartOverlay"));
    renderCart();
    openOverlay($("#checkoutOverlay"));
  });

  // ---------- Supabase calls ----------
  async function rpc(fn, args) {
    const r = await fetch(`${SB.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...SB.headers, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  // ---------- promo codes (validated in the database) ----------
  async function refreshPromo() {
    if (!promo || !SB) { promoDiscount = 0; renderCart(); return; }
    try {
      const res = await rpc("check_promo", { p_code: promo.code, p_subtotal: totals().subtotal });
      if (res.valid) promoDiscount = Number(res.discount);
      else { promo = null; promoDiscount = 0; store.set("heja-promo", null); }
    } catch { promoDiscount = 0; }
    renderCart();
  }
  $("#promoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    if (!code) return;
    if (!SB) { toast(t("promo.offline")); return; }
    try {
      const res = await rpc("check_promo", { p_code: code, p_subtotal: totals().subtotal });
      if (!res.valid) { toast(t("promo.bad")); return; }
      promo = { code: res.code }; promoDiscount = Number(res.discount);
      store.set("heja-promo", promo);
      e.target.reset();
      renderCart();
      toast(t("promo.ok", { code: res.code }));
    } catch { toast(t("promo.offline")); }
  });
  $("#promoRemove").addEventListener("click", () => { promo = null; promoDiscount = 0; store.set("heja-promo", null); renderCart(); });

  // ---------- checkout: save order in Supabase, then send via WhatsApp or email ----------
  let via = "whatsapp";
  let placing = false;
  $$("#checkoutForm [data-via]").forEach((b) => b.addEventListener("click", () => (via = b.dataset.via)));
  const setSubmitting = (form, on) => $$("button[type=submit]", form).forEach((b) => (b.disabled = on));

  $("#checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!knownLines().length || placing) return;
    placing = true;
    const form = e.target;
    const d = Object.fromEntries(new FormData(form));
    const tab = via === "whatsapp" ? window.open("about:blank", "_blank") : null; // opened now so it isn't blocked
    setSubmitting(form, true);

    let order;
    try {
      if (SB) {
        const s = await rpc("place_order_v2", {
          p_customer: { name: d.name, phone: d.phone, city: d.city, address: d.address, notes: d.notes || "" },
          p_items: knownLines().map((l) => ({ id: l.id, color: l.color || "", size: l.size, qty: l.qty })),
          p_promo: promo ? promo.code : null
        });
        order = { no: s.order_no, subtotal: s.subtotal, discount: s.discount, promo: s.promo, shipping: s.shipping, total: s.total,
          lines: s.items.map((i) => ({ name: i.name, color: i.color, size: i.size, qty: i.qty, amount: i.price * i.qty })) };
      } else {
        const t1 = totals();
        order = { no: "HJ-" + Date.now().toString(36).toUpperCase().slice(-6), ...t1, promo: null,
          lines: knownLines().map((l) => { const p = byId(l.id); return { name: p.name, color: l.color, size: l.size, qty: l.qty, amount: p.price * l.qty }; }) };
      }
    } catch (err) {
      if (tab) tab.close();
      toast(err.message);
      placing = false;
      setSubmitting(form, false);
      if (/sold out|stock/i.test(err.message)) { await loadRemote(); renderAll(); } // refresh stock so the cart shows what is left
      return;
    }

    // Message for the shop owner (always English so it reads the same every time)
    const fmt = (n) => `${Number(n).toLocaleString("en-US", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${CFG.currency}`;
    const msg = [
      `New order from ${CFG.brand} website`,
      `Order: ${order.no}`,
      "",
      ...order.lines.map((l) => `• ${l.name}${l.color ? ` | ${l.color}` : ""} | Size ${l.size} | x${l.qty} = ${fmt(l.amount)}`),
      "",
      `Subtotal: ${fmt(order.subtotal)}`,
      Number(order.discount) ? `Discount (${order.promo}): -${fmt(order.discount)}` : "",
      `Shipping: ${Number(order.shipping) ? fmt(order.shipping) : "Free"}`,
      `Total: ${fmt(order.total)} (cash on delivery)`,
      "",
      `Name: ${d.name}`,
      `Phone: ${d.phone}`,
      `City: ${d.city}`,
      `Address: ${d.address}`,
      d.notes ? `Notes: ${d.notes}` : ""
    ].filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");

    if (via === "email") {
      window.location.href = `mailto:${CFG.orderEmail}?subject=${encodeURIComponent(`${CFG.brand} order ${order.no}`)}&body=${encodeURIComponent(msg)}`;
    } else {
      const url = `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
      if (tab) tab.location.href = url; else window.open(url, "_blank");
    }

    cart = []; save();
    promo = null; promoDiscount = 0; store.set("heja-promo", null);
    renderCart();
    form.reset();
    placing = false;
    setSubmitting(form, false);
    closeOverlay($("#checkoutOverlay"));
    toast(t("toast.thanks", { no: order.no }));
  });

  // ---------- order tracking ----------
  $("#trackForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("#trackResult");
    if (!SB) { out.textContent = t("track.offline"); return; }
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    try {
      const r = await rpc("track_order_v2", { p_order_no: e.target.no.value, p_phone: e.target.phone.value });
      if (!r.found) { out.innerHTML = `<p>${esc(t("track.notFound"))}</p>`; return; }
      const flow = ["new", "confirmed", "shipped", "delivered"];
      const idx = flow.indexOf(r.status);
      const date = new Date(r.created_at).toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
      out.innerHTML = `<div class="track-card">
        <h4>${esc(r.order_no)}</h4>
        <p class="small">${esc(t("track.placed", { date, city: r.city }))}</p>
        ${r.status === "cancelled"
          ? `<p class="cancelled">${esc(t("status.cancelled"))}</p>`
          : `<div class="steps">${flow.map((s, i) => `<span class="${i <= idx ? "done" : ""}">${esc(t(`status.${s}`))}</span>`).join("")}</div>`}
        <ul>${r.items.map((i) => `<li>${esc(i.name)}${i.color ? ` · ${esc(i.color)}` : ""} · ${esc(i.size)} × ${i.qty}</li>`).join("")}</ul>
        <p><strong>${esc(t("cart.total"))}: ${money(r.total)}</strong></p>
        ${/^https:\/\//.test(r.tracking_url || "") ? `<a class="btn btn-ghost" href="${esc(r.tracking_url)}" target="_blank" rel="noopener">${esc(t("track.courier"))}</a>` : ""}
      </div>`;
    } catch { out.textContent = t("track.offline"); }
    finally { btn.disabled = false; }
  });

  // ---------- returns and exchanges ----------
  $("#returnForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("#returnResult");
    if (!SB) { out.textContent = t("ret.offline"); return; }
    const f = e.target, d = Object.fromEntries(new FormData(f));
    const btn = $("button[type=submit]", f); btn.disabled = true;
    try {
      const r = await rpc("request_return", { p_order_no: d.no, p_phone: d.phone, p_kind: d.kind, p_reason: d.reason, p_details: d.details || "" });
      out.innerHTML = `<div class="track-card"><p>${esc(t("ret.ok", { ref: r.ref }))}</p></div>`;
      f.reset();
    } catch (err) {
      out.innerHTML = `<p>${esc(/not found/i.test(err.message) ? t("ret.notFound") : /cancel/i.test(err.message) ? err.message : t("ret.offline"))}</p>`;
    } finally { btn.disabled = false; }
  });

  // ---------- newsletter ----------
  $("#newsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#newsMsg");
    msg.className = "news-msg";
    if (!SB) { msg.textContent = t("news.offline"); msg.classList.add("err"); return; }
    const btn = $("button", e.target);
    btn.disabled = true;
    try {
      const r = await rpc("subscribe", { p_email: e.target.email.value });
      msg.textContent = t("news.ok", { code: r.code });
      msg.classList.add("ok");
      e.target.reset();
    } catch (err) {
      msg.textContent = /email/i.test(err.message) ? t("news.bad") : t("news.offline");
      msg.classList.add("err");
    } finally { btn.disabled = false; }
  });

  // ---------- AI style assistant (/api/chat → OpenRouter) ----------
  const chat = { history: [], busy: false, greeted: false };
  const addMsg = (who, text) => {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.textContent = text;
    $("#chatLog").appendChild(el);
    $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
    return el;
  };
  if (CFG.assistant) $("#chatOpen").hidden = false;
  $("#chatOpen").addEventListener("click", () => {
    $("#chatPanel").hidden = false;
    $("#chatOpen").hidden = true;
    if (!chat.greeted) { addMsg("bot", t("chat.greet")); chat.greeted = true; }
    $("#chatInput").focus();
  });
  $("#chatClose").addEventListener("click", () => { $("#chatPanel").hidden = true; $("#chatOpen").hidden = false; });
  $("#chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#chatInput").value.trim();
    if (!text || chat.busy) return;
    $("#chatInput").value = "";
    addMsg("me", text);
    chat.history.push({ role: "user", content: text });
    chat.busy = true;
    const typing = addMsg("bot typing", t("chat.typing"));
    let reply, ok = false;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chat.history.slice(-12), currency: CFG.currency })
      });
      const data = await r.json().catch(() => ({}));
      ok = r.ok && !!data.reply;
      reply = ok ? data.reply : data.error || t("chat.offline");
    } catch { reply = t("chat.offline"); }
    typing.textContent = reply;
    typing.className = "msg bot";
    if (ok) chat.history.push({ role: "assistant", content: reply }); else chat.history.pop();
    chat.busy = false;
  });

  // ---------- load live catalog + settings from Supabase ----------
  async function loadRemote() {
    if (!SB) return;
    try {
      const get = (path) => fetch(`${SB.url}/rest/v1/${path}`, { headers: SB.headers });
      const [pr, sr, vr, rr] = await Promise.all([
        get("products?select=*&order=sort_order.asc,name.asc"),
        get("store_settings?select=shipping_fee,free_shipping_over&id=eq.1"),
        get("product_variants?select=product_id,color,color_ar,hex,size,stock,sort_order&order=sort_order.asc"),
        get("reviews?select=product_id,name,rating,fit,comment,created_at&order=created_at.desc&limit=500")
      ]);
      if (!pr.ok) throw new Error("products " + pr.status);
      const rows = await pr.json();
      const variants = vr.ok ? await vr.json() : [];
      const colorsByProduct = {};
      variants.forEach((v) => {
        const list = (colorsByProduct[v.product_id] = colorsByProduct[v.product_id] || []);
        let c = list.find((x) => x.name === v.color);
        if (!c) { c = { name: v.color, nameAr: v.color_ar || "", nameFa: v.color_fa || "", hex: v.hex, stock: {} }; list.push(c); }
        c.stock[v.size] = Number(v.stock) || 0;
      });
      PRODUCTS = rows.map((p, i) => withDefaults({
        id: p.id, name: p.name, nameAr: p.name_ar || "", nameFa: p.name_fa || "", category: p.category, price: Number(p.price), oldPrice: Number(p.old_price) || 0,
        color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#e9e4da", shape: p.shape, sizes: p.sizes || [],
        badge: p.badge || "", image: p.image || "", description: p.description || "", descriptionAr: p.description_ar || "",
        descriptionFa: p.description_fa || "", fabricFa: p.fabric_fa || "", careFa: p.care_fa || "",
        colors: colorsByProduct[p.id] || [], fabric: p.fabric || "", fabricAr: p.fabric_ar || "", care: p.care || "", careAr: p.care_ar || "",
        fit: p.fit || "", order: Date.parse(p.created_at) || i
      }, i));
      REVIEWS = {};
      if (rr.ok) (await rr.json()).forEach((r) => { (REVIEWS[r.product_id] = REVIEWS[r.product_id] || []).push(r); });
      catalogReady = true;
      if (sr.ok) {
        const [st] = await sr.json();
        if (st) { CFG.shippingFee = Number(st.shipping_fee); CFG.freeShippingOver = Number(st.free_shipping_over); }
      }
    } catch (err) {
      console.warn("Using built-in catalog; Supabase unavailable:", err);
    }
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function renderAll() {
    if (pruneCart()) { save(); toast(t("stock.changed")); }
    applyLang(); $("#year").textContent = fmtNum(new Date().getFullYear()).replace(/[,٬]/g, ""); renderAnnounce(); renderHero(); renderFilters(); renderGrid(); renderCart(); renderFavCount(); renderRecent();
  }
  // Show the built-in catalog instantly, then refresh from the database.
  renderAll();
  setupVideo();
  loadRates().then((changed) => { if (changed && cur !== BASE) renderAll(); });
  loadRemote().then(() => { renderAll(); refreshPromo(); openFromHash(); });
})();
