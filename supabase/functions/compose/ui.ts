// Jev composes and edits the storefront UI through json-render, like the json-render playground.
// Code builds the candidates from the catalog and the pieces. Jev picks and arranges. Code checks the result.

import {
  experimental_composeSpec,
  type Experimental_ChoiceQuestion,
  type Experimental_CompositionCandidate as Candidate,
  type Experimental_CompositionEvaluator,
} from "npm:@json-render/core@0.21.0";
import { z } from "npm:zod@4.3.6";
import { jev, within } from "./ai.ts";
import type { LabelKind, Piece, SlotName, Spec, SpecElement, ThemeName } from "./types.ts";

const SLOT_ENUM = z.enum(["outer", "top", "bottom", "shoes"]);
const sized = z.object({ size: z.enum(["small", "medium", "large"]) });
const part = z.object({ id: z.string() });
const LABEL_KINDS = ["cheapest", "fastest", "free_delivery", "few_left", "long_returns"] as const;

const components = {
  Page: {
    props: z.object({
      title: z.string(),
      theme: z.enum(["studio", "backstage", "showroom"]),
      density: z.enum(["roomy", "compact"]),
      groupBy: z.enum(["category", "colour"]).optional(),
    }),
    slots: ["default"],
  },
  // colour marks a section of one colour, made by code when the Page groups by colour
  Section: {
    props: z.object({ title: z.string(), slot: SLOT_ENUM.nullable(), open: z.boolean().optional(), colour: z.string().optional() }),
    slots: ["default"],
  },
  Grid: { props: sized, slots: ["default"] },
  Carousel: { props: sized, slots: ["default"] },
  List: { props: sized, slots: ["default"] },
  ProductCard: { props: part, slots: ["default"] },
  SizePicker: { props: part },
  AddToBag: { props: part },
  Delivery: { props: part },
  Returns: { props: part },
  StockBadge: { props: part },
  Gallery: { props: part },
  Description: { props: part },
  Rating: { props: part },
  OutfitTotal: { props: z.object({}) },
  Heading: { props: z.object({ text: z.string(), level: z.enum(["h2", "h3"]) }) },
  Text: { props: z.object({ text: z.string(), tone: z.enum(["body", "muted"]) }) },
  Label: { props: z.object({ id: z.string(), kind: z.enum(LABEL_KINDS) }) },
  Callout: { props: z.object({ text: z.string(), tone: z.enum(["info", "warning"]) }) },
  Separator: { props: z.object({}) },
  Stack: { props: z.object({ direction: z.enum(["horizontal", "vertical"]) }), slots: ["default"] },
  CompareTable: { props: z.object({ slot: SLOT_ENUM.nullable() }) },
  Filters: { props: z.object({ by: z.enum(["size", "colour", "delivery", "price"]) }) },
  ShopSummary: { props: z.object({}) },
};
type Type = keyof typeof components;

const catalog = {
  data: { components },
  validate: (spec: unknown) => ({
    success: Object.values((spec as Spec).elements).every((e) => components[e.type as Type]?.props.safeParse(e.props).success),
  }),
};

// TypeSafe takes at most 255 options per choice. A bigger tree can offer more edits than that,
// so a long choice runs as a small tournament: each chunk picks a winner, then the winners are compared
const MAX_OPTIONS = 250;

async function ask(state: unknown, questions: Record<string, Experimental_ChoiceQuestion>, signal: AbortSignal) {
  const res = await jev(state, questions, within(signal, 15000));
  return { answers: res.answers, tokens: res.usage?.input_tokens ?? 0 };
}

// Our own evaluator, straight to TypeSafe. The json-render question shape matches theirs
const evaluate: Experimental_CompositionEvaluator = async ({ state, questions, signal }) => {
  const first: Record<string, Experimental_ChoiceQuestion> = {};
  const chunks: Record<string, string[]> = {};
  for (const [id, q] of Object.entries(questions)) {
    const keys = Object.keys(q.criteria);
    if (keys.length <= MAX_OPTIONS) {
      first[id] = q;
      continue;
    }
    const always: string[] = keys.filter((k) => k === "finish" || k === "unavailable");
    const rest = keys.filter((k) => !always.includes(k));
    const size = MAX_OPTIONS - always.length;
    chunks[id] = [];
    for (let i = 0; i * size < rest.length; i++) {
      chunks[id].push(`${id}_part${i}`);
      first[`${id}_part${i}`] = { ...q, criteria: pick(q.criteria, [...rest.slice(i * size, (i + 1) * size), ...always]) };
    }
  }
  const one = await ask(state, first, signal);
  const answers: Record<string, { choice: string; confidence?: number }> = {};
  for (const id of Object.keys(questions)) if (!chunks[id]) answers[id] = { choice: one.answers[id]?.choice ?? "", confidence: one.answers[id]?.confidence };
  let tokens = one.tokens;
  if (Object.keys(chunks).length) {
    const finals = Object.fromEntries(Object.entries(chunks).map(([id, parts]) => [
      id,
      { ...questions[id], criteria: pick(questions[id].criteria, [...new Set(parts.map((p) => one.answers[p]?.choice ?? ""))]) },
    ]));
    const two = await ask(state, finals, signal);
    tokens += two.tokens;
    for (const id of Object.keys(chunks)) answers[id] = { choice: two.answers[id]?.choice ?? "", confidence: two.answers[id]?.confidence };
  }
  return { answers, usage: { inputTokens: tokens } };
};

const pick = (criteria: Record<string, string>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => Object.hasOwn(criteria, k)).map((k) => [k, criteria[k]]));

