// ============================================================
//  HEJA — store settings. Edit this file to make the shop yours.
// ============================================================
window.HEJA_CONFIG = {
  brand: "Heja",
  tagline: "Everyday clothes, made to move with you.",
  currency: "EGP",              // e.g. "EGP", "USD", "EUR", "SAR"
  currencyPosition: "after",   // "before" → $25   |  "after" → 25 EGP

  // Orders are sent here — no payment fees, no backend.
  // WhatsApp number in international format, digits only (no +, no spaces).
  whatsappNumber: "201000000000",
  // Fallback / alternative: orders by email.
  orderEmail: "orders@example.com",

  shippingFee: 60,             // flat shipping; set 0 for free shipping
  freeShippingOver: 1500,      // order total for free shipping; 0 to disable

  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/"
  }
};
