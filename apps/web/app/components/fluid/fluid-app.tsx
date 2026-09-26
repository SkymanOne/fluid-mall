import type { Session } from "@supabase/supabase-js";
import { ShoppingBagIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Sheet as Panel, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import { compose } from "~/lib/agent";
import { fromTemplate, toTemplate } from "~/lib/template";
import { gbp, sizeFor } from "~/lib/format";
import { loadGroups, loadJson, loadPrefs, loadStorefronts, storeGroups, storeJson, storePrefs, storeStorefronts, type Group, type OutfitImage, type Prefs, type Storefront } from "~/lib/store";
import { useSupabase } from "~/lib/supabase";
import type { ComposeEvent, Intent, Piece, Spec, ThemeName } from "~/lib/types";
import { Bags, type BagLine, type Order } from "./bag";
import { Home } from "./home";
import { AppSidebar, Composer, StorefrontPanel } from "./panels";
import { PieceDetail } from "./piece";
import { GroupView, kindLabel, type Filter } from "./sheet";

// Buyer themes are class names on <html> that swap the shadcn tokens in app.css
function applyTheme(theme: ThemeName) {
  const html = document.documentElement.classList;
  html.toggle("dark", theme === "backstage");
  html.toggle("theme-backstage", theme === "backstage");
  html.toggle("theme-showroom", theme === "showroom");
}

const blank = (number: number, prompt: string): Group => ({
  id: `${Date.now()}-${number}`,
  number,
  name: prompt,
  entries: [],
  intent: null,
  spec: null,
  pieces: {},
  picks: {},
  sizes: {},
});

// Keeps sizes the shopper picked and picks the wanted size on items that have it in stock
const prefill = (sizes: Record<string, string>, pieces: Piece[], want: string | null) => {
  const next = { ...sizes };
  for (const p of pieces) {
    const label = sizeFor(p, want);
    if (label && !next[p.id]) next[p.id] = label;
  }
  return next;
};

const cardIds = (spec: Spec | null) =>
  Object.values(spec?.elements ?? {})
    // Piece: the card type of pages saved before the current catalog, so their items carry over when rebuilt
    .filter((e) => e.type === "ProductCard" || e.type === "Piece")
    .map((e) => String(e.props.id));

// Reads a group's look off its spec, so it can be saved and reused without its items
function describeLook(name: string, g: Group) {
  const spec = g.spec;
  if (!spec) return name;
  const els = Object.values(spec.elements);
  const root = spec.elements[spec.root];
  const containers = [...new Set(els.filter((e) => ["Grid", "Carousel", "List"].includes(e.type)).map((e) => `${e.props.size ?? "medium"} ${e.type.toLowerCase()}`))];
  const parts = [...new Set(els.filter((e) => ["SizePicker", "AddToBag", "Delivery", "Returns", "StockBadge"].includes(e.type)).map((e) => e.type))];
  return `${name}: ${root?.props.theme ?? "studio"} theme, ${root?.props.density ?? "roomy"} spacing, items in ${containers.join(" and ") || "a grid"}, each item shows ${parts.join(", ") || "only photo, name and price"}${els.some((e) => e.type === "OutfitTotal") ? ", outfit total at the end" : ""}. Made for "${g.entries[0]?.prompt ?? g.name}"`;
}

const sidebarOpen = () => typeof document === "undefined" || !document.cookie.includes("sidebar_state=false");

const without = <T,>(record: Record<string, T>, key: string) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

export function FluidApp(props: { session: Session; composeUrl: string; apiKey: string }) {
  return (
    <SidebarProvider defaultOpen={sidebarOpen()} style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <Shell {...props} />
    </SidebarProvider>
  );
}

// Each prompt is an intent: the agent searches or updates items, Jev composes or refines the UI.
// Groups hold what the shopper asked for, each with its own bag
function Shell({ session, composeUrl, apiKey }: { session: Session; composeUrl: string; apiKey: string }) {
  const supabase = useSupabase();
  const sidebar = useSidebar();
  const user = session.user.id;

  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(user));
  const [storefronts, setStorefronts] = useState<Storefront[]>(() => loadStorefronts(user));
  const [groups, setGroups] = useState<Group[]>(() => loadGroups(user));
  // The open group survives a reload, so a shopper coming back lands where they left
  const [activeId, setActiveId] = useState<string | null>(() => loadJson<string | null>(user, "active", null));
  const [composing, setComposing] = useState(false);
  const [bags, setBags] = useState<Record<string, BagLine[]>>(() => loadJson(user, "bags", {}));
  const [orders, setOrders] = useState<Record<string, Order[]>>(() => loadJson(user, "orders", {}));
  // Kept apart from groups so a picture that lands while the agent works on the group is not overwritten.
  // ponytail: 768px JPEG data URLs in localStorage, about 40 KB each. Move to private Storage when groups move to Supabase
  const [outfits, setOutfits] = useState<Record<string, OutfitImage>>(() => loadJson(user, "outfits", {}));
  const [panel, setPanel] = useState<{ kind: "bag" } | { kind: "piece"; piece: Piece } | { kind: "customise" } | null>(null);
  const [lookName, setLookName] = useState<Record<string, string>>({});
  const counter = useRef(Math.max(0, ...groups.map((g) => g.number)));

  const front = groups.find((g) => g.id === activeId) ?? null;
  const totalInBags = Object.values(bags).reduce((n, b) => n + b.length, 0);
  const onTheme = useCallback((t: ThemeName) => applyTheme(t), []);

  useEffect(() => {
    if (!front) applyTheme("studio");
  }, [front]);
  useEffect(() => storePrefs(user, prefs), [user, prefs]);
  useEffect(() => storeJson(user, "bags", bags), [user, bags]);
  useEffect(() => storeJson(user, "orders", orders), [user, orders]);
  useEffect(() => storeJson(user, "active", activeId), [user, activeId]);
  useEffect(() => storeJson(user, "outfits", outfits), [user, outfits]);
  useEffect(() => {
    if (!composing) storeGroups(user, groups);
  }, [user, groups, composing]);

  const put = (group: Group) => setGroups((gs) => (gs.some((g) => g.id === group.id) ? gs.map((g) => (g.id === group.id ? group : g)) : [group, ...gs]));
  const patchActive = (fn: (g: Group) => Group) => setGroups((gs) => gs.map((g) => (g.id === activeId ? fn(g) : g)));

  async function run(prompt: string, override?: Partial<Intent>) {
    const previous = front;
    const shown = new Set(cardIds(previous?.spec ?? null));
    const request = {
      prompt,
      history: previous ? previous.entries.map((e) => e.prompt) : [],
      previousIntent: previous?.intent && override ? { ...previous.intent, ...override } : (previous?.intent ?? null),
      storefronts: storefronts.map((s) => ({ id: s.id, description: s.description })),
      // The current tree and its pieces, so Jev edits this UI instead of starting over
      spec: previous?.spec ?? null,
      // A page that lost its cards sends every item, so the agent can rebuild it
      pieces: previous ? Object.values(previous.pieces).filter((p) => !shown.size || shown.has(p.id)) : [],
      // New searches load into the chosen saved storefront
      template: storefronts.find((s) => s.id === prefs.storefront)?.template ?? null,
    };
    const entry = { prompt, notes: [] as string[], status: "composing" as const };
    let current: Group = previous ?? blank(++counter.current, prompt);
    current = { ...current, entries: [...current.entries, entry] };
    const update = (fn: (g: Group) => Group) => {
      current = fn(current);
      put(current);
    };
    const patchEntry = (fn: (e: Group["entries"][number]) => Group["entries"][number]) =>
      update((g) => ({ ...g, entries: g.entries.map((e, i) => (i === g.entries.length - 1 ? fn(e) : e)) }));

    put(current);
    setActiveId(current.id);
    setComposing(true);
    if (sidebar.isMobile) sidebar.setOpenMobile(false);

    // The size to pick on each item, from this request's size filter or the shopper's saved size
    let want = request.previousIntent?.size ?? prefs.size;
    const onEvent = (event: ComposeEvent) => {
      if (event.type === "note") patchEntry((e) => ({ ...e, notes: [...e.notes, event.text] }));
      if (event.type === "intent") {
        // A new shopping intent is its own group. The previous group stays as it was
        if (previous && !event.refining) {
          put(previous);
          current = { ...blank(++counter.current, prompt), entries: [current.entries[current.entries.length - 1]] };
          put(current);
          setActiveId(current.id);
        }
        update((g) => ({ ...g, intent: event.intent }));
        const reused = storefronts.find((s) => s.id === event.storefront);
        if (reused) patchEntry((e) => ({ ...e, notes: [...e.notes, `Reusing your ${reused.name} storefront`] }));
        if (event.intent.size) setPrefs((p) => ({ ...p, size: event.intent.size }));
        // A size filter picks that size on every item that has it in stock
        want = event.intent.size ?? prefs.size;
        update((g) => ({ ...g, sizes: prefill(g.sizes, Object.values(g.pieces), want) }));
      }
      if (event.type === "pieces")
        update((g) => ({ ...g, sizes: prefill(g.sizes, event.pieces, want), pieces: { ...g.pieces, ...Object.fromEntries(event.pieces.map((p) => [p.id, p])) } }));
      if (event.type === "spec") update((g) => ({ ...g, spec: event.spec }));
      if (event.type === "error") patchEntry((e) => ({ ...e, status: "error", notes: [...e.notes, event.message] }));
    };

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? "";
      await compose(composeUrl, token, apiKey, request, onEvent);
      patchEntry((e) => ({ ...e, status: e.status === "error" ? "error" : "done" }));
    } catch (err) {
      patchEntry((e) => ({ ...e, status: "error", notes: [...e.notes, `Could not finish. ${err instanceof Error ? err.message : "Network error"}. Try again.`] }));
    }
    setComposing(false);
  }

  const filters: Filter[] = [];
  const intent = front?.intent;
  if (intent?.colour) filters.push({ key: "colour", label: `${intent.colour[0].toUpperCase()}${intent.colour.slice(1)} only` });
  if (intent?.size) filters.push({ key: "size", label: `Size ${intent.size}` });
  if (intent?.budget) filters.push({ key: "budget", label: `Under ${gbp(intent.budget)}` });
  if (intent?.gender) filters.push({ key: "gender", label: intent.gender === "men" ? "Menswear" : "Womenswear" });

  const removeFilter = (key: string) => {
    const label = filters.find((s) => s.key === key)?.label ?? key;
    if (key === "size") setPrefs((p) => ({ ...p, size: null }));
    run(`Drop the filter: ${label.toLowerCase()}`, { [key]: null });
  };

  const saveStorefronts = (next: Storefront[]) => {
    setStorefronts(next);
    storeStorefronts(user, next);
  };

  const saveStorefront = (name: string) => {
    if (!front) return;
    if (!front.spec) return;
    const saved = { id: `sf-${Date.now()}`, name, description: describeLook(name, front), savedAt: new Date().toISOString(), template: toTemplate(front.spec) };
    saveStorefronts([saved, ...storefronts.filter((s) => s.name !== name)]);
    setLookName((n) => ({ ...n, [front.id]: name }));
  };

  // Loads the open group's pieces into the saved storefront. No request, the items stay the same
  const applyStorefront = (s: Storefront) => {
    if (!front) return;
    const shown = new Set(cardIds(front.spec));
    const pieces = Object.values(front.pieces).filter((p) => shown.has(p.id));
    const title = String(front.spec?.elements[front.spec.root]?.props.title ?? front.name);
    patchActive((g) => ({
      ...g,
      spec: fromTemplate(s.template, pieces, title),
      picks: {},
      entries: [...g.entries, { prompt: `Use the ${s.name} storefront`, notes: [`Loaded ${pieces.length} pieces into your ${s.name} storefront`], status: "done" }],
    }));
    setLookName((n) => ({ ...n, [front.id]: s.name }));
    setPanel(null);
  };

  const removeStorefront = (s: Storefront) => {
    saveStorefronts(storefronts.filter((x) => x.id !== s.id));
    if (prefs.storefront === s.id) setPrefs((p) => ({ ...p, storefront: null }));
  };

  // Removing a group takes its bag, orders and outfit picture with it
  const removeGroup = (g: Group) => {
    setGroups((gs) => gs.filter((x) => x.id !== g.id));
    setBags((b) => without(b, g.id));
    setOrders((o) => without(o, g.id));
    setOutfits((o) => without(o, g.id));
    if (activeId === g.id) setActiveId(null);
  };

  const addToBag = (lines: BagLine[]) => {
    if (!front) return;
    setBags((b) => ({ ...b, [front.id]: [...(b[front.id] ?? []), ...lines] }));
  };

  const openGroups = () => (sidebar.isMobile ? sidebar.setOpenMobile(true) : sidebar.setOpen(true));
  const withBags = groups.filter((g) => bags[g.id]?.length || orders[g.id]?.length);
  const bagOrder = front ? [front, ...withBags.filter((g) => g.id !== front.id)] : withBags;
  const frontBag = front ? (bags[front.id]?.length ?? 0) : totalInBags;

  return (
    <>
      <AppSidebar
        groups={groups}
        activeId={activeId}
        bagCount={(id) => bags[id]?.length ?? 0}
        storefront={front ? (lookName[front.id] ?? null) : null}
        email={session.user.email ?? ""}
        onOpenGroup={(g) => {
          setActiveId(g.id);
          if (sidebar.isMobile) sidebar.setOpenMobile(false);
        }}
        onRemoveGroup={removeGroup}
        onNew={() => {
          setActiveId(null);
          if (sidebar.isMobile) sidebar.setOpenMobile(false);
        }}
        onCustomise={() => setPanel({ kind: "customise" })}
        onSignOut={() => supabase.auth.signOut()}
      />
      <SidebarInset className="h-dvh min-h-0">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <SidebarTrigger aria-label="Show or hide the side panel" />
          {(!sidebar.open || sidebar.isMobile) && (
            <button type="button" onClick={() => setActiveId(null)} className="cursor-pointer font-numeral text-2xl leading-none font-extrabold tracking-tight">
              Fluid
            </button>
          )}
          {front && (
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {kindLabel(front)}: {front.name}
            </span>
          )}
          <span className="flex-1" />
          <Button variant={frontBag ? "default" : "outline"} onClick={() => setPanel({ kind: "bag" })}>
            <ShoppingBagIcon data-icon="inline-start" />
            Bag{frontBag ? ` (${frontBag})` : ""}
          </Button>
        </header>

        {front ? (
          <GroupView
            key={front.id}
            group={front}
            composing={composing}
            filters={filters}
            onTheme={onTheme}
            onPick={(slot, id) => patchActive((g) => ({ ...g, picks: { ...g.picks, [slot]: id } }))}
            onSize={(id, size) => patchActive((g) => ({ ...g, sizes: { ...g.sizes, [id]: size } }))}
            onAdd={addToBag}
            onOpen={(piece) => setPanel({ kind: "piece", piece })}
            onRemoveFilter={removeFilter}
            outfitImage={outfits[front.id] ?? null}
            onOutfitImage={(image) => setOutfits((o) => ({ ...o, [front.id]: image }))}
            composer={<Composer placeholder="Refine it: sneakers for shoes, carousel, add buy buttons" composing={composing} onPrompt={(p) => run(p)} />}
          />
        ) : (
          <Home
            composing={composing}
            groupCount={groups.length}
            bagCount={totalInBags}
            onPrompt={(p) => run(p)}
            onGroups={openGroups}
            onBags={() => setPanel({ kind: "bag" })}
          />
        )}
      </SidebarInset>

      <Panel open={!!panel} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader>
            <SheetTitle className="font-heading text-2xl font-bold">
              {panel?.kind === "piece" ? "Details" : panel?.kind === "customise" ? "Storefronts" : "Your bags"}
            </SheetTitle>
            <SheetDescription>
              {panel?.kind === "piece" ? panel.piece.merchant : panel?.kind === "customise" ? "Save how a group looks and reuse it" : "One bag per group, each split per shop at checkout"}
            </SheetDescription>
          </SheetHeader>
          {panel?.kind === "bag" && (
            <Bags
              groups={bagOrder.map((g) => ({ id: g.id, label: `${kindLabel(g)}: ${g.name}` }))}
              bags={bags}
              orders={orders}
              onRemove={(id, i) => setBags((b) => ({ ...b, [id]: (b[id] ?? []).filter((_, j) => j !== i) }))}
              onClear={(id) => {
                setBags((b) => without(b, id));
                setOrders((o) => without(o, id));
              }}
              onPlace={(id, placed) => {
                setOrders((o) => ({ ...o, [id]: [...placed, ...(o[id] ?? [])] }));
                setBags((b) => ({ ...b, [id]: [] }));
              }}
            />
          )}
          {panel?.kind === "piece" && (
            <PieceDetail
              piece={panel.piece}
              size={front?.sizes[panel.piece.id] ?? null}
              onSize={(size) => patchActive((g) => ({ ...g, sizes: { ...g.sizes, [panel.piece.id]: size } }))}
              onAdd={() => addToBag([{ piece: panel.piece, size: front?.sizes[panel.piece.id] ?? null }])}
            />
          )}
          {panel?.kind === "customise" && (
            <StorefrontPanel
              current={front ? (lookName[front.id] ?? null) : null}
              storefronts={storefronts}
              canSave={!!front?.spec && !composing}
              forSearches={prefs.storefront}
              onSave={saveStorefront}
              onApply={applyStorefront}
              onChoose={(id) => setPrefs((p) => ({ ...p, storefront: id }))}
              onRemove={removeStorefront}
            />
          )}
        </SheetContent>
      </Panel>
    </>
  );
}
