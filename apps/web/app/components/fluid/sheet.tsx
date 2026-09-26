import { ChevronDownIcon, ClockIcon, HeartIcon, InfoIcon, ShoppingBagIcon, SparklesIcon, TriangleAlertIcon, TruckIcon, Undo2Icon, XIcon } from "lucide-react";
import { createContext, useContext, useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "~/components/ui/carousel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Marker, MarkerContent } from "~/components/ui/marker";
import { Progress } from "~/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { outfitImage } from "~/lib/agent";
import { byMerchant, deliveryLine, freeDelivery, gbp, returnsLine, slotLabel, slotOrder } from "~/lib/format";
import type { Group, OutfitImage } from "~/lib/store";
import { useSupabase } from "~/lib/supabase";
import type { LabelKind, Piece, SlotName, SortBy, Spec, SpecElement, ThemeName } from "~/lib/types";
import { cn } from "~/lib/utils";
import { AddButton, Description, Figure, Gallery, Photo, Rating, SizeButtons, SizeGuide, SizeSelect, Stock } from "./piece";

const kids = (el: SpecElement | undefined) => el?.children ?? el?.slots?.default ?? [];

// Outfit when the page shows categories or an outfit total, set otherwise
export const groupKind = (g: Group) => {
  const els = Object.values(g.spec?.elements ?? {});
  if (els.some((e) => e.type === "OutfitTotal" || (e.type === "Section" && e.props.slot))) return "look";
  return g.intent?.layout === "lineup" ? "lineup" : "look";
};
export const kindLabel = (g: Group) => (groupKind(g) === "lineup" ? "Set" : "Outfit");

// The Page root decides the theme, so each group can look its own way
export const pageTheme = (spec: Spec | null) => (spec?.elements[spec.root]?.props.theme as ThemeName | undefined) ?? "studio";

export type Filter = { key: string; label: string };

export type GroupActions = {
  onPick: (slot: SlotName, id: string) => void;
  onSize: (id: string, size: string) => void;
  onAdd: (lines: { piece: Piece; size: string | null }[]) => void;
  onOpen: (piece: Piece) => void;
  onRemoveFilter: (key: string) => void;
  onSave: (id: string) => void;
  // This group's bag, for free delivery progress
  bag: { piece: Piece; size: string | null }[];
};

// What the shopper picked in the page's Filters. Filtering happens here, the items and the spec stay the same
// Keys are colour, delivery, price and size_<category>, since each category has its own sizes
type FilterBy = "size" | "colour" | "delivery" | "price";
type Facets = Record<string, string | undefined>;
type Ctx = { spec: Spec; group: Group; compact: boolean; facets: Facets; setFacet: (key: string, value: string | null) => void } & GroupActions;

const FILTER_TITLE: Record<FilterBy, string> = { size: "Size", colour: "Colour", delivery: "UK delivery", price: "Price" };
const SIZE_TITLE: Record<SlotName, string> = { outer: "Jacket size", top: "Top size", bottom: "Bottoms size", shoes: "Shoe size" };

// Shops write one waist as "W32", "32" or "32 in.", so bottoms filter on W32
const sizeKey = (label: string, slot: SlotName) => {
  const waist = slot === "bottom" && label.match(/^(?:w\s*)?(\d{2})\s*(?:in\.?|inch|")?$/i);
  return waist ? `W${waist[1]}` : label;
};

// Unknown data never matches a filter the shopper picked
function shows(p: Piece | undefined, f: Facets): p is Piece {
  if (!p?.image) return false;
  const size = f[`size_${p.slot}`];
  if (size && !p.sizes.some((s) => sizeKey(s.label, p.slot) === size && s.available)) return false;
  if (f.colour && p.colour?.toLowerCase() !== f.colour && !p.title.toLowerCase().includes(f.colour)) return false;
  if (f.delivery === "free" && !freeDelivery(p)) return false;
  if (f.delivery && f.delivery !== "free" && !(p.ukDelivery?.maxDays != null && p.ukDelivery.maxDays <= Number(f.delivery))) return false;
  return !f.price || p.price <= Number(f.price);
}

// The choices a Filters row offers, taken from the items on the page
function filterOptions(by: FilterBy, pieces: Piece[]): { value: string; label: string }[] {
  if (by === "size") {
    const rank = (l: string) => {
      const i = ["XXS", "XS", "S", "M", "L", "XL", "XXL"].indexOf(l.toUpperCase());
      return i >= 0 ? i : 100 + (parseFloat(l.replace(/^\D+/, "")) || 0);
    };
    const labels = [...new Set(pieces.flatMap((p) => p.sizes.filter((s) => s.available).map((s) => sizeKey(s.label, p.slot))))];
    return labels.sort((a, b) => rank(a) - rank(b)).map((l) => ({ value: l, label: l }));
  }
  if (by === "colour") {
    const colours = [...new Set(pieces.map((p) => p.colour?.toLowerCase()).filter((c): c is string => !!c))];
    return colours.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }));
  }
  if (by === "delivery") {
    const days = pieces.map((p) => p.ukDelivery?.maxDays).filter((d): d is number => typeof d === "number");
    return [
      ...(pieces.some(freeDelivery) ? [{ value: "free", label: "Free" }] : []),
      ...[3, 5].filter((n) => days.some((d) => d <= n)).map((n) => ({ value: String(n), label: `Within ${n} days` })),
    ];
  }
  return [50, 100, 200]
    .filter((n) => pieces.some((p) => p.price <= n) && pieces.some((p) => p.price > n))
    .map((n) => ({ value: String(n), label: `Under ${gbp(n)}` }));
}
// Sort orders. null keys go last, ties keep the shops' order
const SORTS: Record<SortBy, { label: string; key: ((p: Piece) => number | null) | null }> = {
  featured: { label: "Featured", key: null },
  price_low: { label: "Price, low to high", key: (p) => p.price },
  price_high: { label: "Price, high to low", key: (p) => -p.price },
  delivery: { label: "Fastest UK delivery", key: (p) => p.ukDelivery?.maxDays ?? null },
  saving: { label: "Biggest saving", key: (p) => (p.wasPrice && p.wasPrice > p.price ? p.price - p.wasPrice : null) },
  rating: { label: "Top rated", key: (p) => (p.rating ? -p.rating.value : null) },
};

