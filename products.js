// ============================================================
//  HEJA — product catalog. Add, remove or edit products here.
//
//  image: leave empty ("") to use the built-in illustration,
//         or put a photo path like "assets/linen-shirt.jpg".
//  shape: illustration used when there is no photo:
//         tee | shirt | hoodie | pants | dress | jacket | skirt | cap
// ============================================================
window.HEJA_PRODUCTS = [
  { id: "everyday-hoodie", name: "Everyday Hoodie",    category: "Unisex",    price: 890,  oldPrice: 0,    color: "#2f3b34", shape: "hoodie", sizes: ["S","M","L","XL"], badge: "New",        image: "", description: "Brushed fleece hoodie with a double-layer hood and kangaroo pocket." },
  { id: "wide-trousers", name: "Wide-Leg Trousers",    category: "Women",     price: 720,  oldPrice: 0,    color: "#c86b4a", shape: "pants",  sizes: ["XS","S","M","L"], badge: "",           image: "", description: "High-rise wide-leg trousers with an elastic back waist and side pockets." },
  { id: "summer-dress",  name: "Summer Midi Dress",    category: "Women",     price: 980,  oldPrice: 1200, color: "#d9b9a3", shape: "dress",  sizes: ["XS","S","M","L"], badge: "Sale",       image: "", description: "Flowy viscose midi dress with adjustable straps. Lightweight and easy to pack." },
  { id: "denim-jacket",  name: "Washed Denim Jacket",  category: "Unisex",    price: 1350, oldPrice: 0,    color: "#5d7894", shape: "jacket", sizes: ["S","M","L","XL"], badge: "",           image: "", description: "Classic trucker jacket in a soft vintage wash. Gets better with every wear." },
  { id: "pleated-skirt", name: "Pleated Midi Skirt",   category: "Women",     price: 650,  oldPrice: 0,    color: "#4c4a6b", shape: "skirt",  sizes: ["XS","S","M","L"], badge: "New",        image: "", description: "Satin-finish pleated skirt that moves beautifully. Elastic waistband." },
  { id: "heja-cap",      name: "Heja Logo Cap",        category: "Accessories", price: 300, oldPrice: 0,   color: "#1f1f1f", shape: "cap",    sizes: ["One size"],       badge: "",           image: "", description: "Six-panel cotton cap with embroidered Heja logo and adjustable strap." },
];
