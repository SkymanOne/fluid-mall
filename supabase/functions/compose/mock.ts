// Fictional sample pieces for when live search comes up short. Shops and products are made up.
// Photos are AI generated to match each made up product.

import type { PieceExtras } from "./product-page.ts";
import type { Piece, SlotName } from "./types.ts";

// express is the next working day price, null when the shop has no next day option
const SHOPS = {
  harbour: { merchant: "Harbour & Loom", ukDelivery: { price: 3.95, freeOver: 75, days: "2-4 working days", maxDays: 4 }, express: 6.95, returns: 30 },
  kestrel: { merchant: "Kestrel Supply", ukDelivery: { price: 4.5, freeOver: 100, days: "3-5 working days", maxDays: 5 }, express: 7.5, returns: 28 },
  northgate: { merchant: "Northgate Atelier", ukDelivery: { price: 0, freeOver: null, days: "1-2 working days", maxDays: 2 }, express: 5, returns: 14 },
  fernwood: { merchant: "Fernwood Studio", ukDelivery: { price: 5, freeOver: 60, days: "3-6 working days", maxDays: 6 }, express: 8.95, returns: 30 },
  cobble: { merchant: "Cobble Lane Goods", ukDelivery: { price: 2.99, freeOver: 50, days: "2-3 working days", maxDays: 3 }, express: 5.99, returns: 21 },
  pennant: { merchant: "Pennant Row", ukDelivery: { price: 4.95, freeOver: 80, days: "2-3 working days", maxDays: 3 }, express: 7.95, returns: 60 },
  saltmarsh: { merchant: "Saltmarsh Outfitters", ukDelivery: { price: 5.95, freeOver: 120, days: "3-5 working days", maxDays: 5 }, express: null, returns: 45 },
  millbrook: { merchant: "Millbrook Denim Co.", ukDelivery: { price: 3.5, freeOver: 40, days: "2-4 working days", maxDays: 4 }, express: 6.5, returns: 30 },
  ashcombe: { merchant: "Ashcombe Footwear", ukDelivery: { price: 0, freeOver: null, days: "3-5 working days", maxDays: 5 }, express: 9.95, returns: 60 },
  copperleaf: { merchant: "Copperleaf Clothing", ukDelivery: { price: 2.49, freeOver: 35, days: "4-7 working days", maxDays: 7 }, express: null, returns: 14 },
  thistle: { merchant: "Thistle & Pine", ukDelivery: { price: 4, freeOver: 90, days: "2-4 working days", maxDays: 4 }, express: 6, returns: 28 },
  brindle: { merchant: "Brindle Street", ukDelivery: { price: 6, freeOver: 150, days: "1-3 working days", maxDays: 3 }, express: 9.95, returns: 45 },
};

const PALETTE = ["black", "navy", "grey", "beige", "green", "brown", "white"];

const LETTERS = ["XS", "S", "M", "L", "XL", "XXL"];
const WAISTS = ["W28", "W30", "W32", "W34", "W36"];
const SHOES = ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"];
const WOMENS_SHOES = ["UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8"];

// Names for one gender start with Men's or Women's so the gender filter finds them, the rest are unisex.
// A row's index is its id and photo, so new rows go at the end of their list
type Row = [shop: keyof typeof SHOPS, colour: string, name: string, price: number, material: string, fit: string];

