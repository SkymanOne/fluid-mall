// A saved storefront is a UI tree without its products. New products load into it like data into a template.
// Pure functions, copied to supabase/functions/compose/template.ts, keep both in sync.
import type { Piece, SlotName, Spec, SpecElement } from "./types";

export type StorefrontTemplate = {
  // The saved tree with every ProductCard and its parts removed
  spec: Spec;
  // For each item container (Grid, Carousel, List): the part types every card in it gets, in order
  cards: Record<string, string[]>;
};

const CONTAINERS = ["Grid", "Carousel", "List"];
// Copy that belonged to one request, so it is not carried into another
const REQUEST_COPY = ["Heading", "Text", "Callout", "Label"];

const kids = (el: SpecElement | undefined) => el?.children ?? el?.slots?.default ?? [];
const setKids = (el: SpecElement, ids: string[]) => {
  el.children = ids;
  if (el.slots) delete el.slots;
};

function dropSubtree(spec: Spec, id: string) {
  for (const k of kids(spec.elements[id])) dropSubtree(spec, k);
  delete spec.elements[id];
}

function detach(spec: Spec, id: string) {
  for (const el of Object.values(spec.elements)) if (kids(el).includes(id)) setKids(el, kids(el).filter((k) => k !== id));
  dropSubtree(spec, id);
}

export function toTemplate(source: Spec): StorefrontTemplate {
  const spec: Spec = structuredClone(source);
  const cards: StorefrontTemplate["cards"] = {};
  for (const [id, el] of Object.entries(spec.elements)) {
    if (!CONTAINERS.includes(el.type)) continue;
    const first = kids(el).map((k) => spec.elements[k]).find((e) => e?.type === "ProductCard");
    cards[id] = first ? kids(first).map((k) => spec.elements[k]?.type).filter((t): t is string => !!t && !REQUEST_COPY.includes(t)) : [];
  }
  for (const [id, el] of Object.entries(spec.elements)) {
    if (!spec.elements[id]) continue;
    if (el.type === "ProductCard" || REQUEST_COPY.includes(el.type)) detach(spec, id);
  }
  return { spec, cards };
}

// Finds the first item container inside a section
function containerIn(spec: Spec, sectionId: string): string | null {
  const queue = [...kids(spec.elements[sectionId])];
  while (queue.length) {
    const id = queue.shift()!;
    if (CONTAINERS.includes(spec.elements[id]?.type ?? "")) return id;
    queue.push(...kids(spec.elements[id]));
  }
  return null;
}

// Copies a subtree with fresh ids, returns the new root id
function cloneSubtree(spec: Spec, id: string, suffix: string): string {
  const el = structuredClone(spec.elements[id]);
  const next = `${id}_${suffix}`;
  setKids(el, kids(spec.elements[id]).map((k) => cloneSubtree(spec, k, suffix)));
  spec.elements[next] = el;
  return next;
}

const SLOT_TITLES: Record<SlotName, string> = { outer: "Outerwear", top: "Tops", bottom: "Bottoms", shoes: "Shoes" };