// The page's Sort starts at its by prop until the shopper picks another. No Sort, no sorting
const sortOf = (spec: Spec, facets: Facets) => {
  const el = Object.values(spec.elements).find((e) => e.type === "Sort");
  return el ? ((facets.sort ?? el.props.by) as SortBy) : null;
};

const Render = createContext<Ctx | null>(null);
const SectionSlot = createContext<SlotName | null>(null);
const Layout = createContext<{ size: "small" | "medium" | "large"; list: boolean }>({ size: "medium", list: false });
const useRender = () => useContext(Render)!;

const cardWidth = { small: "11rem", medium: "15rem", large: "21rem" };
const listPhoto = { small: "5rem", medium: "7.5rem", large: "11rem" };
type SizeProp = "small" | "medium" | "large";

// Renders whatever tree Jev composed. Unknown types and missing pieces are skipped, never guessed
function Node({ id }: { id: string }) {
  const { spec } = useRender();
  const el = spec.elements[id];
  const Component = el && registry[el.type];
  return Component ? <Component el={el} /> : null;
}

function Children({ el, ids = kids(el) }: { el: SpecElement; ids?: string[] }) {
  return (
    <>
      {ids.map((k) => (
        <Node key={k} id={k} />
      ))}
    </>
  );
}

function sorted<T>(items: T[], pieceOf: (t: T) => Piece | undefined, by: SortBy | null): T[] {
  const key = SORTS[by ?? "featured"]?.key;
  if (!key) return items;
  const value = (t: T) => {
    const p = pieceOf(t);
    return (p ? key(p) : null) ?? Infinity;
  };
  return [...items].sort((a, b) => value(a) - value(b));
}

// A container's cards in the order the page's Sort asks for
function useSorted(el: SpecElement) {
  const { spec, group, facets } = useRender();
  return sorted(kids(el), (k) => group.pieces[String(spec.elements[k]?.props.id)], sortOf(spec, facets));
}

type Part = (p: { el: SpecElement }) => React.ReactNode;

