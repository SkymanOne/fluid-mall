import type { Piece, SlotName } from "./types";

export const slotLabel: Record<SlotName, string> = {
  outer: "Outer",
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
};

export const slotOrder: SlotName[] = ["outer", "top", "bottom", "shoes"];

export function gbp(amount: number) {
  return `£${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function stockState(piece: Piece, size?: string) {
  // Some shops do not publish sizes or stock, so the shop is the only source
  if (piece.sizes.length === 0) return "UNKNOWN";
  if (size) {
    const found = piece.sizes.find((s) => s.label === size);
    if (!found) return "NO SIZE " + size;
    return found.available ? "IN STOCK" : "GONE";
  }
  const open = piece.sizes.filter((s) => s.available).length;
  if (open === 0) return "GONE";
  if (open <= 2 && piece.sizes.length > 3) return "LOW";
  return "IN STOCK";
}

// One rule for the card line, the free delivery label and the bag, so they never disagree
export function deliveryLine(piece: Piece) {
  const d = piece.ukDelivery;
  if (freeDelivery(piece)) return `Free UK delivery${d?.days ? `, ${d.days}` : ""}`;
  if (!d || (d.price === null && d.days === null && d.freeOver === null)) return `UK delivery unknown, check at ${piece.merchant}`;
  const cost = d.price === null ? "cost unknown" : gbp(d.price);
  const free = d.freeOver !== null ? `, free over ${gbp(d.freeOver)}` : "";
  return `UK delivery ${cost}${free}${d.days ? `, ${d.days}` : ""}`;
}

export function returnsLine(piece: Piece) {
  const r = piece.returns;
  if (!r || (r.days === null && !r.note)) return `Returns unknown, check at ${piece.merchant}`;
  if (r.days === null) return `Returns: ${r.note}`;
  return `${r.days} day returns${r.note ? `. ${r.note}` : ""}`;
}

// UK delivery for one shop's share of an order. null means unknown
export function shopDelivery(pieces: Piece[]) {
  const subtotal = pieces.reduce((sum, p) => sum + p.price, 0);
  const d = pieces[0]?.ukDelivery;
  if (d?.freeOver != null && subtotal >= d.freeOver) return { subtotal, delivery: 0 };
  return { subtotal, delivery: d?.price ?? null };
}

export function byMerchant<T extends { piece: Piece }>(lines: T[]) {
  const groups = new Map<string, T[]>();
  for (const line of lines) groups.set(line.piece.merchant, [...(groups.get(line.piece.merchant) ?? []), line]);
  return [...groups.entries()].map(([merchant, lines]) => {
    const { subtotal, delivery } = shopDelivery(lines.map((l) => l.piece));
    return { merchant, lines, subtotal, delivery };
  });
}

const normSize = (s: string) => s.toLowerCase().replace(/^(uk|w)\s*/, "").replace(/\s+/g, "");

// The piece's own label for the shopper's size ("UK 10" finds "10"), only when it is in stock
export function sizeFor(piece: Piece, want: string | null): string | null {
  return want ? (piece.sizes.find((s) => s.available && normSize(s.label) === normSize(want))?.label ?? null) : null;
}

export const freeDelivery = (p: Piece) => p.ukDelivery?.price === 0 || (p.ukDelivery?.freeOver != null && p.ukDelivery.freeOver <= p.price);
