// ============================================================
//  HEJA — owner dashboard. Signs in with Supabase Auth; the
//  database only shows data to emails listed in public.admins.
// ============================================================
(() => {
  const CFG = window.HEJA_CONFIG;
  const URL_ = CFG.supabaseUrl.replace(/\/$/, "");
  const KEY = CFG.supabaseAnonKey;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const usd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const fmtDate = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const dur = (sec) => {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60), s = sec % 60;
    return m < 60 ? `${m}m ${String(s).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");
  let toastT;
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); };

  // ---------- auth ----------
  let auth = store.get("heja-admin", null);
  async function signIn(email, password) {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error_description || d.msg || "Sign-in failed");
    auth = { token: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000, email: d.user && d.user.email };
    store.set("heja-admin", auth);
  }
  async function refreshToken() {
    const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: auth.refresh })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error("Session expired");
    auth = { ...auth, token: d.access_token, refresh: d.refresh_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    store.set("heja-admin", auth);
  }
  function signOut() { store.del("heja-admin"); auth = null; location.reload(); }

  async function api(path, { method = "GET", body, prefer, raw } = {}) {
    if (!auth) throw new Error("Not signed in");
    if (Date.now() > auth.exp) await refreshToken();
    const headers = { apikey: KEY, Authorization: `Bearer ${auth.token}` };
    if (body !== undefined && !raw) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(`${URL_}${path}`, { method, headers, body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined });
    if (r.status === 401) { signOut(); throw new Error("Session expired"); }
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((data && (data.message || data.error)) || `Request failed (${r.status})`);
    return data;
  }
  const rest = (q, opts) => api(`/rest/v1/${q}`, opts);

  // ---------- data ----------
  const D = { orders: [], sessions: [], events: [], products: [], variants: [], reviews: [], returns: [], restock: [], subs: [], promos: [], settings: {} };
  const rangeDays = () => Number($("#range").value);
  const since = () => new Date(Date.now() - rangeDays() * 86400000).toISOString();
  const inRange = (d) => new Date(d) >= new Date(since());

  async function loadAll() {
    $("#loading").hidden = false;
    const s = encodeURIComponent(since());
    const [orders, sessions, events, products, variants, reviews, returns, restock, subs, promos, settings] = await Promise.all([
      rest("orders?select=*,order_items(*)&order=created_at.desc&limit=2000"),
      rest(`analytics_sessions?select=*&started_at=gte.${s}&order=started_at.desc&limit=5000`),
      rest(`analytics_events?select=session_id,at,type,product_id,data&at=gte.${s}&order=at.asc&limit=50000`),
      rest("products?select=*&order=sort_order.asc"),
      rest("product_variants?select=*&order=product_id.asc,sort_order.asc"),
      rest("reviews?select=*&order=created_at.desc"),
      rest("return_requests?select=*&order=created_at.desc"),
      rest("restock_requests?select=*&order=created_at.desc"),
      rest("subscribers?select=*&order=created_at.desc"),
      rest("promo_codes?select=*&order=code.asc"),
      rest("store_settings?select=*&id=eq.1")
    ]);
    Object.assign(D, { orders, sessions, events, products, variants, reviews, returns, restock, subs, promos, settings: settings[0] || {} });
    $("#loading").hidden = true;
    const awaiting = orders.filter((o) => o.payment_status === "awaiting" && o.status !== "cancelled").length;
    setBadge("#badgeOrders", awaiting);
    setBadge("#badgeReviews", reviews.filter((r) => !r.approved).length);
    setBadge("#badgeRequests", returns.filter((r) => r.status === "new").length + restock.filter((r) => !r.notified).length);
  }
  const setBadge = (id, n) => { $(id).hidden = !n; $(id).textContent = n; };
  const productName = (id) => (D.products.find((p) => p.id === id) || {}).name || id;

  // ---------- helpers for analytics ----------
  const TZ = {
    "Asia/Dubai": "UAE", "Asia/Riyadh": "Saudi Arabia", "Asia/Qatar": "Qatar", "Asia/Kuwait": "Kuwait", "Asia/Bahrain": "Bahrain",
    "Asia/Muscat": "Oman", "Africa/Cairo": "Egypt", "Asia/Tehran": "Iran", "Asia/Baghdad": "Iraq", "Asia/Amman": "Jordan",
    "Asia/Beirut": "Lebanon", "Asia/Damascus": "Syria", "Asia/Kabul": "Afghanistan", "Asia/Dushanbe": "Tajikistan",
    "Europe/Istanbul": "Turkey", "Europe/London": "UK", "Europe/Paris": "France", "Europe/Berlin": "Germany",
    "Europe/Brussels": "Belgium", "Europe/Amsterdam": "Netherlands", "Europe/Stockholm": "Sweden", "Europe/Oslo": "Norway",
    "Europe/Copenhagen": "Denmark", "Europe/Madrid": "Spain", "Europe/Rome": "Italy", "Europe/Vienna": "Austria", "Europe/Zurich": "Switzerland",
    "America/New_York": "USA", "America/Chicago": "USA", "America/Denver": "USA", "America/Los_Angeles": "USA",
    "America/Toronto": "Canada", "America/Vancouver": "Canada", "Asia/Karachi": "Pakistan", "Asia/Kolkata": "India", "Asia/Calcutta": "India",
    "Africa/Casablanca": "Morocco", "Africa/Algiers": "Algeria", "Africa/Tunis": "Tunisia", "Australia/Sydney": "Australia", "Australia/Melbourne": "Australia"
  };
  const country = (s) => TZ[s.timezone] || s.timezone || "Unknown";
  const source = (s) => {
    if (s.utm_source) return s.utm_source.toLowerCase();
    const r = (s.referrer || "").toLowerCase();
    if (!r) return "direct";
    for (const [k, v] of [["instagram", "instagram"], ["facebook", "facebook"], ["fb.", "facebook"], ["tiktok", "tiktok"], ["snapchat", "snapchat"],
      ["google", "google"], ["bing", "bing"], ["whatsapp", "whatsapp"], ["wa.me", "whatsapp"], ["t.co", "x / twitter"], ["twitter", "x / twitter"], ["youtube", "youtube"]]) if (r.includes(k)) return v;
    return r.replace(/^https?:\/\//, "").split("/")[0];
  };
  const LANG = { en: "English", ar: "Arabic", fa: "Persian" };
  const sessionEvents = (id) => D.events.filter((e) => e.session_id === id);
  const durationOf = (s) => (new Date(s.last_seen) - new Date(s.started_at)) / 1000;
  const countBy = (arr, fn) => { const m = new Map(); arr.forEach((x) => { const k = fn(x); if (k != null) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const bars = (rows, total, cls = "") => rows.length
    ? `<div class="bars">${rows.slice(0, 8).map(([k, v]) => `<div class="bar-row"><span class="name" title="${esc(k)}">${esc(k)}</span><span class="track"><span class="fill ${cls}" style="width:${total ? Math.max(2, (v / total) * 100) : 0}%"></span></span><span class="num">${v}</span></div>`).join("")}</div>`
    : `<p class="note">No data yet.</p>`;
  const kpi = (v, label, small = "") => `<div class="kpi"><b>${v}</b><span>${esc(label)}</span>${small ? `<small>${esc(small)}</small>` : ""}</div>`;

  // ---------- views ----------
  const VIEWS = {
    overview() {
      const S = D.sessions, E = D.events;
      const orders = D.orders.filter((o) => inRange(o.created_at) && o.status !== "cancelled");
      const hasType = (t) => new Set(E.filter((e) => e.type === t).map((e) => e.session_id));
      const viewed = hasType("view_product"), carted = hasType("add_to_cart"), checkout = hasType("begin_checkout");
      const unique = new Set(S.map((s) => s.visitor_id).filter(Boolean)).size;
      const avgDur = S.length ? S.reduce((a, s) => a + durationOf(s), 0) / S.length : 0;
      const firstAt = (sid, type) => { const e = E.find((x) => x.session_id === sid && x.type === type); return e ? new Date(e.at) : null; };
      const toCheckout = [...checkout].map((sid) => { const s = S.find((x) => x.id === sid); const a = firstAt(sid, "begin_checkout"); return s && a ? (a - new Date(s.started_at)) / 1000 : null; }).filter((x) => x != null);
      const ordered = S.filter((s) => s.converted);
      const toOrder = ordered.map((s) => { const a = firstAt(s.id, "order_placed"); return a ? (a - new Date(s.started_at)) / 1000 : null; }).filter((x) => x != null);
      const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
      const paid = orders.filter((o) => o.payment_status === "paid").reduce((a, o) => a + Number(o.total), 0);
      const awaiting = orders.filter((o) => o.payment_status === "awaiting").reduce((a, o) => a + Number(o.total), 0);
      const abandoned = [...carted].filter((sid) => !S.find((s) => s.id === sid && s.converted)).length;

      // daily chart
      const days = Math.min(rangeDays(), 30);
      const dayKeys = [...Array(days)].map((_, i) => { const d = new Date(Date.now() - (days - 1 - i) * 86400000); return d.toISOString().slice(0, 10); });
      const perDay = (arr, field) => dayKeys.map((k) => arr.filter((x) => String(x[field]).slice(0, 10) === k).length);
      const sd = perDay(S, "started_at"), od = perDay(orders, "created_at"), mx = Math.max(1, ...sd, ...od);
      const chart = `<div class="chart">${dayKeys.map((k, i) => `<div class="day" title="${k}: ${sd[i]} visits, ${od[i]} orders"><div class="s" style="height:${(sd[i] / mx) * 100}%"></div><div class="o" style="height:${(od[i] / mx) * 100}%"></div></div>`).join("")}</div>
        <div class="chart-labels">${dayKeys.map((k, i) => `<span>${i % Math.ceil(days / 7) === 0 ? k.slice(5) : ""}</span>`).join("")}</div>
        <div class="legend"><span><i style="background:#EDE9E3;border:1px solid #d6cfc4"></i>Visits</span><span><i style="background:#9A4A2C"></i>Orders</span></div>`;

      const funnel = [["Visits", S.length], ["Viewed a product", viewed.size], ["Added to cart", carted.size], ["Started checkout", checkout.size], ["Placed an order", ordered.length]];
      const prodViews = countBy(E.filter((e) => e.type === "view_product" && e.product_id), (e) => productName(e.product_id));
      const prodAdds = countBy(E.filter((e) => e.type === "add_to_cart" && e.product_id), (e) => productName(e.product_id));
      const sold = new Map();
      orders.forEach((o) => (o.order_items || []).forEach((i) => sold.set(i.product_name, (sold.get(i.product_name) || 0) + i.qty)));
      const soldRows = [...sold.entries()].sort((a, b) => b[1] - a[1]);
      const searches = countBy(E.filter((e) => e.type === "search" && e.data && e.data.q), (e) => String(e.data.q).toLowerCase());

      return `
        <div class="kpis">
          ${kpi(S.length, "Visits", `${unique} unique visitors`)}
          ${kpi(pct(S.filter((s) => s.is_returning).length, S.length), "Returning visitors")}
          ${kpi(dur(avgDur), "Average visit")}
          ${kpi(checkout.size, "Started checkout", `avg ${dur(avg(toCheckout))} after arriving`)}
          ${kpi(orders.length, "Orders", `avg ${dur(avg(toOrder))} from arrival to order`)}
          ${kpi(pct(ordered.length, S.length), "Conversion rate", "visits that ordered")}
          ${kpi(usd(paid), "Paid revenue")}
          ${kpi(usd(awaiting), "Awaiting payment", plural(orders.filter((o) => o.payment_status === "awaiting").length, "order"))}
          ${kpi(abandoned, "Abandoned carts", "added to cart, no order")}
        </div>
        <div class="card" style="margin-bottom:20px"><h3>Visits and orders per day</h3>${chart}</div>
        <div class="grid2">
          <div class="card"><h3>Shopping funnel</h3>${bars(funnel, S.length, "clay")}</div>
          <div class="card"><h3>Where visitors come from</h3>${bars(countBy(S, source), S.length)}</div>
          <div class="card"><h3>Most viewed products</h3>${bars(prodViews, prodViews[0] ? prodViews[0][1] : 0)}</div>
          <div class="card"><h3>Most added to cart</h3>${bars(prodAdds, prodAdds[0] ? prodAdds[0][1] : 0)}</div>
          <div class="card"><h3>Best sellers (units)</h3>${bars(soldRows, soldRows[0] ? soldRows[0][1] : 0, "clay")}</div>
          <div class="card"><h3>Countries <small class="note">(from time zone)</small></h3>${bars(countBy(S, country), S.length)}</div>
          <div class="card"><h3>Devices</h3>${bars(countBy(S, (s) => s.device || "unknown"), S.length)}</div>
          <div class="card"><h3>Languages</h3>${bars(countBy(S, (s) => LANG[s.lang] || s.lang || "unknown"), S.length)}</div>
          <div class="card"><h3>What people search for</h3>${bars(searches, searches[0] ? searches[0][1] : 0)}</div>
          <div class="card"><h3>Browsers</h3>${bars(countBy(S, (s) => s.browser || "unknown"), S.length)}</div>
        </div>
        <p class="note">Visitor statistics include only visitors who accepted analytics on the site.</p>`;
    },

    orders() {
      const f = state.orderFilter, q = state.orderQuery.toLowerCase();
      const list = D.orders.filter((o) => inRange(o.created_at)).filter((o) =>
        (f === "all" || (f === "awaiting" && o.payment_status === "awaiting" && o.status !== "cancelled") || (f === "paid" && o.payment_status === "paid")
          || (f === "shipped" && o.status === "shipped") || (f === "cancelled" && o.status === "cancelled")) &&
        (!q || `${o.order_no} ${o.customer_name} ${o.phone} ${o.city}`.toLowerCase().includes(q)));
      const chips = [["all", "All"], ["awaiting", "Awaiting payment"], ["paid", "Paid"], ["shipped", "Shipped"], ["cancelled", "Cancelled"]]
        .map(([k, l]) => `<button class="chip ${f === k ? "active" : ""}" data-of="${k}">${l}</button>`).join("");
      return `<div class="toolbar">${chips}<span class="grow"></span><input type="search" id="orderSearch" placeholder="Search order, name, phone…" value="${esc(state.orderQuery)}"><button class="btn ghost" data-csv="orders">Export CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Phone</th><th>City</th><th>Items</th><th class="num">Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>
        ${list.map((o) => `<tr class="click" data-order="${esc(o.order_no)}"><td><strong>${esc(o.order_no)}</strong></td><td>${fmtDate(o.created_at)}</td><td>${esc(o.customer_name)}</td><td>${esc(o.phone)}</td><td>${esc(o.city)}</td>
          <td>${(o.order_items || []).reduce((a, i) => a + i.qty, 0)}</td><td class="num">${usd(o.total)}</td><td>${payPill(o)}</td><td>${statusPill(o.status)}</td></tr>`).join("")
          || `<tr><td colspan="9" class="empty">No orders in this period.</td></tr>`}
        </tbody></table></div>`;
    },

    visitors() {
      const list = D.sessions;
      return `<div class="toolbar"><span class="note">${list.length} visits. Click a visit to see the full journey from arrival to leaving.</span><span class="grow"></span><button class="btn ghost" data-csv="visitors">Export CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Arrived</th><th>Time on site</th><th>Source</th><th>Country</th><th>Device</th><th>Language</th><th class="num">Actions</th><th>Result</th></tr></thead><tbody>
        ${list.map((s) => `<tr class="click" data-session="${esc(s.id)}"><td>${fmtDate(s.started_at)}${s.is_returning ? ' <span class="pill blue">returning</span>' : ""}</td><td>${dur(durationOf(s))}</td><td>${esc(source(s))}</td><td>${esc(country(s))}</td>
          <td>${esc(s.device)} · ${esc(s.browser)}</td><td>${esc(LANG[s.lang] || s.lang)}</td><td class="num">${s.events}</td>
          <td>${s.converted ? `<span class="pill ok">ordered ${esc(s.order_no)}</span>` : sessionEvents(s.id).some((e) => e.type === "begin_checkout") ? '<span class="pill warn">checkout, no order</span>' : sessionEvents(s.id).some((e) => e.type === "add_to_cart") ? '<span class="pill warn">cart, no order</span>' : '<span class="pill muted">browsed</span>'}</td></tr>`).join("")
          || `<tr><td colspan="8" class="empty">No visits recorded yet in this period.</td></tr>`}
        </tbody></table></div>`;
    },

    customers() {
      const by = new Map();
      D.orders.filter((o) => o.status !== "cancelled").forEach((o) => {
        const k = String(o.phone).replace(/\D/g, "");
        const c = by.get(k) || { name: o.customer_name, phone: o.phone, city: o.city, orders: 0, spent: 0, paid: 0, last: o.created_at };
        c.orders += 1; c.spent += Number(o.total); if (o.payment_status === "paid") c.paid += Number(o.total);
        if (new Date(o.created_at) > new Date(c.last)) { c.last = o.created_at; c.name = o.customer_name; c.city = o.city; }
        by.set(k, c);
      });
      const list = [...by.values()].sort((a, b) => b.spent - a.spent);
      state.customerRows = list;
      return `<div class="toolbar"><span class="note">${list.length} customers who placed orders.</span><span class="grow"></span><button class="btn ghost" data-csv="customers">Export CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>City</th><th class="num">Orders</th><th class="num">Ordered</th><th class="num">Paid</th><th>Last order</th><th></th></tr></thead><tbody>
        ${list.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.city)}</td><td class="num">${c.orders}</td><td class="num">${usd(c.spent)}</td><td class="num">${usd(c.paid)}</td><td>${fmtDate(c.last)}</td>
          <td><a class="btn wa small" href="${waLink(c.phone, "")}" target="_blank" rel="noopener">WhatsApp</a></td></tr>`).join("")
          || `<tr><td colspan="8" class="empty">No customers yet.</td></tr>`}
        </tbody></table></div>
        <h3 style="margin:28px 0 10px">Newsletter subscribers (${D.subs.length})</h3>
        <div class="toolbar"><button class="btn ghost" data-csv="subscribers">Export CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Email</th><th>Joined</th></tr></thead><tbody>
        ${D.subs.map((s) => `<tr><td>${esc(s.email)}</td><td>${fmtDate(s.created_at)}</td></tr>`).join("") || `<tr><td colspan="2" class="empty">No subscribers yet.</td></tr>`}
        </tbody></table></div>`;
    },

    products() {
      const cats = ["Women", "Unisex", "Accessories", "Bags", "Men", "Kids"];
      const shapes = ["tee", "shirt", "hoodie", "pants", "dress", "jacket", "skirt", "cap"];
      return `<p class="note">Prices are in US dollars. Stock goes down automatically with each order; cancelled orders put stock back.</p>
        ${D.products.map((p) => {
          const vs = D.variants.filter((v) => v.product_id === p.id);
          const colours = [...new Set(vs.map((v) => v.color))];
          return `<div class="prod" data-product="${esc(p.id)}">
            <div class="prod-head">
              <div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : "No photo"}</div>
              <div class="prod-fields">
                <label class="field">Name<input data-f="name" value="${esc(p.name)}"></label>
                <label class="field">Arabic name<input data-f="name_ar" value="${esc(p.name_ar)}" dir="rtl"></label>
                <label class="field">Persian name<input data-f="name_fa" value="${esc(p.name_fa)}" dir="rtl"></label>
                <label class="field">Category<select data-f="category">${cats.map((c) => `<option ${c === p.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
                <label class="field">Price (USD)<input data-f="price" type="number" min="0" step="0.01" value="${Number(p.price)}"></label>
                <label class="field">Was (USD, for sale)<input data-f="old_price" type="number" min="0" step="0.01" value="${Number(p.old_price)}"></label>
                <label class="field">Label<select data-f="badge">${["", "New", "Bestseller", "Sale"].map((b) => `<option value="${b}" ${b === p.badge ? "selected" : ""}>${b || "None"}</option>`).join("")}</select></label>
                <label class="field">Visible in shop<select data-f="active"><option value="true" ${p.active ? "selected" : ""}>Yes</option><option value="false" ${!p.active ? "selected" : ""}>Hidden</option></select></label>
              </div>
              <div class="actions">
                <label class="btn ghost small">Upload photo<input type="file" accept="image/*" data-upload="${esc(p.id)}" hidden></label>
                <button class="btn small" data-save-product="${esc(p.id)}">Save</button>
              </div>
            </div>
            ${colours.length ? `<div class="stock-grid"><table><thead><tr><th>Colour</th>${p.sizes.map((s) => `<th>${esc(s)}</th>`).join("")}</tr></thead><tbody>
              ${colours.map((c) => { const hex = (vs.find((v) => v.color === c) || {}).hex; return `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${esc(hex)};margin-inline-end:6px"></span>${esc(c)}</td>
                ${p.sizes.map((s) => { const v = vs.find((x) => x.color === c && x.size === s); return v ? `<td class="${v.stock === 0 ? "zero" : v.stock <= 3 ? "low" : ""}"><input type="number" min="0" data-variant="${v.id}" value="${v.stock}" aria-label="${esc(c)} ${esc(s)} stock"></td>` : "<td>–</td>"; }).join("")}</tr>`; }).join("")}
              </tbody></table></div>` : `<p class="note">No colours yet. Add one below.</p>`}
            <div class="toolbar"><input data-newcolor="${esc(p.id)}" placeholder="Add colour, e.g. Navy #1F2A44"><button class="btn ghost small" data-addcolor="${esc(p.id)}">Add colour</button></div>
          </div>`;
        }).join("")}
        <div class="card"><h3>Add a new product</h3>
          <form id="newProduct" class="form-grid">
            <label class="field">Name<input name="name" required></label>
            <label class="field">Category<select name="category">${cats.map((c) => `<option>${c}</option>`).join("")}</select></label>
            <label class="field">Price (USD)<input name="price" type="number" min="0" step="0.01" required></label>
            <label class="field">Sizes (comma separated)<input name="sizes" value="XS, S, M, L" required></label>
            <label class="field">Drawing until you add a photo<select name="shape">${shapes.map((s) => `<option>${s}</option>`).join("")}</select></label>
            <label class="field">First colour (name #hex)<input name="colour" value="Black #1A1A1A"></label>
            <label class="field" style="grid-column:1/-1">Description<textarea name="description" rows="2"></textarea></label>
            <button class="btn" type="submit">Add product</button>
          </form></div>`;
    },

    reviews() {
      return `<div class="table-wrap"><table><thead><tr><th>Product</th><th>Name</th><th>Rating</th><th>Fit</th><th>Review</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>
        ${D.reviews.map((r) => `<tr><td>${esc(productName(r.product_id))}</td><td>${esc(r.name)}</td><td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td><td>${esc(r.fit)}</td><td>${esc(r.comment)}</td><td>${fmtDate(r.created_at)}</td>
          <td>${r.approved ? '<span class="pill ok">published</span>' : '<span class="pill warn">waiting</span>'}</td>
          <td class="actions"><button class="btn small ${r.approved ? "ghost" : "ok"}" data-review="${r.id}" data-approve="${!r.approved}">${r.approved ? "Hide" : "Publish"}</button>
          <button class="btn ghost small" data-delreview="${r.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="8" class="empty">No reviews yet.</td></tr>`}
        </tbody></table></div>`;
    },

    requests() {
      const RS = ["new", "approved", "received", "done", "rejected"];
      return `<h3 style="margin-bottom:10px">Returns and exchanges</h3>
        <div class="table-wrap"><table><thead><tr><th>Ref</th><th>Order</th><th>Type</th><th>Reason</th><th>Details</th><th>Date</th><th>Status</th></tr></thead><tbody>
        ${D.returns.map((r) => `<tr><td><strong>${esc(r.ref)}</strong></td><td><button class="link" data-order="${esc(r.order_no)}">${esc(r.order_no)}</button></td><td>${esc(r.kind)}</td><td>${esc(r.reason)}</td><td>${esc(r.details)}</td><td>${fmtDate(r.created_at)}</td>
          <td><select data-return="${r.id}">${RS.map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("") || `<tr><td colspan="7" class="empty">No return requests.</td></tr>`}
        </tbody></table></div>
        <h3 style="margin:28px 0 10px">Waiting for a size to come back</h3>
        <div class="table-wrap"><table><thead><tr><th>Product</th><th>Colour</th><th>Size</th><th>Email</th><th>Asked</th><th></th></tr></thead><tbody>
        ${D.restock.map((r) => `<tr><td>${esc(productName(r.product_id))}</td><td>${esc(r.color)}</td><td>${esc(r.size)}</td><td>${esc(r.contact)}</td><td>${fmtDate(r.created_at)}</td>
          <td class="actions"><a class="btn ghost small" href="mailto:${esc(r.contact)}?subject=${encodeURIComponent(`${productName(r.product_id)} is back at Heja`)}">Email</a>
          ${r.notified ? '<span class="pill ok">notified</span>' : `<button class="btn small" data-notified="${r.id}">Mark notified</button>`}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No requests.</td></tr>`}
        </tbody></table></div>`;
    },

    marketing() {
      return `<h3 style="margin-bottom:10px">Promo codes</h3>
        <div class="table-wrap"><table><thead><tr><th>Code</th><th>Discount</th><th>Minimum order</th><th>Expires</th><th>Used in orders</th><th>Active</th></tr></thead><tbody>
        ${D.promos.map((p) => `<tr><td><strong>${esc(p.code)}</strong></td><td>${p.percent_off ? `${p.percent_off}%` : usd(p.amount_off)}</td><td>${Number(p.min_subtotal) ? usd(p.min_subtotal) : "–"}</td>
          <td>${p.expires_at ? fmtDate(p.expires_at) : "Never"}</td><td>${D.orders.filter((o) => o.promo_code === p.code).length}</td>
          <td><select data-promo="${esc(p.code)}"><option value="true" ${p.active ? "selected" : ""}>Active</option><option value="false" ${!p.active ? "selected" : ""}>Off</option></select></td></tr>`).join("")}
        </tbody></table></div>
        <div class="card" style="margin-top:16px"><h3>New promo code</h3>
          <form id="newPromo" class="form-grid">
            <label class="field">Code<input name="code" required placeholder="EID20" style="text-transform:uppercase"></label>
            <label class="field">Percent off<input name="percent" type="number" min="1" max="90" placeholder="20"></label>
            <label class="field">or amount off (USD)<input name="amount" type="number" min="1" step="0.01"></label>
            <label class="field">Minimum order (USD)<input name="min" type="number" min="0" step="0.01" value="0"></label>
            <label class="field">Expires (optional)<input name="expires" type="date"></label>
            <button class="btn" type="submit">Create code</button>
          </form></div>`;
    },

    settings() {
      const s = D.settings, so = s.social || {};
      const NET = [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"], ["snapchat", "Snapchat"], ["x", "X (Twitter)"], ["youtube", "YouTube"], ["pinterest", "Pinterest"]];
      return `<form id="settingsForm" class="card" style="display:grid;gap:16px">
          <h3>Shop</h3>
          <div class="form-grid">
            <label class="field">WhatsApp number (orders go here)<input name="whatsapp" value="${esc(s.whatsapp_number || CFG.whatsappNumber)}" placeholder="971545977453"></label>
            <label class="field">Shipping fee (USD)<input name="shipping" type="number" min="0" step="0.01" value="${Number(s.shipping_fee)}"></label>
            <label class="field">Free shipping over (USD, 0 = never)<input name="free" type="number" min="0" step="0.01" value="${Number(s.free_shipping_over)}"></label>
            <label class="field">Toman per 1 USD (display only)<input name="toman" type="number" min="0" step="1" value="${Number(s.toman_per_usd) || ""}" placeholder="${CFG.currencies && CFG.currencies.IRT ? CFG.currencies.IRT.perUsd : ""}"></label>
          </div>
          <h3>Social media pages</h3>
          <p class="note">Paste the full link of each page. Empty ones are hidden on the site.</p>
          <div class="form-grid">${NET.map(([k, l]) => `<label class="field">${l}<input name="social_${k}" type="url" value="${esc(so[k] || "")}" placeholder="https://"></label>`).join("")}</div>
          <button class="btn" type="submit">Save settings</button>
        </form>
        <form id="payMsgForm" class="card" style="display:grid;gap:12px;margin-top:20px">
          <h3>Payment message</h3>
          <p class="note">Sent to customers from an order's WhatsApp button. Put your bank details here. Saved only in this browser, never on the website. Placeholders: {name}, {order}, {total}.</p>
          <textarea name="tpl" rows="7">${esc(payTemplate())}</textarea>
          <button class="btn ghost" type="submit">Save message</button>
        </form>`;
    }
  };

  // ---------- small renderers ----------
  const payPill = (o) => o.status === "cancelled" ? '<span class="pill muted">–</span>'
    : o.payment_status === "paid" ? '<span class="pill ok">paid</span>' : o.payment_status === "refunded" ? '<span class="pill muted">refunded</span>' : '<span class="pill warn">awaiting</span>';
  const statusPill = (s) => `<span class="pill ${({ new: "warn", confirmed: "blue", shipped: "blue", delivered: "ok", cancelled: "bad" })[s] || "muted"}">${esc(s)}</span>`;
  const waLink = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  const DEFAULT_TPL = "Hello {name}, thank you for your Heja order {order}.\nTotal to pay: {total}\n\nPlease transfer to:\nBank: \nAccount name: \nIBAN: \n\nSend us a photo of the transfer receipt and we'll ship your order.";
  const payTemplate = () => store.get("heja-pay-template", DEFAULT_TPL);
  const fillTpl = (o) => payTemplate().replace(/\{name\}/g, o.customer_name).replace(/\{order\}/g, o.order_no).replace(/\{total\}/g, usd(o.total));

  // ---------- detail panels ----------
  function openPanel(title, html) { $("#panelTitle").textContent = title; $("#panelBody").innerHTML = html; $("#panelWrap").hidden = false; $("#panelClose").focus(); }
  function closePanel() { $("#panelWrap").hidden = true; }

  function orderPanel(no) {
    const o = D.orders.find((x) => x.order_no === no);
    if (!o) return toast("Order not found");
    const items = (o.order_items || []).map((i) => `<tr><td>${esc(i.product_name)}</td><td>${esc(i.color)}</td><td>${esc(i.size)}</td><td class="num">${i.qty}</td><td class="num">${usd(i.unit_price * i.qty)}</td></tr>`).join("");
    const s = o.session_id && D.sessions.find((x) => x.id === o.session_id);
    openPanel(o.order_no, `
      <div class="actions">${payPill(o)} ${statusPill(o.status)} <span class="note">${fmtDate(o.created_at)}</span></div>
      <div><h4>Customer</h4><dl class="dl"><dt>Name</dt><dd>${esc(o.customer_name)}</dd><dt>Phone</dt><dd>${esc(o.phone)}</dd><dt>City</dt><dd>${esc(o.city)}</dd><dt>Address</dt><dd>${esc(o.address)}</dd>${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ""}</dl></div>
      <div><h4>Items</h4><div class="table-wrap"><table><thead><tr><th>Product</th><th>Colour</th><th>Size</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody>${items}</tbody></table></div>
        <dl class="dl" style="margin-top:8px"><dt>Subtotal</dt><dd>${usd(o.subtotal)}</dd>${Number(o.discount) ? `<dt>Discount</dt><dd>−${usd(o.discount)} (${esc(o.promo_code)})</dd>` : ""}<dt>Shipping</dt><dd>${Number(o.shipping) ? usd(o.shipping) : "Free"}</dd><dt><strong>Total</strong></dt><dd><strong>${usd(o.total)}</strong></dd></dl></div>
      <div><h4>Payment by bank transfer</h4><div class="actions">
        <a class="btn wa" href="${waLink(o.phone, fillTpl(o))}" target="_blank" rel="noopener">Send bank details on WhatsApp</a>
        ${o.payment_status !== "paid" ? `<button class="btn ok" data-markpaid="${esc(o.order_no)}">Mark as paid</button>` : `<span class="note">Paid ${o.paid_at ? fmtDate(o.paid_at) : ""}</span>`}
      </div></div>
      <div><h4>Order status</h4><div class="actions">
        <select id="statusSel">${["new", "confirmed", "shipped", "delivered", "cancelled"].map((x) => `<option ${x === o.status ? "selected" : ""}>${x}</option>`).join("")}</select>
        <button class="btn ghost" data-savestatus="${esc(o.order_no)}">Update status</button></div>
        <p class="note">Cancelling puts the items back in stock.</p></div>
      <div><h4>Courier tracking link</h4><div class="actions"><input id="trackUrl" type="url" placeholder="https://…" value="${esc(o.tracking_url)}" style="flex:1"><button class="btn ghost" data-savetrack="${esc(o.order_no)}">Save</button></div></div>
      ${s ? `<div><h4>How this customer shopped</h4>${timelineHtml(s)}</div>` : '<p class="note">No visitor journey for this order (the customer declined analytics).</p>'}`);
  }

  const EVENT_TEXT = {
    open: (e) => `Arrived on ${esc(e.data.page || "the shop")}`, view_product: (e) => `Viewed ${esc(productName(e.product_id))}`,
    add_to_cart: (e) => `<strong>Added to cart:</strong> ${esc(productName(e.product_id))} ${e.data.color ? `· ${esc(e.data.color)}` : ""} · ${esc(e.data.size || "")} × ${esc(e.data.qty || 1)}`,
    remove_from_cart: (e) => `Removed ${esc(productName(e.product_id))} from cart`, open_cart: () => "Opened the cart",
    begin_checkout: (e) => `<strong>Started checkout</strong> (${usd(e.data.total)})`, order_placed: (e) => `<strong>Placed order ${esc(e.data.order_no)}</strong> (${usd(e.data.total)})`,
    search: (e) => `Searched “${esc(e.data.q)}”`, filter: (e) => `Filtered: ${esc(Object.entries(e.data).map(([k, v]) => `${k} ${v}`).join(", "))}`,
    lang: (e) => `Switched language to ${esc(LANG[e.data.lang] || e.data.lang)}`, currency: (e) => `Switched currency to ${esc(e.data.cur)}`,
    size_finder: (e) => `Used Find my size → ${esc(e.data.size || "no match")}`, size_guide: () => "Opened the size guide",
    review: (e) => `Wrote a review of ${esc(productName(e.product_id))}`, restock: (e) => `Asked to be notified: ${esc(productName(e.product_id))} ${esc(e.data.size || "")}`,
    return: () => "Sent a return request", newsletter: () => "Joined the newsletter", whatsapp: () => "Opened WhatsApp chat",
    favourite: (e) => `${e.data.on ? "Saved" : "Removed"} favourite: ${esc(productName(e.product_id))}`, share: (e) => `Shared ${esc(productName(e.product_id))}`,
    track_order: () => "Tracked an order", chat: () => "Asked the AI assistant", page_hidden: () => "Switched away from the tab",
    page_visible: () => "Came back to the tab", close: () => "<strong>Left the site</strong>"
  };
  function timelineHtml(s) {
    const ev = sessionEvents(s.id);
    const t0 = new Date(s.started_at);
    const rel = (d) => { const x = (new Date(d) - t0) / 1000; return `+${dur(x)}`; };
    return `<dl class="dl"><dt>Arrived</dt><dd>${fmtDate(s.started_at)}</dd><dt>Time on site</dt><dd>${dur(durationOf(s))}</dd><dt>Came from</dt><dd>${esc(source(s))}${s.utm_campaign ? ` (campaign: ${esc(s.utm_campaign)})` : ""}</dd>
      <dt>Country</dt><dd>${esc(country(s))}</dd><dt>Device</dt><dd>${esc(s.device)} · ${esc(s.os)} · ${esc(s.browser)} · ${esc(s.screen)}</dd><dt>Language</dt><dd>${esc(LANG[s.lang] || s.lang)} · ${esc(s.currency)}</dd>
      <dt>Visitor</dt><dd>${s.is_returning ? "Returning visitor" : "First visit"}</dd></dl>
      <ul class="timeline" style="margin-top:14px">${ev.map((e) => `<li class="${e.type === "order_placed" ? "win" : ["add_to_cart", "begin_checkout"].includes(e.type) ? "key" : ""}"><time>${rel(e.at)}</time>${(EVENT_TEXT[e.type] || ((x) => esc(x.type)))({ ...e, data: e.data || {} })}</li>`).join("") || "<li>No actions recorded.</li>"}</ul>`;
  }
  function sessionPanel(id) {
    const s = D.sessions.find((x) => x.id === id);
    if (!s) return;
    openPanel(s.converted ? `Visit · ordered ${s.order_no}` : "Visit", `${timelineHtml(s)}${s.converted ? `<button class="btn ghost" data-order="${esc(s.order_no)}">Open order ${esc(s.order_no)}</button>` : ""}`);
  }

  // ---------- CSV export ----------
  function csv(name, rows) {
    const text = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = `heja-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }
  const CSV = {
    orders: () => csv("orders", [["Order", "Date", "Name", "Phone", "City", "Address", "Items", "Subtotal", "Discount", "Shipping", "Total", "Payment", "Status"],
      ...D.orders.map((o) => [o.order_no, o.created_at, o.customer_name, o.phone, o.city, o.address, (o.order_items || []).map((i) => `${i.product_name} ${i.color} ${i.size} x${i.qty}`).join("; "), o.subtotal, o.discount, o.shipping, o.total, o.payment_status, o.status])]),
    visitors: () => csv("visitors", [["Arrived", "Seconds on site", "Source", "Campaign", "Country", "Device", "Browser", "OS", "Language", "Actions", "Order"],
      ...D.sessions.map((s) => [s.started_at, Math.round(durationOf(s)), source(s), s.utm_campaign, country(s), s.device, s.browser, s.os, s.lang, s.events, s.order_no || ""])]),
    customers: () => csv("customers", [["Name", "Phone", "City", "Orders", "Ordered USD", "Paid USD", "Last order"], ...(state.customerRows || []).map((c) => [c.name, c.phone, c.city, c.orders, c.spent, c.paid, c.last])]),
    subscribers: () => csv("subscribers", [["Email", "Joined"], ...D.subs.map((s) => [s.email, s.created_at])])
  };

  // ---------- rendering + events ----------
  const state = { view: "overview", orderFilter: "all", orderQuery: "", customerRows: [] };
  const TITLES = { overview: "Overview", orders: "Orders", visitors: "Visitors", customers: "Customers", products: "Products & stock", reviews: "Reviews", requests: "Returns & restock", marketing: "Promo codes & emails", settings: "Settings & social" };
  function render() {
    $("#viewTitle").textContent = TITLES[state.view];
    $$("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
    $("#range").hidden = !["overview", "orders", "visitors"].includes(state.view);
    $("#view").innerHTML = VIEWS[state.view]();
  }
  async function reload() {
    try { await loadAll(); render(); } catch (e) { $("#loading").hidden = true; $("#view").innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
  }
  async function act(fn, ok) {
    try { await fn(); if (ok) toast(ok); await loadAll(); render(); return true; }
    catch (e) { toast(e.message); return false; }
  }

  $("#nav").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) { state.view = b.dataset.view; render(); } });
  $("#range").addEventListener("change", reload);
  $("#refresh").addEventListener("click", reload);
  $("#logout").addEventListener("click", signOut);
  $("#panelClose").addEventListener("click", closePanel);
  $("#panelWrap").addEventListener("click", (e) => { if (e.target.id === "panelWrap") closePanel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button, tr.click, a");
    if (!t) return;
    const d = t.dataset;
    if (d.order) { orderPanel(d.order); return; }
    if (d.session) { sessionPanel(d.session); return; }
    if (d.of) { state.orderFilter = d.of; render(); return; }
    if (d.csv) { CSV[d.csv](); return; }
    if (d.markpaid) {
      const ok = await act(() => rest(`orders?order_no=eq.${encodeURIComponent(d.markpaid)}`, { method: "PATCH", body: { payment_status: "paid", paid_at: new Date().toISOString(), ...(D.orders.find((o) => o.order_no === d.markpaid).status === "new" ? { status: "confirmed" } : {}) } }), "Marked as paid");
      if (ok) orderPanel(d.markpaid);
      return;
    }
    if (d.savestatus) {
      const status = $("#statusSel").value;
      if (status === "cancelled" && !confirmInline(t, "Cancel order and restock?")) return;
      if (await act(() => rest(`orders?order_no=eq.${encodeURIComponent(d.savestatus)}`, { method: "PATCH", body: { status } }), "Status updated")) orderPanel(d.savestatus);
      return;
    }
    if (d.savetrack) {
      const url = $("#trackUrl").value.trim();
      if (url && !/^https:\/\//.test(url)) return toast("The link must start with https://");
      if (await act(() => rest(`orders?order_no=eq.${encodeURIComponent(d.savetrack)}`, { method: "PATCH", body: { tracking_url: url } }), "Tracking link saved")) orderPanel(d.savetrack);
      return;
    }
    if (d.review) { await act(() => rest(`reviews?id=eq.${d.review}`, { method: "PATCH", body: { approved: d.approve === "true" } }), d.approve === "true" ? "Review published" : "Review hidden"); return; }
    if (d.delreview) { if (!confirmInline(t, "Delete?")) return; await act(() => rest(`reviews?id=eq.${d.delreview}`, { method: "DELETE" }), "Review deleted"); return; }
    if (d.notified) { await act(() => rest(`restock_requests?id=eq.${d.notified}`, { method: "PATCH", body: { notified: true } }), "Marked as notified"); return; }
    if (d.saveProduct) { await saveProduct(d.saveProduct); return; }
    if (d.addcolor) { await addColour(d.addcolor); return; }
  });
  // Two-step confirm without browser dialogs
  function confirmInline(btn, text) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = text;
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 3000);
    return false;
  }
  document.addEventListener("input", (e) => { if (e.target.id === "orderSearch") { state.orderQuery = e.target.value; const pos = e.target.selectionStart; render(); const i = $("#orderSearch"); i.focus(); i.setSelectionRange(pos, pos); } });
  document.addEventListener("change", async (e) => {
    const t = e.target, d = t.dataset;
    if (d.return) await act(() => rest(`return_requests?id=eq.${d.return}`, { method: "PATCH", body: { status: t.value } }), "Return updated");
    if (d.promo) await act(() => rest(`promo_codes?code=eq.${encodeURIComponent(d.promo)}`, { method: "PATCH", body: { active: t.value === "true" } }), "Promo code updated");
    if (d.upload) await uploadPhoto(d.upload, t.files[0]);
  });
  document.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, v = Object.fromEntries(new FormData(f));
    if (f.id === "loginForm") return;
    if (f.id === "settingsForm") {
      const social = {};
      for (const [k, val] of Object.entries(v)) if (k.startsWith("social_") && val.trim()) {
        if (!/^https:\/\//.test(val.trim())) return toast("Social links must start with https://");
        social[k.slice(7)] = val.trim();
      }
      await act(() => rest("store_settings?id=eq.1", { method: "PATCH", body: {
        whatsapp_number: String(v.whatsapp).replace(/\D/g, ""), shipping_fee: Number(v.shipping) || 0, free_shipping_over: Number(v.free) || 0,
        toman_per_usd: Number(v.toman) || 0, social } }), "Settings saved");
    }
    if (f.id === "payMsgForm") { store.set("heja-pay-template", v.tpl); toast("Payment message saved"); }
    if (f.id === "newPromo") {
      const code = String(v.code).trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return toast("Use 3–20 letters or numbers for the code");
      if (!v.percent && !v.amount) return toast("Enter a percent or an amount");
      await act(() => rest("promo_codes", { method: "POST", body: { code, percent_off: v.percent ? Number(v.percent) : null, amount_off: !v.percent && v.amount ? Number(v.amount) : null,
        min_subtotal: Number(v.min) || 0, expires_at: v.expires ? new Date(v.expires + "T23:59:59").toISOString() : null } }), `Code ${code} created`);
    }
    if (f.id === "newProduct") {
      const id = String(v.name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      if (!id) return toast("Enter a name");
      if (D.products.some((p) => p.id === id)) return toast("A product with this name already exists");
      const sizes = String(v.sizes).split(",").map((s) => s.trim()).filter(Boolean);
      const m = String(v.colour || "").match(/^(.+?)\s*(#[0-9a-fA-F]{6})$/);
      await act(async () => {
        await rest("products", { method: "POST", body: { id, name: v.name, category: v.category, price: Number(v.price), sizes, shape: v.shape, color: m ? m[2] : "#e9e4da",
          description: v.description || "", sort_order: (D.products.length + 1) * 10, active: true } });
        if (m) await rest("product_variants", { method: "POST", body: sizes.map((size, i) => ({ product_id: id, color: m[1].trim(), hex: m[2], size, stock: 0, sort_order: 1 })) });
      }, `${v.name} added. Set its stock and upload a photo.`);
    }
  });

  async function saveProduct(id) {
    const box = $(`[data-product="${CSS.escape(id)}"]`);
    const val = (f) => $(`[data-f="${f}"]`, box).value;
    const patch = { name: val("name"), name_ar: val("name_ar"), name_fa: val("name_fa"), category: val("category"),
      price: Number(val("price")) || 0, old_price: Number(val("old_price")) || 0, badge: val("badge"), active: val("active") === "true" };
    const stock = $$("[data-variant]", box).map((i) => ({ id: i.dataset.variant, stock: Math.max(0, parseInt(i.value, 10) || 0) }));
    await act(async () => {
      await rest(`products?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
      for (const s of stock) {
        const old = D.variants.find((v) => String(v.id) === String(s.id));
        if (old && old.stock !== s.stock) await rest(`product_variants?id=eq.${s.id}`, { method: "PATCH", body: { stock: s.stock } });
      }
    }, `${patch.name} saved`);
  }
  async function addColour(id) {
    const input = $(`[data-newcolor="${CSS.escape(id)}"]`);
    const m = input.value.trim().match(/^(.+?)\s*(#[0-9a-fA-F]{6})$/);
    if (!m) return toast("Write it like: Navy #1F2A44");
    const p = D.products.find((x) => x.id === id);
    await act(() => rest("product_variants", { method: "POST", body: p.sizes.map((size) => ({ product_id: id, color: m[1].trim(), hex: m[2], size, stock: 0, sort_order: 9 })) }), `Colour ${m[1]} added`);
  }
  async function uploadPhoto(id, file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast("Choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast("Photo must be under 5 MB");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${id}/${Date.now()}.${ext}`;
    await act(async () => {
      await api(`/storage/v1/object/product-images/${path}`, { method: "POST", body: file, raw: true });
      await rest(`products?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: { image: `${URL_}/storage/v1/object/public/product-images/${path}` } });
    }, "Photo uploaded");
  }

  // ---------- start ----------
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button", e.target); btn.disabled = true; $("#loginMsg").textContent = "";
    try { await signIn($("#loginEmail").value.trim(), $("#loginPassword").value); await start(); }
    catch (err) { $("#loginMsg").textContent = err.message; }
    finally { btn.disabled = false; }
  });
  async function start() {
    const me = await rest("admins?select=email").catch(() => []);
    if (!me.length) { store.del("heja-admin"); auth = null; $("#loginView").hidden = false; $("#appView").hidden = true;
      $("#loginMsg").textContent = "This account is not a Heja admin. Ask to have your email added to the admins list."; return; }
    $("#loginView").hidden = true; $("#appView").hidden = false;
    $("#whoami").textContent = auth.email || "";
    await reload();
  }
  if (auth) start().catch(() => { $("#loginView").hidden = false; }); else $("#loginView").hidden = false;
})();