const ROWS: Record<SlotName, Row[]> = {
  outer: [
    ["harbour", "black", "Cropped Twill Harrington Jacket", 89, "100% cotton twill", "Regular"],
    ["kestrel", "grey", "Wool Blend Overshirt", 75, "60% wool, 40% polyester", "Relaxed"],
    ["northgate", "green", "Nylon Bomber Jacket", 95, "100% recycled nylon", "Regular"],
    ["fernwood", "blue", "Rigid Denim Trucker Jacket", 70, "100% cotton denim, 13oz", "Boxy"],
    ["cobble", "brown", "Waxed Cotton Field Jacket", 120, "Waxed cotton, cotton lining", "Regular"],
    ["harbour", "navy", "Quilted Liner Jacket", 65, "100% recycled polyester", "Slim"],
    ["brindle", "black", "Men's Leather Biker Jacket", 220, "Lambskin leather, polyester lining", "Regular"],
    ["pennant", "beige", "Women's Belted Trench Coat", 165, "100% cotton gabardine", "Regular"],
    ["saltmarsh", "black", "Recycled Down Puffer Jacket", 140, "Recycled nylon shell, recycled down fill", "Relaxed"],
    ["millbrook", "white", "Women's Cropped Denim Jacket", 58, "100% cotton denim", "Cropped"],
    ["brindle", "navy", "Men's Unstructured Wool Blazer", 145, "100% wool, half lined", "Slim"],
    ["saltmarsh", "green", "Waterproof Hooded Parka", 175, "Waterproof cotton blend, padded lining", "Relaxed"],
    ["thistle", "grey", "Men's Wool Overcoat", 190, "80% wool, 20% polyamide", "Regular"],
    ["brindle", "brown", "Men's Suede Bomber Jacket", 235, "Goat suede, viscose lining", "Regular"],
    ["thistle", "beige", "Corduroy Overshirt", 58, "100% cotton corduroy", "Relaxed"],
    ["copperleaf", "black", "Women's Oversized Blazer", 79, "Polyester blend, fully lined", "Oversized"],
    ["saltmarsh", "yellow", "Lightweight Rain Jacket", 65, "Waterproof recycled polyester", "Regular"],
    ["copperleaf", "pink", "Women's Satin Bomber Jacket", 62, "100% polyester satin, padded", "Regular"],
  ],
  top: [
    ["cobble", "white", "Heavyweight Boxy Tee", 28, "100% organic cotton, 240gsm", "Boxy"],
    ["northgate", "black", "Merino Crew Neck Jumper", 65, "100% extra fine merino wool", "Regular"],
    ["harbour", "blue", "Oxford Button Down Shirt", 45, "100% cotton oxford", "Regular"],
    ["kestrel", "grey", "Loopback Cotton Hoodie", 55, "100% cotton loopback jersey", "Relaxed"],
    ["fernwood", "navy", "Knitted Polo Shirt", 49, "100% cotton", "Slim"],
    ["cobble", "black", "Relaxed Pocket Tee", 30, "100% organic cotton", "Relaxed"],
    ["brindle", "white", "Men's Slim Oxford Shirt", 42, "100% cotton oxford", "Slim"],
    ["pennant", "white", "Women's Silk Blouse", 95, "100% mulberry silk", "Relaxed"],
    ["pennant", "blue", "Women's Linen Blouse", 48, "100% linen", "Relaxed"],
    ["thistle", "navy", "Merino Turtleneck Jumper", 72, "100% merino wool", "Regular"],
    ["copperleaf", "black", "Women's Ribbed Turtleneck Top", 22, "95% cotton, 5% elastane", "Slim"],
    ["kestrel", "green", "Men's Pique Polo Shirt", 35, "100% cotton pique", "Regular"],
    ["thistle", "beige", "Women's Cable Knit Jumper", 82, "70% lambswool, 30% alpaca", "Relaxed"],
    ["copperleaf", "grey", "Organic Cotton T-Shirt", 15, "100% organic cotton", "Regular"],
    ["copperleaf", "pink", "Women's Cropped Rib T-Shirt", 16, "95% cotton, 5% elastane", "Cropped"],
    ["millbrook", "black", "Heavyweight Zip Hoodie", 65, "100% cotton fleece, 400gsm", "Relaxed"],
    ["harbour", "beige", "Men's Linen Camp Collar Shirt", 55, "100% linen", "Relaxed"],
    ["pennant", "red", "Women's Mohair Knit Jumper", 88, "Mohair and wool blend", "Oversized"],
  ],
  bottom: [
    ["northgate", "black", "Pleated Wide Leg Trousers", 68, "68% polyester, 30% viscose, 2% elastane", "Wide"],
    ["kestrel", "blue", "Straight Leg Selvedge Jeans", 85, "100% cotton selvedge denim, 14oz", "Straight"],
    ["harbour", "beige", "Relaxed Cotton Chinos", 55, "98% cotton, 2% elastane", "Relaxed"],
    ["fernwood", "green", "Tapered Cargo Trousers", 60, "100% cotton ripstop", "Tapered"],
    ["northgate", "grey", "Wool Blend Tailored Trousers", 79, "70% wool, 30% polyester", "Tailored"],
    ["cobble", "black", "Drawstring Track Pants", 48, "100% recycled polyester", "Relaxed"],
    ["millbrook", "black", "Men's Slim Black Jeans", 65, "98% cotton, 2% elastane", "Slim"],
    ["millbrook", "black", "Women's High Rise Straight Jeans", 58, "99% cotton, 1% elastane", "Straight"],
    ["cobble", "black", "Loose Fit Washed Jeans", 49, "100% cotton denim", "Loose"],
    ["pennant", "blue", "Women's Wide Leg Jeans", 62, "100% cotton denim", "Wide"],
    ["kestrel", "grey", "Men's Tapered Stretch Jeans", 55, "98% cotton, 2% elastane", "Tapered"],
    ["millbrook", "white", "Straight Leg Jeans", 60, "100% cotton denim", "Straight"],
    ["brindle", "navy", "Men's Slim Chinos", 45, "97% cotton, 3% elastane", "Slim"],
    ["pennant", "green", "Women's Pleated Midi Skirt", 55, "100% recycled polyester", "A-line"],
    ["copperleaf", "blue", "Women's Denim Mini Skirt", 28, "100% cotton denim", "Regular"],
    ["copperleaf", "grey", "Cotton Fleece Joggers", 32, "80% cotton, 20% polyester fleece", "Relaxed"],
    ["saltmarsh", "brown", "Men's Cargo Shorts", 35, "100% cotton ripstop", "Relaxed"],
    ["thistle", "orange", "Women's Linen Shorts", 30, "100% linen", "Relaxed"],
  ],
  shoes: [
    ["kestrel", "white", "Leather Court Sneakers", 95, "Leather upper, rubber sole", "True to size"],
    ["fernwood", "brown", "Suede Chelsea Boots", 120, "Suede upper, leather lining, rubber sole", "True to size"],
    ["cobble", "black", "Canvas Low Top Trainers", 45, "Cotton canvas upper, rubber sole", "Half a size large"],
    ["harbour", "grey", "Chunky Runner Trainers", 88, "Mesh and suede upper, foam sole", "True to size"],
    ["northgate", "black", "Leather Derby Shoes", 110, "Calf leather upper, leather sole", "Narrow"],
    ["kestrel", "white", "Retro Court Trainers", 72, "Leather upper, rubber cupsole", "True to size"],
    ["ashcombe", "black", "Leather Chelsea Boots", 135, "Leather upper, leather lining, rubber sole", "True to size"],
    ["ashcombe", "black", "Women's Heeled Ankle Boots", 95, "Leather upper, slim heel, leather sole", "True to size"],
    ["brindle", "brown", "Men's Penny Loafers", 115, "Polished leather upper, leather sole", "True to size"],
    ["pennant", "black", "Women's Leather Loafers", 89, "Leather upper, rubber sole", "Half a size small"],
    ["pennant", "beige", "Women's Block Heel Sandals", 65, "Suede straps, leather insole", "True to size"],
    ["saltmarsh", "brown", "Leather Slider Sandals", 45, "Leather straps, cork footbed", "True to size"],
    ["copperleaf", "red", "Women's Pointed Court Heels", 69, "Patent faux leather upper", "Narrow"],
    ["ashcombe", "beige", "Men's Suede Derby Shoes", 98, "Suede upper, rubber sole", "True to size"],
    ["kestrel", "blue", "Knit Running Sneakers", 68, "Knit upper, foam sole", "True to size"],
    ["copperleaf", "white", "Women's Platform Sneakers", 60, "Leather upper, platform rubber sole", "True to size"],
    ["ashcombe", "brown", "Men's Lace Up Work Boots", 150, "Oiled leather upper, lug rubber sole", "Half a size large"],
    ["millbrook", "green", "Retro Suede Trainers", 82, "Suede upper, gum rubber sole", "True to size"],
  ],
};

