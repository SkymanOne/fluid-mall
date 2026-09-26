// Fictional sample pieces for when live search comes up short. Shops and products are made up.
// Photos are AI generated to match each made up product.

import type { PieceExtras } from "./product-page.ts";
import type { Piece, SlotName } from "./types.ts";

const SHOPS = {
  harbour: { merchant: "Harbour & Loom", ukDelivery: { price: 3.95, freeOver: 75, days: "2-4 working days", maxDays: 4 }, express: 6.95, returns: 30 },
  kestrel: { merchant: "Kestrel Supply", ukDelivery: { price: 4.5, freeOver: 100, days: "3-5 working days", maxDays: 5 }, express: 7.5, returns: 28 },
  northgate: { merchant: "Northgate Atelier", ukDelivery: { price: 0, freeOver: null, days: "1-2 working days", maxDays: 2 }, express: 5, returns: 14 },
  fernwood: { merchant: "Fernwood Studio", ukDelivery: { price: 5, freeOver: 60, days: "3-6 working days", maxDays: 6 }, express: 8.95, returns: 30 },
  cobble: { merchant: "Cobble Lane Goods", ukDelivery: { price: 2.99, freeOver: 50, days: "2-3 working days", maxDays: 3 }, express: 5.99, returns: 21 },
};

const PALETTE = ["black", "navy", "grey", "beige", "green", "brown", "white"];

const LETTERS = ["XS", "S", "M", "L", "XL", "XXL"];
const WAISTS = ["W28", "W30", "W32", "W34", "W36"];
const SHOES = ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"];

type Row = [shop: keyof typeof SHOPS, colour: string, name: string, price: number, material: string, fit: string];

const ROWS: Record<SlotName, Row[]> = {
  outer: [
    ["harbour", "black", "Cropped Twill Harrington Jacket", 89, "100% cotton twill", "Regular"],
    ["kestrel", "grey", "Wool Blend Overshirt", 75, "60% wool, 40% polyester", "Relaxed"],
    ["northgate", "green", "Nylon Bomber Jacket", 95, "100% recycled nylon", "Regular"],
    ["fernwood", "blue", "Rigid Denim Trucker Jacket", 70, "100% cotton denim, 13oz", "Boxy"],
    ["cobble", "brown", "Waxed Cotton Field Jacket", 120, "Waxed cotton, cotton lining", "Regular"],
    ["harbour", "navy", "Quilted Liner Jacket", 65, "100% recycled polyester", "Slim"],
  ],
  top: [
    ["cobble", "white", "Heavyweight Boxy Tee", 28, "100% organic cotton, 240gsm", "Boxy"],
    ["northgate", "black", "Merino Crew Neck Jumper", 65, "100% extra fine merino wool", "Regular"],
    ["harbour", "blue", "Oxford Button Down Shirt", 45, "100% cotton oxford", "Regular"],
    ["kestrel", "grey", "Loopback Cotton Hoodie", 55, "100% cotton loopback jersey", "Relaxed"],
    ["fernwood", "navy", "Knitted Polo Shirt", 49, "100% cotton", "Slim"],
    ["cobble", "black", "Relaxed Pocket Tee", 30, "100% organic cotton", "Relaxed"],
  ],
  bottom: [
    ["northgate", "black", "Pleated Wide Leg Trousers", 68, "68% polyester, 30% viscose, 2% elastane", "Wide"],
    ["kestrel", "blue", "Straight Leg Selvedge Jeans", 85, "100% cotton selvedge denim, 14oz", "Straight"],
    ["harbour", "beige", "Relaxed Cotton Chinos", 55, "98% cotton, 2% elastane", "Relaxed"],
    ["fernwood", "green", "Tapered Cargo Trousers", 60, "100% cotton ripstop", "Tapered"],
    ["northgate", "grey", "Wool Blend Tailored Trousers", 79, "70% wool, 30% polyester", "Tailored"],
    ["cobble", "black", "Drawstring Track Pants", 48, "100% recycled polyester", "Relaxed"],
  ],
  shoes: [
    ["kestrel", "white", "Leather Court Sneakers", 95, "Leather upper, rubber sole", "True to size"],
    ["fernwood", "brown", "Suede Chelsea Boots", 120, "Suede upper, leather lining, rubber sole", "True to size"],
    ["cobble", "black", "Canvas Low Top Trainers", 45, "Cotton canvas upper, rubber sole", "Half a size large"],
    ["harbour", "grey", "Chunky Runner Trainers", 88, "Mesh and suede upper, foam sole", "True to size"],
    ["northgate", "black", "Leather Derby Shoes", 110, "Calf leather upper, leather sole", "Narrow"],
    ["kestrel", "white", "Retro Court Trainers", 72, "Leather upper, rubber cupsole", "True to size"],
  ],
};

const care = (slot: SlotName, material: string) =>
  slot === "shoes" ? "Wipe clean with a damp cloth" : /wax/i.test(material) ? "Wipe clean, do not wash" : /wool|merino/i.test(material) ? "Hand wash cold or dry clean" : "Machine wash at 30°C";

export function mockPieces(slot: SlotName): (Piece & PieceExtras)[] {
  const labels = slot === "bottom" ? WAISTS : slot === "shoes" ? SHOES : LETTERS;
  return ROWS[slot].map(([shopKey, colour, name, price, material, fit], i) => {
    const shop = SHOPS[shopKey];
    const handle = name.toLowerCase().replaceAll(" ", "-");
    const title = name.toLowerCase().includes(colour) ? name : `${colour[0].toUpperCase()}${colour.slice(1)} ${name}`;
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
        { name: "Express", price: shop.express, days: "Next working day" },
      ],
    };
  });
}