const THEMES: Record<ThemeName, string> = { studio: "light, clean and bright", backstage: "dark, moody night mode", showroom: "bold and colourful" };
const DENSITIES = { roomy: "roomy, bigger cards and more space", compact: "compact, smaller cards and more items per screen" };
const CONTAINERS = { Grid: "a grid of tiles", Carousel: "a carousel that scrolls sideways", List: "a list of rows to compare" };
const SIZES = { small: "small photos, more items per row", medium: "medium photos", large: "large photos" };
const PARTS = {
  SizePicker: "size picker showing the sizes in stock",
  AddToBag: "Add to bag button, the buy button",
  Delivery: "UK delivery cost and time",
  Returns: "returns policy",
  StockBadge: "stock badge saying whether it is in stock",
  Gallery: "photo gallery with more photos",
  Description: "the shop's description and details like material, fit and care",
  Rating: "star rating from shoppers",
};
// Gallery, Description and Rating are offered only when the shop gave that data
const has = (t: string, p: Piece) =>
  t === "Gallery"
    ? (p.images?.length ?? 0) > 1
    : t === "Description"
    ? !!p.description || (p.details?.length ?? 0) > 0
    : t === "Rating"
    ? !!p.rating
    : true;
type Part = keyof typeof PARTS;
const PART_TYPES = Object.keys(PARTS) as Part[];
const DEFAULT_PARTS: Part[] = ["SizePicker", "AddToBag", "Delivery"];
// Page level extras kept in Jev's order when code arranges a new tree
const EXTRAS = new Set(["Heading", "Text", "Callout", "Separator", "CompareTable", "ShopSummary", "Filters"]);
const isContainer = (t: string) => t in CONTAINERS;
const isPart = (t: string) => t in PARTS || t === "Label";
export const LABEL: Record<SlotName, string> = { outer: "Jackets", top: "Tops", bottom: "Bottoms", shoes: "Shoes" };

export type Setup = {
  title: string;
  kind: "outfit" | "set";
  // Section title for a set, like "Black jeans"
  setTitle: string;
  pieces: Piece[];
  prompt: string;
  // The agent's line to the shopper, offered as Text
  say: string;
};

const short = (p: Piece) => `"${p.title}" from ${p.merchant}`;

function describe(p: Piece): string {
  const inStock = (p.sizes ?? []).filter((s) => s.available).map((s) => s.label);
  const d = p.ukDelivery;
  const delivery = !d ? "UK delivery unknown" : `UK delivery ${d.price === 0 ? "free" : d.price === null ? "price unknown" : `£${d.price}`}${d.days ? `, ${d.days}` : ""}`;
  return [
    `${short(p)}${p.brand ? ` by ${p.brand}` : ""}, £${p.price}, colour ${p.colour ?? "unknown"}, category ${p.slot}`,
    `sizes in stock ${inStock.join(" ") || "not listed"}`,
    delivery,
    p.rating ? `rated ${p.rating.value} from ${p.rating.count} reviews` : "",
    p.details?.length ? `details: ${p.details.slice(0, 3).join(", ")}` : "",
  ].filter(Boolean).join(", ");
}

const freeDelivery = (p: Piece) =>
  p.ukDelivery?.price === 0 || (p.ukDelivery?.freeOver != null && p.ukDelivery.freeOver <= p.price);

// Facts about one piece next to the others in its category. Unknown data gives no label
export function labelsFor(p: Piece, all: Piece[]): LabelKind[] {
  const peers = all.filter((x) => x.slot === p.slot);
  const days = peers.map((x) => x.ukDelivery?.maxDays).filter((d): d is number => typeof d === "number");
  const open = (p.sizes ?? []).filter((s) => s.available).length;
  const kinds: LabelKind[] = [];
  if (peers.length > 1 && p.price === Math.min(...peers.map((x) => x.price))) kinds.push("cheapest");
  if (days.length > 1 && p.ukDelivery?.maxDays === Math.min(...days)) kinds.push("fastest");
  if (freeDelivery(p)) kinds.push("free_delivery");
  if (open > 0 && open <= 2 && (p.sizes ?? []).length > 3) kinds.push("few_left");
  if ((p.returns?.days ?? 0) >= 28) kinds.push("long_returns");
  return kinds;
}

function sectionSlots(setup: Setup): (SlotName | null)[] {
  if (setup.kind === "set") return [null];
  return (["outer", "top", "bottom", "shoes"] as SlotName[]).filter((s) => setup.pieces.some((p) => p.slot === s));
}

const sectionTitle = (slot: SlotName | null, setup: Setup) => slot ? LABEL[slot] : setup.setTitle;

// The first piece of each section. Jev designs its card and code repeats that design for every piece in the section
export const samplesOf = (setup: Setup): Piece[] =>
  sectionSlots(setup).flatMap((slot) => setup.pieces.find((p) => slot === null || p.slot === slot) ?? []);

// Pieces in the order their cards were shown, then the rest
export function inOrder(spec: Spec | null, pieces: Piece[]): Piece[] {
  const ids = Object.values(spec?.elements ?? {}).filter((e) => e.type === "ProductCard").map((e) => e.props.id as string);
  const at = (p: Piece) => (ids.indexOf(p.id) + 1 || Infinity);
  return [...pieces].sort((a, b) => at(a) - at(b));
}

