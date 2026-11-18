// ============================================================
//  HEJA — international size chart (body measurements in cm).
//  Edit numbers here; the site converts to inches automatically.
//  Which chart a product uses: Women → women, Men/Unisex → men,
//  Kids → kids, Accessories → accessories.
// ============================================================
window.HEJA_SIZES = {
  women: {
    cols: ["eu", "uk", "us", "it"],
    body: ["bust", "waist", "hips"],
    rows: {
      XS: { eu: "34", uk: "6", us: "2", it: "38", bust: [80, 84], waist: [62, 66], hips: [88, 92] },
      S:  { eu: "36", uk: "8", us: "4", it: "40", bust: [84, 88], waist: [66, 70], hips: [92, 96] },
      M:  { eu: "38", uk: "10", us: "6", it: "42", bust: [88, 92], waist: [70, 74], hips: [96, 100] },
      L:  { eu: "40", uk: "12", us: "8", it: "44", bust: [92, 98], waist: [74, 80], hips: [100, 106] },
      XL: { eu: "42", uk: "14", us: "10", it: "46", bust: [98, 104], waist: [80, 86], hips: [106, 112] }
    }
  },
  men: {
    cols: ["eu", "ukus", "it"],
    body: ["chest", "waist", "hips"],
    rows: {
      XS: { eu: "44", ukus: "34", it: "44", chest: [84, 88], waist: [70, 76], hips: [86, 90] },
      S:  { eu: "46", ukus: "36", it: "46", chest: [88, 96], waist: [76, 82], hips: [90, 96] },
      M:  { eu: "48–50", ukus: "38–40", it: "48–50", chest: [96, 104], waist: [82, 90], hips: [96, 104] },
      L:  { eu: "52", ukus: "42", it: "52", chest: [104, 112], waist: [90, 98], hips: [104, 110] },
      XL: { eu: "54–56", ukus: "44–46", it: "54–56", chest: [112, 120], waist: [98, 106], hips: [110, 116] }
    }
  },
  kids: {
    cols: ["eu", "uk", "us"],
    body: ["height", "chest"],
    rows: {
      "2Y": { eu: "92", uk: "18–24M", us: "2T", height: [86, 92], chest: [52, 53] },
      "4Y": { eu: "104", uk: "3–4Y", us: "4T", height: [98, 104], chest: [55, 56] },
      "6Y": { eu: "116", uk: "5–6Y", us: "6", height: [110, 116], chest: [58, 60] },
      "8Y": { eu: "128", uk: "7–8Y", us: "8", height: [122, 128], chest: [62, 64] }
    }
  },
  accessories: {
    cols: [],
    body: ["head"],
    rows: { "One size": { head: [56, 60] } }
  }
};