const registry: Record<string, Part> = {
  Page: ({ el }) => {
    const { compact } = useRender();
    return (
      <div
        className={cn(
          // Filter rows and callouts that follow each other sit close together, the page gap separates sections
          "flex flex-col gap-(--page-gap) [&>[data-filters]+[data-filters]]:mt-[calc(1rem-var(--page-gap))] [&>[data-callout]+[data-callout]]:mt-[calc(0.5rem-var(--page-gap))]",
          compact ? "[--page-gap:2rem]" : "[--page-gap:3.5rem]",
        )}
      >
        <Children el={el} />
      </div>
    );
  },
  Section: ({ el }) => {
    const { spec, group, facets } = useRender();
    const slot = (el.props.slot as SlotName | null) ?? null;
    const title = String(el.props.title ?? (slot ? slotLabel[slot] : "Pieces"));
    const count = (id: string): number => {
      const e = spec.elements[id];
      return e?.type === "ProductCard" ? (shows(group.pieces[String(e.props.id)], facets) ? 1 : 0) : kids(e).reduce((n, k) => n + count(k), 0);
    };
    const items = kids(el).reduce((n, k) => n + count(k), 0);
    // Every section folds from its heading. open false in the spec starts it folded, the key applies a changed spec
    const open = el.props.open !== false;
    return (
      <SectionSlot.Provider value={slot}>
        <Collapsible key={String(open)} defaultOpen={open} asChild>
          <section aria-label={title} className="group/section flex flex-col gap-4">
            <h2 className="border-b border-border pb-2 font-heading text-xl font-bold">
              <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 text-left">
                {title}
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  {items} {items === 1 ? "item" : "items"}
                </span>
                <ChevronDownIcon aria-hidden className="size-5 transition-transform group-data-[state=closed]/section:-rotate-90 motion-reduce:transition-none" />
              </CollapsibleTrigger>
            </h2>
            <CollapsibleContent className="flex flex-col gap-4">
              {items ? <Children el={el} /> : <p className="text-sm text-muted-foreground">Nothing here matches your filters.</p>}
            </CollapsibleContent>
          </section>
        </Collapsible>
      </SectionSlot.Provider>
    );
  },
  Grid: ({ el }) => {
    const size = (el.props.size as SizeProp) ?? "medium";
    return (
      <Layout.Provider value={{ size, list: false }}>
        <div style={{ "--card": cardWidth[size] } as React.CSSProperties} className="grid grid-cols-[repeat(auto-fill,minmax(min(var(--card),100%),1fr))] gap-x-5 gap-y-10">
          <Children el={el} ids={useSorted(el)} />
        </div>
      </Layout.Provider>
    );
  },
  List: ({ el }) => {
    const size = (el.props.size as SizeProp) ?? "medium";
    return (
      <Layout.Provider value={{ size, list: true }}>
        <div style={{ "--photo": listPhoto[size] } as React.CSSProperties} className="flex flex-col gap-4">
          <Children el={el} ids={useSorted(el)} />
        </div>
      </Layout.Provider>
    );
  },
  Carousel: ({ el }) => {
    const size = (el.props.size as SizeProp) ?? "medium";
    const ids = useSorted(el);
    return (
      <Layout.Provider value={{ size, list: false }}>
        {/* The viewport grows by the picked outline so the carousel does not clip it */}
        <Carousel opts={{ align: "start" }} className="w-full [&>[data-slot=carousel-content]]:-m-2 [&>[data-slot=carousel-content]]:p-2">
          <CarouselContent className="-ml-4">
            {ids.map((k) => (
              <CarouselItem key={k} style={{ flexBasis: `min(${cardWidth[size]}, 85%)` }} className="pl-4 empty:hidden has-[[data-photo=failed]]:hidden">
                <Node id={k} />
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* Arrows sit on the section heading line, clear of the cards */}
          <div className="absolute -top-14 right-0 hidden gap-2 @md/sheet:flex">
            <CarouselPrevious className="static size-8 bg-background" />
            <CarouselNext className="static size-8 bg-background" />
          </div>
        </Carousel>
      </Layout.Provider>
    );
  },
  ProductCard: ({ el }) => {
    const { group, spec, facets, onOpen, onPick, onSave } = useRender();
    const slot = useContext(SectionSlot);
    const { list } = useContext(Layout);
    const piece = group.pieces[String(el.props.id)];
    // Items without a photo or outside the shopper's filters are not shown. A card whose photo fails to load hides itself (:has below)
    if (!shows(piece, facets)) return null;
    const picked = slot ? pickFor(spec, group, slot, sortOf(spec, facets)) === piece.id : false;
    // Was price and colours sit by the price, where shops put them
    const byPrice = kids(el).filter((k) => ["WasPrice", "Colours"].includes(spec.elements[k]?.type ?? ""));
    const rest = kids(el).filter((k) => !byPrice.includes(k));
    // A page with a Saved list puts a heart on every photo
    const saved = !!group.saved?.includes(piece.id);
    const facts = (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm text-muted-foreground">{piece.merchant}</span>
        <button type="button" onClick={() => onOpen(piece)} className="cursor-pointer text-left font-heading text-lg leading-snug font-semibold text-balance hover:underline">
          {piece.title}
        </button>
        <Figure value={gbp(piece.price)} className="font-heading text-lg font-bold" />
        {piece.converted && (
          <span className="text-xs text-muted-foreground">
            from {piece.converted.currency} {piece.converted.amount.toFixed(2)}
          </span>
        )}
        <Children el={el} ids={byPrice} />
        {piece.source === "mock" && (
          <Badge variant="outline" className="self-start">
            Sample
          </Badge>
        )}
      </div>
    );
    const parts = (
      <div className="flex flex-col gap-2">
        <Children el={el} ids={rest} />
        {slot && hasOutfitTotal(spec) && (
          <Button variant={picked ? "secondary" : "outline"} disabled={picked} onClick={() => onPick(slot, piece.id)}>
            {picked ? "In your outfit" : "Use in outfit"}
          </Button>
        )}
      </div>
    );
    const photo = (
      <div className="relative">
        <button type="button" onClick={() => onOpen(piece)} aria-label={`Details for ${piece.title}`} className="group w-full cursor-pointer">
          <Photo piece={piece} className="transition-opacity group-hover:opacity-90" />
        </button>
        {hasType(spec, "Saved") && (
          <Button
            variant="outline"
            size="icon"
            aria-pressed={saved}
            aria-label={saved ? `Remove ${piece.title} from saved` : `Save ${piece.title} for later`}
            onClick={() => onSave(piece.id)}
            className="absolute top-2 right-2 rounded-full bg-background/90 hover:bg-background"
          >
            <HeartIcon className={cn(saved && "fill-primary text-primary")} />
          </Button>
        )}
      </div>
    );
    if (list)
      return (
        <article className="grid grid-cols-[var(--photo)_minmax(0,1fr)] gap-4 has-[[data-photo=failed]]:hidden border-b border-border pb-4 @xl/sheet:grid-cols-[var(--photo)_minmax(0,1fr)_14rem]">
          {photo}
          {facts}
          <div className="col-span-2 @xl/sheet:col-span-1">{parts}</div>
        </article>
      );
    return (
      <article className={cn("flex flex-col gap-3 has-[[data-photo=failed]]:hidden", picked && "outline-2 outline-offset-4 outline-primary")}>
        {photo}
        {facts}
        {parts}
      </article>
    );
  },
  SizePicker: ({ el }) => {
    const { group, onSize } = useRender();
    const piece = group.pieces[String(el.props.id)];
    return piece ? <SizeSelect piece={piece} size={group.sizes[piece.id] ?? null} onSize={(s) => onSize(piece.id, s)} /> : null;
  },
  AddToBag: ({ el }) => {
    const { group, onAdd } = useRender();
    const piece = group.pieces[String(el.props.id)];
    if (!piece) return null;
    const size = group.sizes[piece.id] ?? null;
    return <AddButton piece={piece} size={size} onAdd={() => onAdd([{ piece, size }])} className="w-full" />;
  },
  Delivery: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    return piece ? <span className="text-sm">{deliveryLine(piece)}</span> : null;
  },
  Returns: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    return piece ? <span className="text-sm text-muted-foreground">{returnsLine(piece)}</span> : null;
  },
  StockBadge: ({ el }) => {
    const { group } = useRender();
    const piece = group.pieces[String(el.props.id)];
    return piece ? <Stock piece={piece} size={group.sizes[piece.id] ?? null} /> : null;
  },
  OutfitTotal: () => <OutfitTotal />,
  Gallery: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    return piece ? <Gallery piece={piece} compact /> : null;
  },
  Description: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    return piece ? <Description piece={piece} clamp /> : null;
  },
  Rating: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    return piece ? <Rating piece={piece} /> : null;
  },
  WasPrice: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    if (!piece?.wasPrice || piece.wasPrice <= piece.price) return null;
    return (
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="sr-only">Was</span>
        <s className="text-muted-foreground">{gbp(piece.wasPrice)}</s>
        <span className="font-semibold">{Math.round((1 - piece.price / piece.wasPrice) * 100)}% off</span>
      </p>
    );
  },
  Colours: ({ el }) => {
    const colours = useRender().group.pieces[String(el.props.id)]?.colours ?? [];
    if (!colours.length) return null;
    return (
      <p className="text-sm text-muted-foreground">
        Also in <span className="capitalize">{colours.slice(0, 3).join(", ")}</span>
        {colours.length > 3 && ` and ${colours.length - 3} more`}
      </p>
    );
  },
  SizeButtons: ({ el }) => {
    const { group, onSize } = useRender();
    const piece = group.pieces[String(el.props.id)];
    return piece ? <SizeButtons piece={piece} size={group.sizes[piece.id] ?? null} onSize={(s) => onSize(piece.id, s)} compact /> : null;
  },
  SizeGuide: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    return piece ? <SizeGuide piece={piece} /> : null;
  },
  Heading: ({ el }) =>
    el.props.level === "h3" ? (
      <h3 className="font-heading text-xl font-bold">{String(el.props.text ?? "")}</h3>
    ) : (
      <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight text-balance">{String(el.props.text ?? "")}</h2>
    ),
  Text: ({ el }) => <p className={cn("max-w-prose", el.props.tone === "muted" && "text-muted-foreground")}>{String(el.props.text ?? "")}</p>,
  Label: ({ el }) => {
    const piece = useRender().group.pieces[String(el.props.id)];
    const text = labelText[el.props.kind as LabelKind];
    // The delivery line already says free, a second badge would repeat it
    if (el.props.kind === "free_delivery" && piece && freeDelivery(piece)) return null;
    return piece && text ? (
      <Badge variant={el.props.kind === "few_left" ? "secondary" : "outline"} className="self-start">
        {text}
      </Badge>
    ) : null;
  },
  Callout: ({ el }) => (
    // Warnings are facts to check, not errors, so no red
    <Alert role="status" data-callout>
      {el.props.tone === "warning" ? <TriangleAlertIcon /> : <InfoIcon />}
      <AlertDescription>{String(el.props.text ?? "")}</AlertDescription>
    </Alert>
  ),
  Separator: () => <Separator />,
  Stack: ({ el }) => (
    <div className={cn("flex flex-col gap-8", el.props.direction === "horizontal" && "@3xl/sheet:flex-row @3xl/sheet:*:min-w-0 @3xl/sheet:*:flex-1")}>
      <Children el={el} />
    </div>
  ),
  Filters: ({ el }) => {
    const { spec, group, facets, setFacet } = useRender();
    const by = el.props.by as FilterBy;
    const pieces = Object.values(spec.elements)
      .filter((e) => e.type === "ProductCard")
      .map((e) => group.pieces[String(e.props.id)])
      .filter((p): p is Piece => !!p?.image);
    if (!(by in FILTER_TITLE)) return null;
    // Sizes get one row per category, each category sizes its items its own way
    const slots = slotOrder.filter((s) => pieces.some((p) => p.slot === s));
    const rows =
      by === "size"
        ? slots.map((s) => ({
            key: `size_${s}`,
            title: slots.length > 1 ? SIZE_TITLE[s] : "Size",
            options: filterOptions(by, pieces.filter((p) => p.slot === s)),
          }))
        : [{ key: by, title: FILTER_TITLE[by], options: filterOptions(by, pieces) }];
    return rows
      .filter((r) => r.options.length)
      .map((r) => (
        <div key={r.key} data-filters className="flex flex-col gap-2">
          <span className="font-heading text-sm font-semibold">{r.title}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            value={facets[r.key] ?? ""}
            onValueChange={(v) => setFacet(r.key, v || null)}
            aria-label={`Filter by ${r.title.toLowerCase()}`}
            className="flex-wrap justify-start"
          >
            {r.options.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ));
  },
  CompareTable: ({ el }) => {
    const { spec, group, onOpen } = useRender();
    const slot = (el.props.slot as SlotName | null) ?? null;
    const ids = slot ? (sectionCards(spec).find((s) => s.slot === slot)?.ids ?? []) : allCards(spec);
    const pieces = ids.map((id) => group.pieces[id]).filter(Boolean);
    if (!pieces.length) return null;
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-heading font-bold">{slot ? `Compare ${slotLabel[slot].toLowerCase()}` : "Compare"}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Piece</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>UK delivery</TableHead>
              <TableHead>Returns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pieces.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-56 truncate">
                  <button type="button" onClick={() => onOpen(p)} className="cursor-pointer text-left hover:underline">
                    {p.title}
                  </button>
                </TableCell>
                <TableCell>{p.merchant}</TableCell>
                <TableCell className="text-right tabular-nums">{gbp(p.price)}</TableCell>
                <TableCell className="whitespace-normal">{deliveryLine(p).replace(/^UK delivery /, "")}</TableCell>
                <TableCell className="whitespace-normal">{returnsLine(p)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  },
  ShopSummary: () => {
    const { spec, group } = useRender();
    const shops = new Map<string, Piece>();
    for (const id of allCards(spec)) {
      const p = group.pieces[id];
      if (p && !shops.has(p.merchant)) shops.set(p.merchant, p);
    }
    if (!shops.size) return null;
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-heading font-bold">Shops on this page</h3>
        <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {[...shops.values()].map((p) => (
            <div key={p.merchant} className="contents">
              <dt className="font-heading font-semibold">{p.merchant}</dt>
              <dd>
                {deliveryLine(p)}. {returnsLine(p)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  },
  Sort: () => {
    const { spec, group, facets, setFacet } = useRender();
    const pieces = allCards(spec).map((id) => group.pieces[id]).filter(Boolean);
    const by = sortOf(spec, facets) ?? "featured";
    const label = useId();
    // Only orders the items on the page have data for
    const options = (Object.keys(SORTS) as SortBy[]).filter((s) => !SORTS[s].key || s === by || pieces.some((p) => SORTS[s].key!(p) !== null));
    return (
      <div data-filters className="flex items-center gap-3">
        <span id={label} className="font-heading text-sm font-semibold">
          Sort by
        </span>
        <Select value={by} onValueChange={(v) => setFacet("sort", v)}>
          <SelectTrigger aria-labelledby={label} size="sm" className="min-w-44 rounded-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s} value={s}>
                {SORTS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
  TrustBar: () => {
    const { spec, group } = useRender();
    const pieces = allCards(spec).map((id) => group.pieces[id]).filter(Boolean);
    const shops = [...new Map(pieces.map((p) => [p.merchant, p])).values()];
    if (!shops.length) return null;
    const n = shops.length;
    const plural = (k: number) => `${k} ${k === 1 ? "shop" : "shops"}`;
    const free = shops.filter((p) => p.ukDelivery?.price === 0 || p.ukDelivery?.freeOver != null).length;
    const over = shops.map((p) => (p.ukDelivery?.price === 0 ? null : p.ukDelivery?.freeOver)).filter((x): x is number => x != null);
    const days = shops.map((p) => p.returns?.days).filter((x): x is number => x != null);
    const checked = pieces.filter((p) => p.source === "live").map((p) => Date.parse(p.fetchedAt)).filter(Number.isFinite);
    const items = [
      free
        ? {
            icon: TruckIcon,
            title: free === n ? "Free UK delivery at every shop" : `Free UK delivery at ${free} of ${plural(n)}`,
            note: over.length ? `Some over a minimum spend, from ${gbp(Math.min(...over))}` : "On every order",
          }
        : { icon: TruckIcon, title: "UK delivery", note: "Cost and time on every item" },
      days.length
        ? {
            icon: Undo2Icon,
            title: `${Math.min(...days) === Math.max(...days) ? Math.min(...days) : `${Math.min(...days)} to ${Math.max(...days)}`} day returns`,
            note: days.length === n ? "At every shop" : `Unknown at ${plural(n - days.length)}, check there`,
          }
        : { icon: Undo2Icon, title: "Returns unknown", note: "Check each shop's policy" },
      { icon: ShoppingBagIcon, title: `One bag for ${plural(n)}`, note: "Split into one order per shop" },
      ...(checked.length
        ? [
            {
              icon: ClockIcon,
              title: `Prices checked at ${new Date(Math.min(...checked)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
              note: "Live from each shop",
            },
          ]
        : []),
    ];
    return (
      <ul aria-label="Shopping with Fluid" className="grid grid-cols-1 gap-x-6 gap-y-4 border-y border-border py-4 @md/sheet:grid-cols-2 @4xl/sheet:grid-cols-4">
        {items.map(({ icon: Icon, title, note }) => (
          <li key={title} className="flex gap-3">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span className="flex flex-col">
              <span className="font-heading font-semibold">{title}</span>
              <span className="text-sm text-muted-foreground">{note}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  },
  DeliveryProgress: () => {
    const { spec, group, bag } = useRender();
    const pieces = allCards(spec).map((id) => group.pieces[id]).filter(Boolean);
    // Shops with a spend threshold for free UK delivery, from the shop's own policy
    const shops = [...new Map(pieces.filter((p) => p.ukDelivery?.freeOver != null && p.ukDelivery.price !== 0).map((p) => [p.merchant, p.ukDelivery!.freeOver!])).entries()];
    if (!shops.length) return null;
    const spent = (m: string) => bag.filter((l) => l.piece.merchant === m).reduce((sum, l) => sum + l.piece.price, 0);
    const inBag = shops.filter(([m]) => spent(m) > 0);
    const rest = shops.filter(([m]) => !spent(m));
    return (
      <div className="flex flex-col gap-3">
        <h3 className="font-heading font-bold">Free UK delivery</h3>
        {inBag.map(([m, over]) => {
          const left = Math.round((over - spent(m)) * 100) / 100;
          return (
            <div key={m} className="flex flex-col gap-1.5 text-sm">
              <p>{left > 0 ? `Spend ${gbp(left)} more at ${m} for free UK delivery` : `Free UK delivery at ${m}`}</p>
              <Progress value={Math.min(100, (spent(m) / over) * 100)} aria-label={`${m}, ${gbp(spent(m))} of ${gbp(over)}`} />
            </div>
          );
        })}
        {rest.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {inBag.length ? "Also free" : "Free"} over {rest.slice(0, 4).map(([m, over]) => `${gbp(over)} at ${m}`).join(", ")}
            {rest.length > 4 && ` and ${rest.length - 4} more shops`}.{!inBag.length && " Add pieces to your bag to see how close you are."}
          </p>
        )}
      </div>
    );
  },
  Saved: () => {
    const { group, onOpen } = useRender();
    const saved = (group.saved ?? []).map((id) => group.pieces[id]).filter(Boolean);
    return (
      <section aria-label="Saved for later" className="flex flex-col gap-3">
        <h3 className="font-heading font-bold">
          Saved for later <span className="font-sans text-sm font-normal text-muted-foreground">{saved.length}</span>
        </h3>
        {saved.length ? (
          <ul className="flex gap-4 overflow-x-auto pb-1">
            {saved.map((p) => (
              <li key={p.id} className="w-28 shrink-0">
                <button type="button" onClick={() => onOpen(p)} className="flex w-full cursor-pointer flex-col gap-1 text-left">
                  <Photo piece={p} />
                  <span className="line-clamp-2 text-sm leading-snug">{p.title}</span>
                  <span className="text-sm font-semibold">{gbp(p.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Tap the heart on an item to keep it here.</p>
        )}
      </section>
    );
  },
};

const labelText: Record<LabelKind, string> = {
  cheapest: "Cheapest",
  fastest: "Fastest delivery",
  free_delivery: "Free UK delivery",
  few_left: "Few left",
  long_returns: "Easy returns",
  sale: "Sale",
};

const allCards = (spec: Spec) =>
  Object.values(spec.elements)
    .filter((e) => e.type === "ProductCard")
    .map((e) => String(e.props.id));

const hasType = (spec: Spec, type: string) => Object.values(spec.elements).some((e) => e.type === type);
const hasOutfitTotal = (spec: Spec) => hasType(spec, "OutfitTotal");

// Cards under each category section, in order, reaching through containers
function sectionCards(spec: Spec) {
  const out: { slot: SlotName; ids: string[] }[] = [];
  for (const id of kids(spec.elements[spec.root])) {
    const el = spec.elements[id];
    if (el?.type !== "Section" || !el.props.slot) continue;
    const ids: string[] = [];
    const walk = (k: string) => {
      const e = spec.elements[k];
      if (!e) return;
      if (e.type === "ProductCard") ids.push(String(e.props.id));
      else kids(e).forEach(walk);
    };
    kids(el).forEach(walk);
    out.push({ slot: el.props.slot as SlotName, ids });
  }
  return out;
}

// The shopper's pick for a category, else the first piece shown
function pickFor(spec: Spec, group: Group, slot: SlotName, by: SortBy | null) {
  const ids = sorted(sectionCards(spec).find((s) => s.slot === slot)?.ids ?? [], (id) => group.pieces[id], by);
  const chosen = group.picks[slot];
  return chosen && ids.includes(chosen) ? chosen : ids[0];
}

// The piece picked in each category, in page order
// The piece picked in each category, the default pick follows the page's sort order
const outfitPieces = (spec: Spec, group: Group, by: SortBy | null) =>
  sectionCards(spec).map(({ slot }) => group.pieces[pickFor(spec, group, slot, by) ?? ""]).filter(Boolean);

function OutfitTotal() {
  const { spec, group, facets, onAdd } = useRender();
  const [error, setError] = useState("");
  const lines = outfitPieces(spec, group, sortOf(spec, facets)).map((piece) => ({ piece, size: group.sizes[piece.id] ?? null }));
  if (!lines.length) return null;
  const shops = byMerchant(lines);
  const pieceTotal = shops.reduce((sum, s) => sum + s.subtotal, 0);
  const delivery = shops.reduce((sum, s) => sum + (s.delivery ?? 0), 0);
  const unknown = shops.filter((s) => s.delivery === null).map((s) => s.merchant);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-border bg-background px-5 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Outfit total</span>
          <Figure value={gbp(pieceTotal + delivery)} className="font-heading text-2xl font-bold" />
        </p>
        <p aria-live="polite" className={cn("text-sm", error ? "font-semibold" : "text-muted-foreground")}>
          {error ||
            `${lines.length} pieces, ${shops.length} ${shops.length === 1 ? "shop" : "shops"}. ${delivery ? `Includes ${gbp(delivery)} UK delivery` : unknown.length ? "UK delivery not included" : "Free UK delivery"}${unknown.length ? `, unknown at ${unknown.join(", ")}` : ""}`}
        </p>
      </div>
      <Button
        size="lg"
        onClick={() => {
          const missing = lines.find((l) => l.piece.sizes.length > 1 && !l.size);
          if (missing) return setError(`Choose a size for ${missing.piece.title}`);
          setError("");
          onAdd(lines);
        }}
      >
        Add outfit to bag
      </Button>
    </div>
  );
}

// One shopping group: the request, what Fluid did, then the UI tree Jev composed
export function GroupView({
  group,
  composing,
  filters,
  composer,
  onTheme,
  outfitImage,
  onOutfitImage,
  ...actions
}: {
  group: Group;
  composing: boolean;
  filters: Filter[];
  composer: React.ReactNode;
  onTheme: (t: ThemeName) => void;
  outfitImage: OutfitImage | null;
  onOutfitImage: (image: OutfitImage) => void;
} & GroupActions) {
  const spec = group.spec;
  const root = spec?.elements[spec.root];
  const cards = Object.values(spec?.elements ?? {}).filter((e) => e.type === "ProductCard");
  const [facets, setFacets] = useState<Facets>({});
  useEffect(() => setFacets({}), [group.id]);
  const setFacet = (key: string, value: string | null) => setFacets((f) => ({ ...f, [key]: value ?? undefined }));
  // Made up sample shops are not counted as UK shops
  const shown = cards.map((e) => group.pieces[String(e.props.id)]).filter((p): p is Piece => !!p);
  const shops = new Set(shown.filter((p) => p.source === "live").map((p) => p.merchant)).size;
  const samples = shown.some((p) => p.source === "mock");
  const last = group.entries[group.entries.length - 1];
  const theme = pageTheme(spec);
  useEffect(() => onTheme(theme), [theme, onTheme]);

  return (
    <div className="@container/sheet relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[clamp(1rem,4cqi,3rem)] pt-6 pb-12">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{kindLabel(group)}</Badge>
              {cards.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {cards.length} {cards.length === 1 ? "piece" : "pieces"}
                  {shops ? ` from ${shops} UK ${shops === 1 ? "shop" : "shops"}` : ""}
                  {samples ? (shops ? ", plus samples" : ", all samples") : ""}
                </span>
              )}
            </div>
            <h1 className="font-heading text-[clamp(2rem,5cqi,3.25rem)] leading-[1.02] font-bold tracking-tight text-balance first-letter:uppercase">
              {String(root?.props.title ?? "") || group.entries[0]?.prompt}
            </h1>
            {filters.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Applied filters">
                {filters.map((f) => (
                  <li key={f.key}>
                    <Button variant="outline" size="sm" className="rounded-full border-border" disabled={composing} onClick={() => actions.onRemoveFilter(f.key)} aria-label={`Remove ${f.label}`}>
                      {f.label}
                      <XIcon data-icon="inline-end" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {spec && groupKind(group) === "look" && (
              <OutfitPicture spec={spec} group={group} by={sortOf(spec, facets)} image={outfitImage} composing={composing} onImage={onOutfitImage} onOpen={actions.onOpen} />
            )}
            <Activity group={group} composing={composing} key={last?.prompt} />
          </header>

          {spec && root ? (
            <Render.Provider value={{ spec, group, compact: root.props.density === "compact", facets, setFacet, ...actions }}>
              <Node id={spec.root} />
            </Render.Provider>
          ) : (
            <Loading composing={composing} error={last?.status === "error"} />
          )}
        </div>
      </div>
      {/* A solid band under the page, not a floating bar, so it never covers a size picker or Add to bag */}
      <div className="flex shrink-0 justify-center border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-2xl">{composer}</div>
      </div>
    </div>
  );
}

// A shop the look picture of the picked outfit, made from the pieces' product photos when the shopper asks.
// Each piece gets a tag on the photo that opens its details. The picture remembers which pieces it shows,
// so a changed outfit keeps the old picture and offers a new one
function OutfitPicture({
  spec,
  group,
  by,
  image,
  composing,
  onImage,
  onOpen,
}: {
  spec: Spec;
  group: Group;
  by: SortBy | null;
  image: OutfitImage | null;
  composing: boolean;
  onImage: (image: OutfitImage) => void;
  onOpen: (piece: Piece) => void;
}) {
  const supabase = useSupabase();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const pieces = outfitPieces(spec, group, by);
  if (!pieces.length) return null;
  const key = pieces.map((p) => p.id).join("|");
  const changed = !!image && image.key !== key;
  const make = async () => {
    setState("working");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      const { src, spots } = await outfitImage(token, pieces, group.intent?.gender ?? null);
      const id = (slot: SlotName) => pieces.find((p) => p.slot === slot)?.id ?? "";
      onImage({ src, key, spots: spots.map((s) => ({ id: id(s.slot), x: s.x, y: s.y })).filter((s) => s.id) });
      setState("idle");
    } catch (err) {
      console.error(err);
      setState("error");
    }
  };
  const working = state === "working";

  if (!image && state === "idle")
    return (
      <Button variant="outline" className="self-start" disabled={composing} onClick={make}>
        <SparklesIcon data-icon="inline-start" />
        See this outfit
      </Button>
    );
  return (
    <figure className="flex flex-col gap-3 @xl/sheet:flex-row @xl/sheet:items-end">
      <div className="relative aspect-[3/4] w-full max-w-md bg-muted" aria-busy={working}>
        {working ? (
          <>
            <Skeleton className="absolute inset-0 rounded-none" />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Spinner />
              Picturing your outfit, this takes about half a minute
            </span>
          </>
        ) : image ? (
          <>
            <img src={image.src} alt="AI image of your outfit" className="absolute inset-0 size-full object-cover" />
            <p className="absolute top-3 left-3 max-w-[60%] text-xs text-photo-ink">AI image of your outfit. Real pieces may differ slightly.</p>
            {image.spots.map((s, i) => {
              const piece = group.pieces[s.id];
              if (!piece) return null;
              // Tags alternate sides so they sit beside their piece, unless that side has no room
              const left = i % 2 === 0 ? s.x > 0.4 : s.x > 0.6;
              return (
                <div
                  key={s.id}
                  style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
                  className={cn("absolute flex -translate-y-1/2 items-center", left ? "-translate-x-[calc(100%-0.4375rem)] flex-row-reverse" : "-translate-x-[0.4375rem]")}
                >
                  <span aria-hidden className="size-3.5 shrink-0 rounded-full border-2 border-photo-tag-foreground shadow-sm" />
                  <span aria-hidden className="h-px w-5 bg-photo-tag-foreground shadow-sm @md/sheet:w-8" />
                  <button
                    type="button"
                    onClick={() => onOpen(piece)}
                    className="flex w-32 cursor-pointer flex-col gap-0.5 bg-photo-tag px-2.5 py-2 text-left text-photo-tag-foreground transition-opacity hover:opacity-85 @md/sheet:w-40"
                  >
                    <span className="truncate text-[0.625rem] font-medium tracking-[0.14em] uppercase opacity-70">{piece.merchant}</span>
                    <span className="line-clamp-2 text-xs leading-snug">{piece.title}</span>
                    <span className="font-numeral text-2xl leading-none font-bold">{gbp(piece.price)}</span>
                  </button>
                </div>
              );
            })}
          </>
        ) : (
          <span className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">No picture yet</span>
        )}
      </div>
      <figcaption aria-live="polite" className="flex max-w-xs flex-col items-start gap-2 text-sm">
        {state === "error" && <span className="font-semibold">Could not picture this outfit. Try again in a moment.</span>}
        {changed && !working && state !== "error" && <span className="font-semibold">Your outfit changed since this picture.</span>}
        {!working && (
          <Button variant={changed || state === "error" ? "default" : "outline"} size="sm" disabled={composing} onClick={make}>
            <SparklesIcon data-icon="inline-start" />
            {state === "error" ? "Try again" : "Regenerate"}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}

// What Fluid did for this group, one entry per prompt. Open while working, tucked away after
function Activity({ group, composing }: { group: Group; composing: boolean }) {
  const [open, setOpen] = useState(false);
  const last = group.entries[group.entries.length - 1];
  const working = composing && last?.status === "composing";
  return (
    <Collapsible open={open || working} onOpenChange={setOpen} className="flex flex-col gap-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="self-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
          {working ? <Spinner data-icon="inline-start" /> : null}
          {working ? (last.notes[last.notes.length - 1] ?? "Working") : `How Fluid built this, ${group.entries.length} ${group.entries.length === 1 ? "request" : "requests"}`}
          <ChevronDownIcon data-icon="inline-end" className={cn("transition-transform", (open || working) && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-4 border-l border-border pl-4">
          {group.entries.map((e, i) => (
            <li key={i} className="flex flex-col gap-1">
              <span className="font-heading font-semibold">{e.prompt}</span>
              {e.notes.map((n, j) => (
                <Marker key={j} className="animate-in fade-in duration-200 motion-reduce:animate-none">
                  <MarkerContent>{n}</MarkerContent>
                </Marker>
              ))}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Loading({ composing, error }: { composing: boolean; error: boolean }) {
  if (!composing)
    return (
      <Empty className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyTitle className="font-heading">{error ? "That did not work" : "Nothing to show yet"}</EmptyTitle>
          <EmptyDescription>{error ? "Try again, or ask for something a little broader." : "Ask for something below and Fluid will fill this in."}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-5 gap-y-8" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-[4/5] rounded-none" />
          <Skeleton className="h-4 w-1/3 rounded-none" />
          <Skeleton className="h-5 w-4/5 rounded-none" />
          <Skeleton className="h-10 rounded-none" />
        </div>
      ))}
    </div>
  );
}