// Prepared copy only. Jev can pick these, never write them
function copy(setup: Setup) {
  const shops = new Set(setup.pieces.map((p) => p.merchant)).size;
  const days = setup.pieces.map((p) => p.ukDelivery?.maxDays).filter((d): d is number => typeof d === "number");
  const unknown = [...new Set(setup.pieces.filter((p) => !p.ukDelivery).map((p) => p.merchant))];
  const quoted = [...setup.prompt.matchAll(/["“]([^"”\n]{1,80})["”]/g)].map((m) => m[1]);
  return {
    headings: [
      { text: setup.title, level: "h2", why: "the request title" },
      ...(setup.kind === "outfit" ? [{ text: "Your outfit", level: "h2", why: "a title for the outfit" }] : []),
      ...sectionSlots(setup).flatMap((s) => s ? [{ text: `Pick your ${LABEL[s].toLowerCase()}`, level: "h3", why: `a heading for the ${s} category` }] : []),
      ...quoted.map((text) => ({ text, level: "h3", why: "text the shopper asked for in quotes" })),
    ],
    texts: [
      ...(setup.say ? [{ text: setup.say, tone: "body", why: "the assistant's line to the shopper" }] : []),
      { text: `${setup.pieces.length} pieces from ${shops} UK shop${shops === 1 ? "" : "s"}`, tone: "muted", why: "how many pieces and shops" },
      {
        text: `${setup.pieces.filter(freeDelivery).length} of ${setup.pieces.length} pieces deliver free to the UK${days.length ? `, fastest within ${Math.min(...days)} days` : ""}`,
        tone: "muted",
        why: "a UK delivery summary",
      },
    ],
    callouts: [
      ...(setup.pieces.some((p) => p.source === "mock") ? [{ text: "Some pieces are samples, not from real shops", tone: "info" }] : []),
      ...(unknown.length ? [{ text: `UK delivery is unknown at ${unknown.slice(0, 3).join(", ")}`, tone: "warning" }] : []),
      { text: "Checkout is simulated, no money moves", tone: "info" },
    ],
  };
}

// Atomic element recipes, the only things Jev can place. Props never come from the model
export function buildCandidates(setup: Setup, samples: Piece[] = samplesOf(setup)): Candidate[] {
  const out: Candidate[] = [];
  const add = (id: string, description: string, type: Type, props: Record<string, unknown>, extra: Partial<Candidate> = {}) =>
    out.push({ id, description, element: { type, props }, root: false, ...extra });
  for (const theme of Object.keys(THEMES) as ThemeName[]) {
    for (const density of ["roomy", "compact"] as const) {
      for (const groupBy of ["category", "colour"] as const) {
        add(
          `page_${theme}_${density}${groupBy === "colour" ? "_by_colour" : ""}`,
          `Page titled "${setup.title}", ${THEMES[theme]} ${theme} theme, ${DENSITIES[density]}, ` +
            (groupBy === "colour"
              ? "items split by colour: one Section for each colour, like 'a category for each colour', 'group by colour' or 'split by colour'. Only when the request mentions colour groups."
              : "items split by kind of clothing: one Section each for jackets, tops, bottoms and shoes. The default."),
          "Page",
          { title: setup.title, theme, density, groupBy },
          { root: true, resource: "page" },
        );
      }
    }
  }
  const c = copy(setup);
  c.headings.forEach((h, i) => add(`heading_${i}`, `Heading "${h.text}", ${h.why}. Only when the request asks for a heading.`, "Heading", { text: h.text, level: h.level }));
  c.texts.forEach((t, i) => add(`text_${i}`, `Text "${t.text}", ${t.why}. Only when the request asks for it.`, "Text", { text: t.text, tone: t.tone }));
  c.callouts.forEach((t, i) => add(`callout_${i}`, `Callout "${t.text}", a ${t.tone} note found by code.`, "Callout", { text: t.text, tone: t.tone }));
  for (const direction of ["horizontal", "vertical"] as const) {
    add(`stack_${direction}`, `Stack: ${direction === "horizontal" ? "puts sections side by side" : "stacks sections vertically"}. Holds Sections.`, "Stack", { direction }, { maxUses: 3 });
  }
  // Every Section folds when the shopper taps its heading. open false starts it folded
  for (const slot of sectionSlots(setup)) {
    for (const open of [true, false]) {
      add(
        `section_${slot ?? "set"}${open ? "" : "_folded"}`,
        (slot
          ? `Section "${LABEL[slot]}" for the ${slot} category of the outfit. Holds a container with the ${slot} product cards.`
          : `Section "${setup.setTitle}" for every item of the set. Holds a container with the product cards.`) +
          (open ? " Open, the shopper can fold it." : " Folded, only its heading shows until the shopper opens it. Only when the request asks to fold, collapse or hide the items of a category."),
        "Section",
        { title: sectionTitle(slot, setup), slot, open },
      );
    }
  }
  for (const type of Object.keys(CONTAINERS) as (keyof typeof CONTAINERS)[]) {
    for (const size of ["small", "medium", "large"] as const) {
      add(`${type.toLowerCase()}_${size}`, `${type}: ${CONTAINERS[type]} with ${SIZES[size]}. Holds product cards.`, type, { size }, { maxUses: 8 });
    }
  }
  add("separator", "Separator: a line between sections. Only when asked.", "Separator", {}, { maxUses: 8 });
  for (const p of samples) {
    const peers = setup.kind === "set" ? setup.pieces : setup.pieces.filter((x) => x.slot === p.slot);
    const every = `every ${setup.kind === "set" ? "item" : `${p.slot} item`}`;
    add(`card_${p.id}`, `ProductCard: the sample card, code shows ${every} with the same design. Sample data: ${describe(p)}`, "ProductCard", { id: p.id });
    for (const t of PART_TYPES.filter((t) => peers.some((x) => has(t, x)))) {
      add(`${t.toLowerCase()}_${p.id}`, `${t}: ${PARTS[t]} on ${every}. Goes inside the sample ProductCard of its Section.`, t, { id: p.id });
    }
    const kind = peers.flatMap((x) => labelsFor(x, setup.pieces))[0];
    if (kind) {
      add(`label_${p.id}`, `Label: facts computed from shop data, like cheapest, fastest UK delivery, free UK delivery, few sizes left or long returns, on ${every} that has one. Goes inside the sample ProductCard of its Section.`, "Label", {
        id: p.id,
        kind: labelsFor(p, setup.pieces)[0] ?? kind,
      });
    }
  }
  for (const slot of setup.kind === "outfit" ? [...sectionSlots(setup), null] : [null]) {
    add(`compare_${slot ?? "all"}`, `CompareTable: compares price, UK delivery and returns for ${slot ? `every ${slot} piece` : "every piece on the page"}.`, "CompareTable", { slot });
  }
  add("shop_summary", "ShopSummary: UK delivery and returns per shop on the page.", "ShopSummary", {});
  const FILTER_BY = { size: "sizes in stock", colour: "colour", delivery: "free or fast UK delivery", price: "price" };
  for (const [by, what] of Object.entries(FILTER_BY)) {
    add(`filters_${by}`, `Filters: buttons that let the shopper filter every item on the page by ${what}. Goes in the Page before the Sections. Only when the request asks for filters or to filter by ${by}.`, "Filters", { by }, { maxUses: 1 });
  }
  if (setup.kind === "outfit") add("outfit_total", "OutfitTotal: the outfit total price and an Add outfit to bag button.", "OutfitTotal", {});
  return out;
}

type Tree = {
  page: { title: string; theme: ThemeName; density: "roomy" | "compact" };
  container: { type: string; size: string };
  // Page children in order: a section by its slot, or an extra element
  top: (SlotName | null | SpecElement)[];
  cards: { piece: Piece; parts: SpecElement[] }[];
  total: boolean;
  // Sections that start folded
  folded?: (SlotName | null)[];
};

// Page > Section per category > one container > cards > their detail parts. Always valid by construction
function buildTree(t: Tree, setup: Setup): Spec {
  const elements: Record<string, SpecElement> = { page: { type: "Page", props: t.page, children: [] } };
  const page = elements.page.children!;
  for (const item of t.top) {
    if (item && typeof item === "object") {
      const id = fresh(elements, item.type.toLowerCase());
      elements[id] = { type: item.type, props: item.props };
      page.push(id);
      continue;
    }
    const cards = t.cards.filter((c) => item === null || c.piece.slot === item);
    if (!cards.length) continue;
    const key = item ?? "set";
    page.push(`section_${key}`);
    elements[`section_${key}`] = {
      type: "Section",
      props: { title: sectionTitle(item, setup), slot: item, open: !t.folded?.includes(item) },
      children: [`box_${key}`],
    };
    elements[`box_${key}`] = { type: t.container.type, props: { size: t.container.size }, children: cards.map((c) => addCard(elements, c.piece, c.parts)) };
  }
  if (t.total) {
    elements.total = { type: "OutfitTotal", props: {} };
    page.push("total");
  }
  return { root: "page", elements };
}

function addCard(elements: Record<string, SpecElement>, p: Piece, parts: SpecElement[]): string {
  const id = fresh(elements, `card_${p.id}`);
  elements[id] = {
    type: "ProductCard",
    props: { id: p.id },
    children: parts.map((part) => {
      const partId = fresh(elements, [part.type.toLowerCase(), part.props.kind, p.id].filter(Boolean).join("_"));
      elements[partId] = { type: part.type, props: { ...part.props, id: p.id } };
      return partId;
    }),
  };
  return id;
}

function fresh(elements: Record<string, SpecElement>, base: string): string {
  let id = base;
  for (let n = 2; Object.hasOwn(elements, id); n++) id = `${base}_${n}`;
  return id;
}

// A card's parts in the order of types. Label stands for every label the piece has, parts without data are left out
const cardParts = (types: string[], p: Piece, all: Piece[]): SpecElement[] =>
  types.flatMap((type) =>
    type === "Label"
      ? labelsFor(p, all).map((kind) => ({ type, props: { id: p.id, kind } }))
      : type in PARTS && has(type, p)
      ? [{ type, props: { id: p.id } }]
      : []
  );

export function defaultTree(setup: Setup): Spec {
  return buildTree({
    page: { title: setup.title, theme: "studio", density: "roomy" },
    container: { type: "Grid", size: "medium" },
    top: sectionSlots(setup),
    cards: setup.pieces.map((piece) => ({ piece, parts: cardParts([...DEFAULT_PARTS, "Label"], piece, setup.pieces) })),
    total: setup.kind === "outfit",
  }, setup);
}

// Keeps what Jev chose (theme, density, container, which cards, details and extras, their order)
// and puts every part where it belongs, so detail parts sit in their own card and no section is empty.
// ponytail: a Stack Jev picks for a new tree is flattened, edits can add one
function arrange(spec: Spec, setup: Setup): Spec | null {
  const byId = new Map(setup.pieces.map((p) => [p.id, p]));
  const order: SpecElement[] = [];
  const walk = (id: string) => {
    const e = spec.elements[id];
    if (!e) return;
    order.push(e);
    (e.children ?? []).forEach(walk);
  };
  walk(spec.root);
  const root = spec.elements[spec.root];
  if (root?.type !== "Page") return null;
  const counts = new Map<string, number>();
  for (const e of order.filter((e) => isContainer(e.type))) {
    const key = `${e.type}:${e.props.size}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [type, size] = ([...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Grid:medium").split(":");
  const parts = new Map<string, SpecElement[]>();
  for (const e of order.filter((e) => isPart(e.type))) {
    const list = parts.get(e.props.id as string) ?? [];
    if (!list.some((x) => x.type === e.type && x.props.kind === e.props.kind)) list.push({ type: e.type, props: e.props });
    parts.set(e.props.id as string, list);
  }
  const cards = [...new Set(order.filter((e) => e.type === "ProductCard").map((e) => e.props.id as string))]
    .flatMap((id) => byId.has(id) ? [{ piece: byId.get(id)!, parts: parts.get(id) ?? [] }] : []);
  if (!cards.length) return null;
  // A section Jev left without its sample card takes the parts of the first card
  for (const p of samplesOf(setup)) if (!cards.some((c) => setup.kind === "set" || c.piece.slot === p.slot)) cards.push({ piece: p, parts: cards[0].parts });
  const valid = sectionSlots(setup);
  const top: Tree["top"] = [];
  for (const e of order) {
    const slot = e.props.slot as SlotName | null;
    if (e.type === "Section" && valid.includes(slot) && !top.includes(slot)) top.push(slot);
    else if (EXTRAS.has(e.type)) top.push({ type: e.type, props: e.props });
  }
  for (const s of valid) if (!top.includes(s)) top.push(s);
  return buildTree({
    page: root.props as Tree["page"],
    container: { type, size },
    top,
    cards,
    total: setup.kind === "outfit" && order.some((e) => e.type === "OutfitTotal"),
    folded: order.filter((e) => e.type === "Section" && e.props.open === false).map((e) => e.props.slot as SlotName | null),
  }, setup);
}

const PARENT =
  "A Section goes in the Page or in a Stack. A container (Grid, Carousel, List) goes in a Section. A ProductCard goes in the container of the Section for its own category. A detail part (SizePicker, AddToBag, Delivery, Returns, StockBadge, Gallery, Description, Rating, Label) goes inside the ProductCard of the same item. Headings, Text, Callouts, Filters, CompareTable, ShopSummary and Stacks go in the Page, Filters before the Sections. OutfitTotal goes in the Page after the Sections.";

// Builds a new storefront with Jev in one batch. Yields every step's spec, then a fallback built in code if Jev could not
export async function* composeUI(
  prompt: string,
  setup: Setup,
  storefront: string | null,
  signal: AbortSignal,
): AsyncGenerator<{ spec: Spec; fallback?: boolean }> {
  const sections = sectionSlots(setup).map((s) => sectionTitle(s, setup));
  let last: Spec | null = null;
  try {
    for await (
      const event of experimental_composeSpec({
        catalog,
        candidates: buildCandidates(setup),
        prompt,
        evaluate,
        maxElements: 120,
        maxDepth: 6,
        maxSteps: 4,
        signal,
        context: { kind: setup.kind, sections, pieces: setup.pieces.length },
        instructions: {
          root: "Use a Page. Pick the studio theme and roomy density unless the request asks for a dark, bold, colourful or compact page.",
          next: [
            setup.kind === "outfit"
              ? `Include one Section per category (${sections.join(", ")}) and one Grid medium container in each Section, so ${sections.length} Grid medium in total, unless the request asks for another container or photo size.`
              : "Include the Section and one Grid medium container in it, unless the request asks for another container or photo size.",
            "Include the sample ProductCard of each Section, code shows every item of the Section with the same design. The sample card holds a SizePicker, AddToBag, Delivery and the Label when one is offered. Include Returns, StockBadge, Gallery, Description and Rating only when the request asks for them.",
            "Include a Callout about samples or unknown delivery when one is offered. Include Headings, Text, Stacks, Separators, CompareTables, Filters and the ShopSummary only when the request asks for them. For filters, add one Filters per thing the shopper wants to filter by.",
            setup.kind === "outfit" ? "Include the OutfitTotal, it goes last." : "",
            storefront ? `Reproduce the style of this saved storefront: ${storefront}` : "",
          ].filter(Boolean).join(" "),
          parent: PARENT,
        },
      })
    ) {
      if (!event.spec) continue;
      const design = arrange(event.spec as Spec, setup);
      if (!design) continue;
      const spec = bind(design, setup.pieces, true);
      last = spec;
      yield { spec };
    }
  } catch (err) {
    console.error("Jev compose", err);
  }
  if (!last) yield { spec: defaultTree(setup), fallback: true };
}

// A readable label per element so Jev can find edit targets
function label(e: SpecElement, byId: Map<string, Piece>): string {
  const p = byId.get(e.props.id as string);
  const of = p ? ` on every card in its Section` : "";
  switch (e.type) {
    case "Page":
      return `Page "${e.props.title}", ${e.props.theme} theme, ${e.props.density}, items grouped by ${e.props.groupBy ?? "category"}`;
    case "Section":
      return `Section "${e.props.title}"${e.props.slot ? `, ${e.props.slot} category` : ""}${e.props.open === false ? ", folded" : ", open"}`;
    case "ProductCard":
      return p ? `the sample ProductCard, every item in its Section shows this design, sample data ${short(p)}` : "ProductCard";
    case "Label":
      return `Label: facts from shop data${of}`;
    case "Heading":
    case "Text":
    case "Callout":
      return `${e.type} "${e.props.text}"`;
    case "Stack":
      return `Stack, ${e.props.direction}`;
    case "CompareTable":
      return `CompareTable of price, delivery and returns for ${e.props.slot ? `the ${e.props.slot} pieces` : "every piece"}`;
    case "ShopSummary":
      return "ShopSummary: UK delivery and returns per shop";
    case "Filters":
      return `Filters by ${e.props.by} for every item on the page`;
    case "OutfitTotal":
      return "OutfitTotal: outfit total and Add outfit to bag button";
  }
  if (isContainer(e.type)) return `${e.type}, ${e.props.size} size, ${CONTAINERS[e.type as keyof typeof CONTAINERS]}`;
  if (e.type in PARTS) return `${e.type}: ${PARTS[e.type as Part]}${of}`;
  return e.type;
}

// Edits the current tree with Jev, like the playground's initialSpec protocol. Yields each step, then how it stopped
export async function* refineUI(
  prompt: string,
  spec: Spec,
  setup: Setup,
  signal: AbortSignal,
): AsyncGenerator<{ spec: Spec } | { stop: "finish" | "limit" | "unavailable" | "error" }> {
  const byId = new Map(setup.pieces.map((p) => [p.id, p]));
  // Jev edits the design, one sample card per section: the section's first card. Every step is bound back to all the pieces
  const within = (id: string): string[] => [id, ...(spec.elements[id]?.children ?? []).flatMap(within)];
  const firsts = Object.keys(spec.elements).filter((k) => spec.elements[k].type === "Section")
    .map((s) => within(s).find((k) => spec.elements[k]?.type === "ProductCard"))
    .map((k) => byId.get(spec.elements[k ?? ""]?.props.id as string))
    .filter((p): p is Piece => !!p);
  const samples = firsts.length ? [...new Set(firsts)] : samplesOf(setup);
  const design = sample(spec, new Set(samples.map((p) => p.id)));
  try {
    for await (
      const event of experimental_composeSpec({
        catalog,
        candidates: buildCandidates(setup, samples),
        initialSpec: design,
        elementDescriptions: Object.fromEntries(Object.entries(design.elements).map(([id, e]) => [id, label(e, byId)])),
        prompt,
        evaluate,
        strategy: "sequential",
        maxSteps: 40,
        maxDepth: 6,
        signal,
        context: { kind: setup.kind, pieces: setup.pieces.length },
        instructions: {
          next:
            "Make only the change the shopper asks for and keep everything else. Each Section shows one sample ProductCard and code repeats its design for every item in that Section, so change the sample card once to change every item in the Section. Never remove a sample ProductCard. To show more photos, descriptions, materials, ratings, returns or stock, add a Gallery, Description, Rating, Returns or StockBadge inside the sample card of each Section. To change how items are laid out or their photo size, replace each container (Grid, Carousel, List) with the requested one, its cards stay. To change the theme or spacing, replace the Page with the matching variant. To let the shopper filter items, add one Filters per thing they want to filter by (size, colour, delivery, price). To group items by colour, or back by category, replace the Page with the variant that keeps its theme and density and has the requested grouping. To hide a category, remove its Section. To fold or collapse a category, or open a folded one, replace its Section with the folded or open variant. When the request is about every item or every category, repeat the change in every Section. Check already_built and changes_made before you finish and only finish when none is left.",
          parent: PARENT,
        },
      })
    ) {
      if (event.type !== "step") yield { stop: event.stopReason };
      else {
        const next = bind(repair(event.spec as Spec, byId), setup.pieces, false);
        // A step that leaves no items on the page is not shown, the shopper keeps the last page with items
        if (Object.values(next.elements).some((e) => e.type === "ProductCard")) yield { spec: next };
      }
    }
  } catch (err) {
    console.error("Jev refine", err);
    yield { stop: "error" };
  }
}

const SLOT_ORDER: SlotName[] = ["outer", "top", "bottom", "shoes"];

// One group per colour, biggest first, pieces with no known colour last
function colourGroups(pieces: Piece[]) {
  const count = new Map<string, number>();
  for (const p of pieces) count.set(p.colour ?? "other", (count.get(p.colour ?? "other") ?? 0) + 1);
  return [...count.keys()]
    .sort((a, b) => (a === "other" ? 1 : b === "other" ? -1 : count.get(b)! - count.get(a)!))
    .map((colour) => ({ title: colour === "other" ? "Other colours" : colour[0].toUpperCase() + colour.slice(1), slot: null, colour }));
}

// The design Jev sees: each section keeps only its sample card
function sample(spec: Spec, samples: Set<string>): Spec {
  const E = structuredClone(spec.elements);
  const kept = new Set<string>();
  for (const [k, e] of Object.entries(spec.elements)) {
    const id = e.props.id as string;
    if (e.type !== "ProductCard" || (samples.has(id) && !kept.has(id) && kept.add(id))) continue;
    for (const x of Object.keys(E)) if (E[x]?.children?.includes(k)) E[x].children = E[x].children!.filter((c) => c !== k);
    for (const c of [k, ...(e.children ?? [])]) delete E[c];
  }
  return { root: spec.root, elements: E };
}

// Loads every piece into the design, like data into a template: each section's cards get the parts of its sample card.
// grow adds a section, in the style of the first one, for a category that has pieces but no section yet
export function bind(design: Spec, pieces: Piece[], grow: boolean): Spec {
  const E = structuredClone(design.elements);
  const within = (id: string): string[] => [id, ...(E[id]?.children ?? []).flatMap(within)];
  const find = (id: string, type: (t: string) => boolean) => within(id).find((k) => E[k] && type(E[k].type));
  const drop = (id: string) => {
    for (const k of Object.keys(E)) if (E[k].children?.includes(id)) E[k].children = E[k].children!.filter((c) => c !== id);
    within(id).forEach((k) => delete E[k]);
  };
  const sections = () => Object.keys(E).filter((k) => E[k].type === "Section");
  const types = new Map(sections().map((s) => {
    const card = find(s, (t) => t === "ProductCard");
    return [s, card ? [...new Set(E[card].children!.map((c) => E[c].type))] : [...DEFAULT_PARTS, "Label"]];
  }));
  // Grouping by colour rebuilds the sections, one per colour, in the style of the first section. Going back to
  // categories rebuilds them per category the same way
  const byColour = E[design.root]?.props.groupBy === "colour";
  const stale = sections().filter((s) => byColour || !!E[s].props.colour);
  if (stale.length) {
    const first = sections()[0];
    const firstBox = first && find(first, isContainer);
    const box = firstBox ? { type: E[firstBox].type, props: { ...E[firstBox].props } } : { type: "Grid", props: { size: "medium" } };
    const parts = types.get(first) ?? [...DEFAULT_PARTS, "Label"];
    const root = E[design.root].children ?? [];
    const at = root.findIndex((k) => E[k]?.type === "Section" || E[k]?.type === "Stack");
    const before = new Set(root.slice(0, at === -1 ? root.length : at));
    // A section the shopper folded stays folded when it is rebuilt
    const folded = new Set(stale.filter((s) => E[s].props.open === false).map((s) => E[s].props.title));
    stale.forEach(drop);
    for (const k of Object.keys(E)) if (E[k]?.type === "Stack" && !E[k].children?.length) drop(k);
    const groups = byColour ? colourGroups(pieces) : SLOT_ORDER.filter((s) => pieces.some((p) => p.slot === s)).map((s) => ({ title: LABEL[s], slot: s }));
    const ids = groups.map((g) => {
      const key = "colour" in g ? `colour_${g.colour}` : g.slot;
      const sid = fresh(E, `section_${key}`);
      const bid = fresh(E, `box_${key}`);
      E[bid] = { type: box.type, props: box.props, children: [] };
      E[sid] = { type: "Section", props: { ...g, open: !folded.has(g.title) }, children: [bid] };
      types.set(sid, parts);
      return sid;
    });
    const rest = E[design.root].children ?? [];
    const pos = rest.findIndex((k) => !before.has(k));
    rest.splice(pos === -1 ? rest.length : pos, 0, ...ids);
    E[design.root].children = rest;
  }
  const set = sections().some((s) => E[s].props.slot === null && !E[s].props.colour);
  for (const slot of grow && !set && !byColour ? [...new Set(pieces.map((p) => p.slot))] : []) {
    if (sections().some((s) => E[s].props.slot === slot)) continue;
    const model = sections()[0];
    const box = model && find(model, isContainer);
    const sid = fresh(E, `section_${slot}`);
    const bid = fresh(E, `box_${slot}`);
    E[bid] = { type: box ? E[box].type : "Grid", props: box ? { ...E[box].props } : { size: "medium" }, children: [] };
    E[sid] = { type: "Section", props: { title: LABEL[slot], slot }, children: [bid] };
    types.set(sid, types.get(model) ?? [...DEFAULT_PARTS, "Label"]);
    const root = E[design.root].children!;
    const total = root.findIndex((c) => E[c]?.type === "OutfitTotal");
    root.splice(total === -1 ? root.length : total, 0, sid);
  }
  for (const s of sections()) {
    within(s).filter((k) => E[k]?.type === "ProductCard").forEach(drop);
    const colour = E[s].props.colour as string | undefined;
    const mine = pieces.filter((p) => colour ? (p.colour ?? "other") === colour : E[s].props.slot === null || p.slot === E[s].props.slot);
    const box = find(s, isContainer);
    if (!mine.length || !box) drop(s);
    else E[box].children!.push(...mine.map((p) => addCard(E, p, cardParts(types.get(s)!, p, pieces))));
  }
  // Filters sit together just above the first Section, wherever Jev put them
  const top = E[design.root]?.children ?? [];
  const filters = top.filter((k) => E[k]?.type === "Filters");
  if (filters.length) {
    const rest = top.filter((k) => E[k]?.type !== "Filters");
    const at = rest.findIndex((k) => E[k]?.type === "Section" || E[k]?.type === "Stack");
    rest.splice(at === -1 ? rest.length : at, 0, ...filters);
    E[design.root].children = rest;
  }
  return { root: design.root, elements: E };
}

// Checks an edited tree: cards show known pieces, detail parts sit in their own card, no empty sections or containers
function repair(spec: Spec, byId: Map<string, Piece>): Spec {
  const E = structuredClone(spec.elements);
  const parentOf = (id: string) => Object.keys(E).find((k) => E[k].children?.includes(id));
  const drop = (id: string) => {
    const p = parentOf(id);
    if (p) E[p].children = E[p].children!.filter((c) => c !== id);
    const gone = (k: string): void => {
      (E[k]?.children ?? []).forEach(gone);
      delete E[k];
    };
    gone(id);
  };
  const hasCard = (id: string): boolean => E[id]?.type === "ProductCard" || (E[id]?.children ?? []).some(hasCard);
  // Jev sometimes adds a Page variant inside the page instead of replacing it. Its settings go to the root page
  for (const k of Object.keys(E)) {
    if (k === spec.root || E[k]?.type !== "Page" || !E[spec.root]) continue;
    const root = E[spec.root];
    root.props = { ...root.props, ...E[k].props, title: root.props.title };
    for (const x of Object.keys(E)) if (E[x].children?.includes(k)) E[x].children = E[x].children!.filter((c) => c !== k);
    root.children = [...(root.children ?? []), ...(E[k].children ?? [])];
    delete E[k];
  }
  for (const k of Object.keys(E)) if (E[k]?.type === "ProductCard" && !byId.has(E[k].props.id as string)) drop(k);
  const cardOf = new Map(Object.keys(E).filter((k) => E[k].type === "ProductCard").map((k) => [E[k].props.id as string, k]));
  for (const k of Object.keys(E)) {
    if (!E[k] || !isPart(E[k].type)) continue;
    const home = cardOf.get(E[k].props.id as string);
    const p = parentOf(k);
    if (p === home) continue;
    if (p) E[p].children = E[p].children!.filter((c) => c !== k);
    const same = (c: string) => E[c].type === E[k].type && E[c].props.kind === E[k].props.kind;
    if (home && !E[home].children!.some(same)) E[home].children!.push(k);
    else delete E[k];
  }
  for (const k of Object.keys(E)) if ((E[k]?.type === "Section" || isContainer(E[k]?.type ?? "")) && !hasCard(k)) drop(k);
  for (const k of Object.keys(E)) if (E[k]?.type === "Stack" && !E[k].children?.length) drop(k);
  return { root: spec.root, elements: E };
}

// Validates a tree built outside Jev, like a saved storefront. null when it cannot be shown
export function checkSpec(spec: Spec, pieces: Piece[]): Spec | null {
  const out = repair(spec, new Map(pieces.map((p) => [p.id, p])));
  const seen = new Set<string>();
  const walk = (id: string): boolean =>
    !!out.elements[id] && !seen.has(id) && !!seen.add(id) && (out.elements[id].children ?? []).every(walk);
  const ok = out.elements[out.root]?.type === "Page" && walk(out.root) && seen.size === Object.keys(out.elements).length &&
    catalog.validate(out).success && Object.values(out.elements).some((e) => e.type === "ProductCard");
  return ok ? out : null;
}

// Self check: Jev sees one card per section, and binding repeats that card's design for every piece
export function demo() {
  const piece = (id: string, slot: SlotName, price: number) => ({ id, slot, price, image: "x", sizes: [], ukDelivery: null, returns: null }) as unknown as Piece;
  const pieces = [piece("a", "top", 20), piece("b", "top", 30), piece("c", "shoes", 50)];
  const spec: Spec = {
    root: "page",
    elements: {
      page: { type: "Page", props: { title: "T", theme: "studio", density: "roomy" }, children: ["s_top", "total"] },
      s_top: { type: "Section", props: { title: "Tops", slot: "top" }, children: ["box"] },
      box: { type: "Carousel", props: { size: "large" }, children: ["card_a", "card_b"] },
      card_a: { type: "ProductCard", props: { id: "a" }, children: ["add_a", "label_a"] },
      add_a: { type: "AddToBag", props: { id: "a" } },
      label_a: { type: "Label", props: { id: "a", kind: "cheapest" } },
      card_b: { type: "ProductCard", props: { id: "b" }, children: [] },
      total: { type: "OutfitTotal", props: {} },
    },
  };
  const design = sample(spec, new Set(["a"]));
  console.assert(!design.elements.card_b && design.elements.card_a, "one sample card per section");
  const out = bind(design, pieces, true);
  const cards = Object.values(out.elements).filter((e) => e.type === "ProductCard");
  console.assert(cards.length === 3, "every piece gets a card");
  console.assert(out.elements.card_b.children!.map((c) => out.elements[c].type).join() === "AddToBag", "b takes the sample's parts, no label it has not earned");
  console.assert(out.elements.card_a.children!.some((c) => out.elements[c].type === "Label"), "a keeps its computed label");
  const shoes = Object.keys(out.elements).find((k) => out.elements[k].props.slot === "shoes")!;
  console.assert(out.elements[out.elements[shoes].children![0]].type === "Carousel", "a new category copies the first section's style");
  console.assert(out.elements.page.children!.at(-1) === "total", "total stays last");
  console.assert(!Object.values(bind(design, pieces, false).elements).some((e) => e.props.slot === "shoes"), "no new section without grow");
  const coloured = pieces.map((p, i) => ({ ...p, colour: ["black", "black", null][i] }));
  const byColour = bind({ root: out.root, elements: { ...out.elements, page: { ...out.elements.page, props: { ...out.elements.page.props, groupBy: "colour" } } } }, coloured, false);
  const titles = (s: Spec) => Object.values(s.elements).filter((e) => e.type === "Section").map((e) => e.props.title).join();
  console.assert(titles(byColour) === "Black,Other colours", "one section per colour, unknown last");
  console.assert(byColour.elements[byColour.elements.section_colour_black.children![0]].children!.length === 2, "both black pieces in Black");
  console.assert(byColour.elements[byColour.elements.section_colour_black.children![0]].type === "Carousel", "colour sections keep the design");
  const back = bind({ root: "page", elements: { ...byColour.elements, page: { ...byColour.elements.page, props: { ...byColour.elements.page.props, groupBy: "category" } } } }, coloured, false);
  console.assert(titles(back) === "Tops,Shoes", "back to one section per category");
  return "ok";
}
