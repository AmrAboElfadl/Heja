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
  { id: "everyday-hoodie", name: "Everyday Hoodie",    category: "Unisex",    price: 19,  oldPrice: 0,    color: "#2f3b34", shape: "hoodie", sizes: ["S","M","L","XL"], badge: "New",        image: "", description: "Brushed fleece hoodie with a double-layer hood and kangaroo pocket.", colors: [{ name: "Forest", nameAr: "أخضر غامق", hex: "#2F3B34" }, { name: "Oat", nameAr: "بيج شوفاني", hex: "#D8CBB8" }, { name: "Black", nameAr: "أسود", hex: "#1A1A1A" }] },
  { id: "wide-trousers", name: "Wide-Leg Trousers",    category: "Women",     price: 15,  oldPrice: 0,    color: "#c86b4a", shape: "pants",  sizes: ["XS","S","M","L"], badge: "",           image: "", description: "High-rise wide-leg trousers with an elastic back waist and side pockets.", colors: [{ name: "Terracotta", nameAr: "طوبي", hex: "#C86B4A" }, { name: "Sand", nameAr: "رملي", hex: "#C9B79C" }, { name: "Black", nameAr: "أسود", hex: "#1A1A1A" }] },
  { id: "summer-dress",  name: "Summer Midi Dress",    category: "Women",     price: 20,  oldPrice: 25, color: "#d9b9a3", shape: "dress",  sizes: ["XS","S","M","L"], badge: "Sale",       image: "", description: "Flowy viscose midi dress with adjustable straps. Lightweight and easy to pack.", colors: [{ name: "Blush", nameAr: "وردي فاتح", hex: "#D9B9A3" }, { name: "Ivory", nameAr: "عاجي", hex: "#EFE8DC" }, { name: "Sage", nameAr: "أخضر مريمية", hex: "#9FAE98" }] },
  { id: "denim-jacket",  name: "Washed Denim Jacket",  category: "Unisex",    price: 28, oldPrice: 0,    color: "#5d7894", shape: "jacket", sizes: ["S","M","L","XL"], badge: "",           image: "", description: "Classic trucker jacket in a soft vintage wash. Gets better with every wear.", colors: [{ name: "Washed Blue", nameAr: "أزرق مغسول", hex: "#5D7894" }, { name: "Black Denim", nameAr: "جينز أسود", hex: "#2B2B2B" }] },
  { id: "pleated-skirt", name: "Pleated Midi Skirt",   category: "Women",     price: 14,  oldPrice: 0,    color: "#4c4a6b", shape: "skirt",  sizes: ["XS","S","M","L"], badge: "New",        image: "", description: "Satin-finish pleated skirt that moves beautifully. Elastic waistband.", colors: [{ name: "Midnight", nameAr: "كحلي غامق", hex: "#4C4A6B" }, { name: "Champagne", nameAr: "شامبين", hex: "#D8C3A0" }, { name: "Black", nameAr: "أسود", hex: "#1A1A1A" }] },
  { id: "heja-cap",      name: "Heja Logo Cap",        category: "Accessories", price: 6, oldPrice: 0,   color: "#1f1f1f", shape: "cap",    sizes: ["One size"],       badge: "",           image: "", description: "Six-panel cotton cap with embroidered Heja logo and adjustable strap.", colors: [{ name: "Black", nameAr: "أسود", hex: "#1A1A1A" }, { name: "Ivory", nameAr: "عاجي", hex: "#EFE8DC" }, { name: "Clay", nameAr: "طيني", hex: "#9A4A2C" }] },
];
