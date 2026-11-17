(() => {
  const CFG = window.HEJA_CONFIG;
  const PRODUCTS = window.HEJA_PRODUCTS;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CART_KEY = "heja-cart";

  // ---------- helpers ----------
  const money = (n) => {
    const v = Number(n).toLocaleString();
    return CFG.currencyPosition === "before" ? `${CFG.currency} ${v}` : `${v} ${CFG.currency}`;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);

  // Lighten/darken a hex color for illustration shading
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (x) => Math.max(0, Math.min(255, x + amt));
    return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  const isDark = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 110;
  };

  // Simple garment illustrations used when a product has no photo
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
  const illustration = (p) => {
    const dark = isDark(p.color);
    const fill = p.color;
    const detail = dark ? shade(p.color, 50) : shade(p.color, -45);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${(SHAPES[p.shape] || SHAPES.tee)(fill, detail)}</svg>`;
  };
  const bgFor = (p) => {
    const n = parseInt(p.color.slice(1), 16);
    const lum = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    if (lum < 110) return shade(p.color, 120);
    if (lum > 200) return shade(p.color, -28); // very light garments get a slightly darker card
    return shade(p.color, 38);
  };
  const media = (p) => (p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : illustration(p));

  // ---------- static content ----------
  $("#tagline").textContent = CFG.tagline;
  $("#year").textContent = new Date().getFullYear();
  const freeShipText = CFG.freeShippingOver > 0 ? `Free shipping on orders over ${money(CFG.freeShippingOver)}` : "Fast delivery to your door";
  $("#announce").textContent = `${freeShipText} · Cash on delivery`;
  $("#waContact").href = `https://wa.me/${CFG.whatsappNumber}`;
  $("#mailContact").href = `mailto:${CFG.orderEmail}`;
  $("#mailContact").textContent = CFG.orderEmail;
  $("#social").innerHTML = Object.entries(CFG.social || {})
    .filter(([, url]) => url)
    .map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${name[0].toUpperCase() + name.slice(1)}</a>`)
    .join("");

  // Hero collage uses product illustrations
  const heroPicks = ["summer-dress", "everyday-hoodie", "kids-tee"].map(byId).filter(Boolean);
  $$(".hero-card").forEach((el, i) => {
    const p = heroPicks[i];
    if (!p) return;
    el.style.backgroundColor = bgFor(p);
    el.style.backgroundImage = p.image
      ? `url("${p.image}")`
      : `url("data:image/svg+xml,${encodeURIComponent(illustration(p).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))}")`;
    if (p.image) el.style.backgroundSize = "cover";
  });

  // ---------- shop: filters, search, sort ----------
  const state = { filter: "All", query: "", sort: "featured" };
  const categories = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  $("#filters").innerHTML = categories
    .map((c) => `<button class="chip" role="tab" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");

  function renderGrid() {
    const q = state.query.trim().toLowerCase();
    let list = PRODUCTS.filter(
      (p) =>
        (state.filter === "All" || p.category === state.filter) &&
        (!q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q))
    );
    if (state.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (state.sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    $$(".chip").forEach((c) => c.classList.toggle("active", c.dataset.cat === state.filter));
    $("#empty").hidden = list.length > 0;
    $("#grid").innerHTML = list
      .map(
        (p) => `
      <article class="card" data-id="${p.id}" tabindex="0" aria-label="${esc(p.name)}">
        <div class="card-media" style="background:${bgFor(p)}">
          ${p.badge ? `<span class="badge ${p.badge.toLowerCase() === "sale" ? "sale" : ""}">${esc(p.badge)}</span>` : ""}
          ${media(p)}
          <button class="quick-add" data-quick="${p.id}">Quick add</button>
        </div>
        <div class="card-info">
          <div><h3>${esc(p.name)}</h3><p class="cat">${esc(p.category)}</p></div>
          <p class="price">${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}${money(p.price)}</p>
        </div>
      </article>`
      )
      .join("");
  }

  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    state.filter = b.dataset.cat;
    renderGrid();
  });
  $$("[data-filter]").forEach((a) =>
    a.addEventListener("click", () => {
      state.filter = categories.includes(a.dataset.filter) ? a.dataset.filter : "All";
      renderGrid();
    })
  );
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });

  $("#grid").addEventListener("click", (e) => {
    const quick = e.target.closest("[data-quick]");
    if (quick) {
      e.stopPropagation();
      const p = byId(quick.dataset.quick);
      if (p.sizes.length === 1) { addToCart(p.id, p.sizes[0], 1); return; }
      openProduct(p.id);
      return;
    }
    const card = e.target.closest(".card");
    if (card) openProduct(card.dataset.id);
  });
  $("#grid").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("card")) openProduct(e.target.dataset.id);
  });

  // ---------- overlays ----------
  let lastFocus = null;
  function openOverlay(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.style.overflow = "hidden";
    const f = el.querySelector("input, button:not(.close)") || el.querySelector("button");
    f && f.focus();
  }
  function closeOverlay(el) {
    el.hidden = true;
    if ($$(".overlay").every((o) => o.hidden)) document.body.style.overflow = "";
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $$(".overlay").forEach((o) =>
    o.addEventListener("click", (e) => {
      if (e.target === o || e.target.closest("[data-close]")) closeOverlay(o);
    })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = $$(".overlay").filter((o) => !o.hidden).pop();
    open && closeOverlay(open);
  });

  // ---------- product modal ----------
  const pm = { id: null, size: null, qty: 1 };
  function openProduct(id) {
    const p = byId(id);
    pm.id = id; pm.size = p.sizes.length === 1 ? p.sizes[0] : null; pm.qty = 1;
    $("#pmMedia").innerHTML = media(p);
    $("#pmMedia").style.background = bgFor(p);
    $("#pmCat").textContent = p.category;
    $("#pmName").textContent = p.name;
    $("#pmPrice").innerHTML = (p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : "") + money(p.price);
    $("#pmDesc").textContent = p.description;
    $("#pmQty").textContent = 1;
    $("#pmSizes").innerHTML = p.sizes
      .map((s) => `<button type="button" class="size ${s === pm.size ? "active" : ""}" data-size="${esc(s)}">${esc(s)}</button>`)
      .join("");
    openOverlay($("#productOverlay"));
  }
  $("#pmSizes").addEventListener("click", (e) => {
    const b = e.target.closest(".size");
    if (!b) return;
    pm.size = b.dataset.size;
    $$(".size", $("#pmSizes")).forEach((x) => x.classList.toggle("active", x === b));
  });
  $("#pmMinus").addEventListener("click", () => { pm.qty = Math.max(1, pm.qty - 1); $("#pmQty").textContent = pm.qty; });
  $("#pmPlus").addEventListener("click", () => { pm.qty = Math.min(20, pm.qty + 1); $("#pmQty").textContent = pm.qty; });
  $("#pmAdd").addEventListener("click", () => {
    if (!pm.size) { toast("Please choose a size"); return; }
    addToCart(pm.id, pm.size, pm.qty);
    closeOverlay($("#productOverlay"));
  });

  // ---------- cart ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { cart = []; }
  cart = cart.filter((l) => byId(l.id));
  const save = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} };

  function addToCart(id, size, qty) {
    const line = cart.find((l) => l.id === id && l.size === size);
    if (line) line.qty += qty; else cart.push({ id, size, qty });
    save(); renderCart();
    const c = $("#cartCount");
    c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
    toast(`Added ${byId(id).name} (${size})`);
  }

  function totals() {
    const subtotal = cart.reduce((s, l) => s + byId(l.id).price * l.qty, 0);
    const free = CFG.freeShippingOver > 0 && subtotal >= CFG.freeShippingOver;
    const shipping = subtotal === 0 || free ? 0 : CFG.shippingFee;
    return { subtotal, shipping, total: subtotal + shipping };
  }

  function renderCart() {
    const count = cart.reduce((s, l) => s + l.qty, 0);
    $("#cartCount").textContent = count;
    $("#cartFoot").hidden = cart.length === 0;
    if (!cart.length) {
      $("#cartItems").innerHTML = `<div class="cart-empty"><p>Your cart is empty.</p><a href="#shop" class="btn btn-ghost" data-close>Start shopping</a></div>`;
      return;
    }
    $("#cartItems").innerHTML = cart
      .map((l, i) => {
        const p = byId(l.id);
        return `<div class="line">
          <div class="line-thumb" style="background:${bgFor(p)}">${media(p)}</div>
          <div><h4>${esc(p.name)}</h4><p class="meta">Size ${esc(l.size)} · ${money(p.price)}</p>
            <div class="qty sm"><button data-dec="${i}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-inc="${i}" aria-label="Increase">+</button></div>
          </div>
          <div class="right"><strong>${money(p.price * l.qty)}</strong><button class="remove" data-rm="${i}">Remove</button></div>
        </div>`;
      })
      .join("");
    const t = totals();
    $("#cartSubtotal").textContent = money(t.subtotal);
    $("#cartShipping").textContent = t.shipping ? money(t.shipping) : "Free";
    $("#cartTotal").textContent = money(t.total);
    const left = CFG.freeShippingOver - t.subtotal;
    $("#shipNote").textContent = CFG.freeShippingOver > 0 && left > 0 ? `Add ${money(left)} more for free shipping.` : "";
  }

  $("#cartItems").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.inc) cart[t.dataset.inc].qty = Math.min(20, cart[t.dataset.inc].qty + 1);
    else if (t.dataset.dec) { const l = cart[t.dataset.dec]; l.qty > 1 ? l.qty-- : cart.splice(t.dataset.dec, 1); }
    else if (t.dataset.rm) cart.splice(t.dataset.rm, 1);
    else return;
    save(); renderCart();
  });
  $("#cartOpen").addEventListener("click", () => openOverlay($("#cartOverlay")));
  $("#checkoutBtn").addEventListener("click", () => {
    closeOverlay($("#cartOverlay"));
    openOverlay($("#checkoutOverlay"));
  });

  // ---------- checkout: send order via WhatsApp or email ----------
  let via = "whatsapp";
  $$("#checkoutForm [data-via]").forEach((b) => b.addEventListener("click", () => (via = b.dataset.via)));
  $("#checkoutForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!cart.length) return;
    const d = Object.fromEntries(new FormData(e.target));
    const t = totals();
    const orderNo = "HJ-" + Date.now().toString(36).toUpperCase().slice(-6);
    const lines = cart.map((l) => {
      const p = byId(l.id);
      return `• ${p.name} | Size ${l.size} | x${l.qty} = ${money(p.price * l.qty)}`;
    });
    const msg = [
      `New order from ${CFG.brand} website`,
      `Order: ${orderNo}`,
      "",
      ...lines,
      "",
      `Subtotal: ${money(t.subtotal)}`,
      `Shipping: ${t.shipping ? money(t.shipping) : "Free"}`,
      `Total: ${money(t.total)} (cash on delivery)`,
      "",
      `Name: ${d.name}`,
      `Phone: ${d.phone}`,
      `City: ${d.city}`,
      `Address: ${d.address}`,
      d.notes ? `Notes: ${d.notes}` : ""
    ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");

    const url = via === "email"
      ? `mailto:${CFG.orderEmail}?subject=${encodeURIComponent(`${CFG.brand} order ${orderNo}`)}&body=${encodeURIComponent(msg)}`
      : `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    cart = []; save(); renderCart();
    e.target.reset();
    closeOverlay($("#checkoutOverlay"));
    toast(`Thank you! Order ${orderNo} is ready to send.`);
  });

  // ---------- toast ----------
  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  renderGrid();
  renderCart();
})();