const care = (slot: SlotName, material: string) =>
  slot === "shoes" ? "Wipe clean with a damp cloth"
  : /wax/i.test(material) ? "Wipe clean, do not wash"
  : /leather|suede/i.test(material) ? "Specialist leather clean only"
  : /wool|merino|silk|mohair|alpaca/i.test(material) ? "Hand wash cold or dry clean"
  : "Machine wash at 30°C";

export function mockPieces(slot: SlotName): (Piece & PieceExtras)[] {
  return ROWS[slot].map(([shopKey, colour, name, price, material, fit], i) => {
    const shop = SHOPS[shopKey];
    const labels = slot === "bottom" ? WAISTS : slot !== "shoes" ? LETTERS : /^women/i.test(name) ? WOMENS_SHOES : SHOES;
    const handle = name.toLowerCase().replaceAll("'", "").replaceAll(" ", "-");
    // The colour goes after a Men's or Women's prefix
    const title = name.toLowerCase().includes(colour) ? name : name.replace(/^((?:wo)?men's )?/i, `$1${colour[0].toUpperCase()}${colour.slice(1)} `);
    const image = `/samples/m_${slot}_${i}.webp`;
    const fitLine = slot === "shoes" ? `Fit: ${fit.toLowerCase()}` : `${fit} fit`;
    return {
      id: `m_${slot}_${i}`,
      title,
      merchant: shop.merchant,
      merchantUrl: `https://example.com/${shopKey}`,
      url: `https://example.com/${shopKey}/products/${handle}`,
      // Generated with grok-imagine-image, see apps/web/public/samples. Labelled Sample in the UI
      image,
      slot,
      colour,
      price,
      converted: null,
      // Every third sample is marked down so sale prices have something to show
      wasPrice: i % 3 === 1 ? Math.ceil((price * 1.3) / 5) * 5 : null,
      // Every third size sold out so the size picker has something to show
      sizes: labels.map((label, j) => ({ label, available: (i + j) % 3 !== 0 })),
      ukDelivery: shop.ukDelivery,
      returns: { days: shop.returns, note: null },
      source: "mock",
      fetchedAt: new Date().toISOString(),
      images: [image],
      brand: shop.merchant,
      description: `${name} in ${material.toLowerCase()}. ${fitLine}. A sample piece from ${shop.merchant}, a made up shop.`,
      details: [`Material: ${material}`, fitLine, care(slot, material), "Sample piece, not a real product"],
      rating: null,
      colours: PALETTE.filter((c) => c !== colour).slice(i % 4, i % 4 + 2).map((c) => c[0].toUpperCase() + c.slice(1)),
      deliveryOptions: [
        { name: "Standard", price: shop.ukDelivery.price, days: shop.ukDelivery.days },
        ...(shop.express === null ? [] : [{ name: "Express", price: shop.express, days: "Next working day" }]),
      ],
    };
  });
}
