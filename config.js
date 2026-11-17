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

  // Display defaults only. When Supabase is connected, the real values come
  // from the store_settings table and order totals are calculated there.
  shippingFee: 60,             // flat shipping; set 0 for free shipping
  freeShippingOver: 1500,      // order total for free shipping; 0 to disable

  // Supabase (database for products + orders). Leave empty to use products.js only.
  // The anon/publishable key is safe to put here: the database only lets visitors
  // read products and place orders (see supabase/schema.sql).
  supabaseUrl: "https://ayzewnvgvvhoioljxhvj.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5emV3bnZndnZob2lvbGp4aHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5MjQ5MzMsImV4cCI6MjExMDUwMDkzM30.W-CXqQoeD8S42NJlUxz7snUo65HE988XicmRDNRwku8",

  // AI shopping assistant (runs on Vercel at /api/chat using OpenRouter).
  assistant: true,

  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/"
  }
};