export function fromTemplate(template: StorefrontTemplate, pieces: Piece[], title: string): Spec {
  const spec: Spec = structuredClone(template.spec);
  const cards = { ...template.cards };
  const root = spec.elements[spec.root];
  if (root) root.props = { ...root.props, title };

  const sections = Object.entries(spec.elements).filter(([, el]) => el.type === "Section");
  const slots = [...new Set(pieces.map((p) => p.slot))];
  const setSection = sections.find(([, el]) => !el.props.slot);
  const slotSections = sections.filter(([, el]) => el.props.slot);

  // A set template takes every piece in its one section
  if (!slotSections.length && setSection) {
    fill(spec, cards, containerIn(spec, setSection[0]), pieces);
    return spec;
  }

  // Categories the template has but the results do not are dropped
  for (const [id, el] of slotSections) if (!slots.includes(el.props.slot as SlotName)) detach(spec, id);

  // Categories the results have but the template does not copy the style of the first category section
  const model = slotSections.find(([id]) => spec.elements[id]);
  for (const slot of slots) {
    if (slotSections.some(([id, el]) => spec.elements[id] && el.props.slot === slot)) continue;
    if (!model) continue;
    const copy = cloneSubtree(spec, model[0], slot);
    spec.elements[copy].props = { ...spec.elements[copy].props, slot, title: SLOT_TITLES[slot] };
    const box = containerIn(spec, copy);
    const modelBox = containerIn(spec, model[0]);
    if (box && modelBox) cards[box] = cards[modelBox] ?? [];
    const parent = Object.values(spec.elements).find((e) => kids(e).includes(model[0]));
    if (parent) {
      const list = kids(parent);
      const total = list.findIndex((k) => spec.elements[k]?.type === "OutfitTotal");
      setKids(parent, total >= 0 ? [...list.slice(0, total), copy, ...list.slice(total)] : [...list, copy]);
    }
  }

  for (const [id, el] of Object.entries(spec.elements)) {
    if (el.type !== "Section" || !el.props.slot) continue;
    fill(spec, cards, containerIn(spec, id), pieces.filter((p) => p.slot === el.props.slot));
  }
  return spec;
}

function fill(spec: Spec, cards: StorefrontTemplate["cards"], box: string | null, pieces: Piece[]) {
  if (!box) return;
  const parts = cards[box]?.length ? cards[box] : ["SizePicker", "AddToBag", "Delivery"];
  const ids = pieces.map((p) => {
    const cardId = `card_${p.id}`;
    const partIds = parts.map((type) => {
      const partId = `${type.toLowerCase()}_${p.id}`;
      spec.elements[partId] = { type, props: { id: p.id } };
      return partId;
    });
    spec.elements[cardId] = { type: "ProductCard", props: { id: p.id }, children: partIds };
    return cardId;
  });
  setKids(spec.elements[box], [...kids(spec.elements[box]), ...ids]);
}

// Self check: a two category template takes new pieces and adds a missing category in the same style
export function demo() {
  const piece = (id: string, slot: SlotName) => ({ id, slot }) as Piece;
  const saved: Spec = {
    root: "page",
    elements: {
      page: { type: "Page", props: { title: "Old", theme: "backstage", density: "roomy" }, children: ["s_top", "s_shoes", "total"] },
      s_top: { type: "Section", props: { title: "Tops", slot: "top" }, children: ["c_top"] },
      c_top: { type: "Carousel", props: { size: "large" }, children: ["card_a"] },
      card_a: { type: "ProductCard", props: { id: "a" }, children: ["add_a"] },
      add_a: { type: "AddToBag", props: { id: "a" } },
      s_shoes: { type: "Section", props: { title: "Shoes", slot: "shoes" }, children: ["c_shoes"] },
      c_shoes: { type: "Grid", props: { size: "small" }, children: [] },
      total: { type: "OutfitTotal", props: {} },
    },
  };
  const t = toTemplate(saved);
  console.assert(!t.spec.elements.card_a && t.cards.c_top.join() === "AddToBag", "cards stripped, parts kept");
  const out = fromTemplate(t, [piece("x", "top"), piece("y", "bottom")], "New");
  console.assert(out.elements.page.props.title === "New" && out.elements.page.props.theme === "backstage", "title swapped, look kept");
  console.assert(!out.elements.s_shoes, "empty category dropped");
  console.assert(kids(out.elements.c_top).includes("card_x") && out.elements.addtobag_x?.type === "AddToBag", "piece loaded with saved parts");
  console.assert(Object.values(out.elements).some((e) => e.type === "Section" && e.props.slot === "bottom"), "missing category added");
  console.assert(kids(out.elements.page).at(-1) === "total", "total stays last");
  return "ok";
}
