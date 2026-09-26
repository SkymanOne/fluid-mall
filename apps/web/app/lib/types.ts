// Contract between the compose Edge Function and the clients.
// supabase/functions/compose/types.ts mirrors these types, keep both in sync.

export type SlotName = "outer" | "top" | "bottom" | "shoes";

export type ThemeName = "studio" | "backstage" | "showroom";

export type Piece = {
  id: string;
  title: string;
  merchant: string;
  merchantUrl: string;
  url: string;
  image: string | null;
  slot: SlotName;
  colour: string | null;
  // GBP. When the shop sells in another currency, `converted` keeps the original
  price: number;
  converted: { amount: number; currency: string } | null;
  sizes: { label: string; available: boolean }[];
  // null means unknown, show "Unknown, check at <merchant>"
  ukDelivery: { price: number | null; freeOver: number | null; days: string | null; maxDays: number | null } | null;
  returns: { days: number | null; note: string | null } | null;
  source: "live" | "mock";
  fetchedAt: string;
  // Everything else the shop page offers, so the shopper rarely needs to leave Fluid.
  // All copied or extracted from the shop, never written by a model. Empty or null when the shop does not say
  images: string[];
  brand: string | null;
  // The shop's own product description as plain text, trimmed
  description: string | null;
  // Short facts from the shop: material, fit, care, origin, model size
  details: string[];
  rating: { value: number; count: number } | null;
  // Other colours the shop sells this piece in
  colours: string[];
  // Every UK delivery option the shop lists, cheapest first
  deliveryOptions: { name: string; price: number | null; days: string | null }[];
};

export type Intent = {
  layout: "look" | "lineup";
  slots: SlotName[];
  colour: string | null;
  size: string | null;
  budget: number | null;
  // Menswear or womenswear, when the shopper said so or the request implies it
  gender: "men" | "women" | null;
  sort: "relevance" | "price" | "delivery";
  theme: ThemeName | null;
  density: "regular" | "compact" | null;
};

// The storefront is a json-render flat spec that Jev composes from the catalog below and edits on
// every follow-up prompt, like the json-render playground. Code builds the candidates, Jev picks and arranges.
//
// Catalog, all props are literal values:
//   Page        { title: string, theme: ThemeName, density: "roomy" | "compact", groupBy?: "category" | "colour" }
//                                                                                 root only, slot default. groupBy colour: code makes one Section per colour
//   Section     { title: string, slot: SlotName | null, open?: boolean }          slot default. slot set = an outfit category.
//                                                                                 Folds from its heading, open false starts folded.
//                                                                                 colour?: string marks a section of one colour, made by code
//   Grid        { size: "small" | "medium" | "large" }                            slot default
//   Carousel    { size: "small" | "medium" | "large" }                            slot default
//   List        { size: "small" | "medium" | "large" }                            slot default
//   ProductCard { id: string }                                                    slot default, holds the detail parts below
//   SizePicker  { id: string }   AddToBag { id: string }   Delivery { id: string }
//   Returns     { id: string }   StockBadge { id: string }
//   OutfitTotal {}                                                                the outfit total and Add outfit to bag
//   Heading     { text: string, level: "h2" | "h3" }                             prepared copy only (request title, quoted text)
//   Text        { text: string, tone: "body" | "muted" }                         prepared copy only (agent line, piece and shop counts)
//   Label       { id: string, kind: LabelKind }                                  a fact about one piece, inside its ProductCard
//   Callout     { text: string, tone: "info" | "warning" }                       facts code found (samples shown, delivery unknown, simulated checkout)
//   Separator   {}
//   Stack       { direction: "horizontal" | "vertical" }                         slot default, sections side by side or stacked
//   Gallery     { id: string }   Description { id: string }   Rating { id: string }   inside a ProductCard, from the shop's own data
//   CompareTable { slot: SlotName | null }                                        price, delivery and returns for every piece in that category, null for all
//   Filters     { by: "size" | "colour" | "delivery" | "price" }                  buttons that filter every item on the page, in the browser
//   ShopSummary {}                                                               UK delivery and returns per shop on the page
// Every Label is computed in code from piece data, never written by a model
export type LabelKind = "cheapest" | "fastest" | "free_delivery" | "few_left" | "long_returns";

export type SpecElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  slots?: Record<string, string[]>;
};
export type Spec = { root: string; elements: Record<string, SpecElement> };

export type ComposeRequest = {
  prompt: string;
  // Earlier prompts for this storefront, oldest first. Empty for a new storefront
  history: string[];
  previousIntent: Intent | null;
  // Saved storefronts Jev can reuse for a new request. description says what request each was made for
  storefronts: { id: string; description: string }[];
  // The current UI and the pieces it shows. Present on follow-ups so Jev edits this tree instead of starting over
  spec: Spec | null;
  pieces: Piece[];
  // A saved storefront the shopper chose for new searches. The found pieces load into it (fromTemplate in
  // template.ts) instead of a fresh Jev composition. Refine steps still run on the result
  template: { spec: Spec; cards: Record<string, string[]> } | null;
};

// Streamed as NDJSON, one event per line
export type ComposeEvent =
  | { type: "note"; text: string }
  // refining false: a new shopping request, so a new group. storefront: saved storefront Jev chose to reuse
  | { type: "intent"; intent: Intent; refining: boolean; storefront: string | null }
  // New pieces from a search. The client merges them into the group
  | { type: "pieces"; pieces: Piece[] }
  // A full snapshot of the UI tree, streamed as Jev builds or edits it
  | { type: "spec"; spec: Spec }
  | { type: "done"; source: "live" | "mock" | "mixed" }
  | { type: "error"; message: string };
