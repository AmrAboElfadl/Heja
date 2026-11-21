// ============================================================
//  HEJA — product catalog. Add, remove or edit products here.
//
//  image: leave empty ("") to use the built-in illustration,
//         or put a photo path like "assets/linen-shirt.jpg".
//  colors: colour options (the live database also holds stock per size).
//  shape: illustration used when there is no photo:
//         tee | shirt | hoodie | pants | dress | jacket | skirt | cap
// ============================================================
// Prices in US dollars.
window.HEJA_PRODUCTS = [
  { id: "cocoa-blush-abaya", name: "Cocoa Open Abaya with Blush Slip Dress", nameAr: "عباية مفتوحة بني كاكاو مع فستان داخلي وردي", nameFa: "عبای باز قهوه‌ای کاکائویی با پیراهن زیر صورتی",
    category: "Women", price: 65, oldPrice: 0, color: "#4A2C22", shape: "dress", sizes: ["S","M","L","XL"], badge: "New", fit: "relaxed",
    image: "assets/products/cocoa-blush-abaya.webp",
    description: "A two-piece set: a flowing open abaya in deep cocoa with wide kimono sleeves, layered over a soft blush slip dress. Wear them together or style each piece on its own.",
    descriptionAr: "طقم من قطعتين: عباية مفتوحة منسدلة بلون الكاكاو الداكن بأكمام كيمونو واسعة، فوق فستان داخلي ناعم باللون الوردي. البسيهما معاً أو نسّقي كل قطعة وحدها.",
    descriptionFa: "ست دوتکه: عبای باز و روان به رنگ کاکائویی تیره با آستین‌های کیمونویی گشاد، روی پیراهن زیر نرم صورتی. با هم بپوشید یا هر تکه را جدا ست کنید.",
    colors: [{ name: "Cocoa & Blush", nameAr: "كاكاو ووردي", nameFa: "کاکائویی و صورتی", hex: "#4A2C22" }] },
  { id: "champagne-jacquard-abaya", name: "Champagne Floral Jacquard Abaya", nameAr: "عباية جاكار مزهّرة بلون الشمبانيا", nameFa: "عبای ژاکارد گل‌دار شامپاینی",
    category: "Women", price: 89, oldPrice: 0, color: "#CDBBA3", shape: "dress", sizes: ["S","M","L","XL"], badge: "New", fit: "relaxed",
    image: "assets/products/champagne-jacquard-abaya.webp",
    description: "An open abaya in champagne satin jacquard with a tone-on-tone floral pattern that catches the light, worn over a matching inner dress. Elegant for Eid, evenings and occasions.",
    descriptionAr: "عباية مفتوحة من جاكار الساتان بلون الشمبانيا بنقشة زهور بنفس اللون تلمع مع الضوء، تُلبس فوق فستان داخلي مطابق. أنيقة للعيد والسهرات والمناسبات.",
    descriptionFa: "عبای باز از ژاکارد ساتن شامپاینی با طرح گل هم‌رنگ که در نور می‌درخشد، روی پیراهن زیر هم‌رنگ. شیک برای عید، مهمانی‌های شب و مراسم.",
    colors: [{ name: "Champagne", nameAr: "شمبانيا", nameFa: "شامپاینی", hex: "#CDBBA3" }] },
];
