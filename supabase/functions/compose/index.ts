// compose Edge Function. Turns a shopper's prompt into pieces and a storefront spec, streamed as NDJSON.
// Each prompt runs the steps it needs: the agent searches items, Jev composes the UI, code swaps items, Jev edits the UI.

import { COLOURS, defaultQuery, fallbackPlan, fitsSize, makePlan, type Plan, SLOTS, specSlots } from "./agent.ts";
import { within } from "./ai.ts";
import { coloursIn, liveSearch } from "./live.ts";
import { mockPieces } from "./mock.ts";
import type { ComposeEvent, ComposeRequest, Intent, Piece, SlotName, Spec, SpecElement } from "./types.ts";
import { fromTemplate } from "./template.ts";
import { bind, checkSpec, composeUI, inOrder, LABEL, refineUI, type Setup } from "./ui.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const LIVE_BUDGET_MS = 15000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply(405, "Use POST");
  if (!(await authorised(req))) return reply(401, "Unauthorized");

  const body = parseRequest(await req.json().catch(() => null));
  if (!body) return reply(400, "Expected { prompt, history, previousIntent, storefronts, spec, pieces }");

  // Aborts the pipeline when the client goes away
  const abort = new AbortController();
  const stream = new ReadableStream({
    cancel: () => abort.abort(),
    async start(controller) {
      const send = (e: ComposeEvent) => {
        try {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(e) + "\n"));
        } catch {
          // Client went away
        }
      };
      try {
        await run(body, send, abort.signal);
      } catch (err) {
        console.error(err);
        send({ type: "error", message: "Something went wrong composing your storefront" });
      }
      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  });
  return new Response(stream, { headers: { ...CORS, "content-type": "application/x-ndjson", "cache-control": "no-store" } });
});

function reply(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { ...CORS, "content-type": "application/json" } });
}

async function authorised(req: Request): Promise<boolean> {
  // Only `just compose-dev` passes --local, so a secret alone cannot switch auth off
  if (Deno.env.get("COMPOSE_DEV_SKIP_AUTH") === "1" && Deno.args.includes("--local")) return true;
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  await res?.body?.cancel();
  return res?.ok ?? false;
}

// Trust boundary: only known shapes get through. Jev validates the spec tree against the catalog again
function parseRequest(raw: unknown): ComposeRequest | null {
  const r = raw as Partial<ComposeRequest> | null;
  if (typeof r?.prompt !== "string" || !r.prompt.trim()) return null;
  const history = Array.isArray(r.history) ? r.history.filter((h) => typeof h === "string").slice(-10) : [];
  const p = r.previousIntent;
  const previousIntent: Intent | null = p && typeof p === "object"
    ? {
      layout: p.layout === "lineup" ? "lineup" : "look",
      slots: Array.isArray(p.slots) && p.slots.every((s) => SLOTS.includes(s)) && p.slots.length ? p.slots : ["top", "bottom", "shoes"],
      colour: COLOURS.includes(p.colour as string) ? p.colour : null,
      size: typeof p.size === "string" ? p.size.slice(0, 20) : null,
      budget: typeof p.budget === "number" && p.budget > 0 ? p.budget : null,
      gender: p.gender === "men" || p.gender === "women" ? p.gender : null,
      sort: "relevance",
      theme: null,
      density: null,
    }
    : null;
  const storefronts = Array.isArray(r.storefronts)
    ? r.storefronts
      .filter((s) => typeof s?.id === "string" && typeof s?.description === "string")
      .slice(0, 20)
      .map((s) => ({ id: s.id.slice(0, 64), description: s.description.slice(0, 300) }))
    : [];
  const pieces = Array.isArray(r.pieces)
    ? r.pieces.filter((x) =>
      typeof x?.id === "string" && /^[\w-]{1,130}$/.test(x.id) && SLOTS.includes(x.slot) &&
      typeof x.title === "string" && typeof x.merchant === "string" && Number.isFinite(x.price)
    ).map((x) => ({ ...x, title: x.title.slice(0, 200), merchant: x.merchant.slice(0, 80), sizes: Array.isArray(x.sizes) ? x.sizes : [] }))
      .slice(0, 80)
    : [];
  const s = r.spec as Spec | null | undefined;
  const spec = s && typeof s.root === "string" && s.elements && typeof s.elements === "object" && s.elements[s.root] &&
      Object.keys(s.elements).length <= 800
    ? { root: s.root, elements: s.elements }
    : null;
  const t = r.template;
  const ts = t?.spec;
  const template = ts && typeof ts.root === "string" && ts.elements && typeof ts.elements === "object" && ts.elements[ts.root] &&
      Object.keys(ts.elements).length <= 200 && t.cards && typeof t.cards === "object"
    ? {
      spec: { root: ts.root, elements: ts.elements },
      cards: Object.fromEntries(Object.entries(t.cards).map(([k, v]) => [k, Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 12) : []])),
    }
    : null;
  return { prompt: r.prompt.trim().slice(0, 500), history: history.map((h) => h.slice(0, 500)), previousIntent, storefronts, spec, pieces, template };
}

async function run(req: ComposeRequest, send: (e: ComposeEvent) => void, signal: AbortSignal) {
  const note = (text: string) => send({ type: "note", text });
  note("Reading your request");

  // Step 0: the agent plans the search and the page change
  const plan: Plan = await makePlan(req, signal).catch((err) => {
    console.error("Grok plan", err);
    return fallbackPlan(req);
  });
  // A page from an older catalog or a broken one is rebuilt from its pieces instead of edited
  const current = plan.new_group || !req.spec ? null : checkSpec(req.spec, req.pieces);
  if (req.spec && !plan.new_group && !current) console.warn("Rebuilding a page that failed checkSpec", JSON.stringify(req.spec).slice(0, 2000));
  const shownSlots = current ? specSlots(current) : [];
  const slots = [...new Set([...(plan.new_group ? [] : shownSlots.length ? shownSlots : req.previousIntent?.slots ?? []), ...plan.search.map((s) => s.slot)])];
  const intent: Intent = {
    layout: plan.kind === "set" ? "lineup" : "look",
    slots: slots.length ? slots : ["top", "bottom", "shoes"],
    colour: plan.filters.colour,
    size: plan.filters.size,
    budget: plan.filters.budget,
    gender: plan.filters.gender,
    sort: "relevance",
    theme: null,
    density: null,
  };
  send({ type: "intent", intent, refining: !plan.new_group, storefront: plan.storefront });
  if (plan.say) note(plan.say);

  // A follow-up with nothing on screen and nothing to show needs items first
  if (!current && !plan.search.length && !req.pieces.length) {
    plan.search = intent.slots.map((slot) => ({ slot, query: defaultQuery(slot, intent.colour) }));
  }

  // A changed filter (size, colour, budget, gender) applies to the items already shown too.
  // A category it empties is searched again with the filter
  const prev = req.previousIntent;
  const refiltered = !plan.new_group && !!prev && (["colour", "size", "budget", "gender"] as const).some((k) => prev[k] !== intent[k]);
  const onPage = plan.new_group ? [] : inOrder(current, req.pieces);
  const kept = refiltered ? applyFilters(onPage, intent, note) : onPage;
  for (const slot of new Set(onPage.map((p) => p.slot))) {
    if (kept.some((p) => p.slot === slot) || plan.search.some((s) => s.slot === slot)) continue;
    note(`Nothing shown in ${LABEL[slot].toLowerCase()} fits, searching again`);
    plan.search.push({ slot, query: defaultQuery(slot, intent.colour) });
  }

  // Steps 1 and 4: search items for the new group or for a follow-up
  const found = plan.search.length ? await search(plan, intent, signal, note) : [];
  if (found.length) send({ type: "pieces", pieces: found });

  // What the page shows after this request: new items replace their category or join it
  const replaced = new Set(plan.replace ? found.map((p) => p.slot) : []);
  const shown = uniq([...kept.filter((p) => !replaced.has(p.slot)), ...found]);
  let spec: Spec | null = current;
  let last = "";
  if (!current) {
    // Step 2: compose a new UI with Jev, or load the new pieces into the saved storefront the shopper chose
    const pieces = uniq([...kept, ...found]);
    const setup: Setup = {
      title: title(plan.new_group ? req.prompt : req.history[0] ?? req.prompt),
      kind: plan.kind,
      setTitle: title(plan.search[0]?.query ?? LABEL[pieces[0]?.slot ?? "top"]),
      pieces,
      prompt: req.prompt,
      say: plan.say,
    };
    spec = req.template ? checkSpec(fromTemplate(req.template, pieces, setup.title), pieces) : null;
    if (spec) {
      note("Loaded your saved storefront");
      last = sendSpec(send, spec, last);
    } else {
      note("Arranging your storefront");
      const storefront = req.storefronts.find((s) => s.id === plan.storefront)?.description ?? null;
      const prompt = plan.new_group ? req.prompt : [...req.history, req.prompt].join(". ");
      for await (const step of composeUI(prompt, setup, storefront, within(signal, 30000))) {
        if (step.fallback) note("Arranged in code, Jev could not finish this one");
        last = sendSpec(send, step.spec, last);
      }
    }
  } else if (found.length || refiltered) {
    // Step 4: new items replace or join their category, done in code like a data binding
    spec = bind(current, shown, true);
    last = sendSpec(send, spec, last);
  }
  // Step 3: Jev merges the page change into the current tree. A fresh Jev composition already read the whole prompt
  if (spec && plan.ui) {
    note("Updating the page");
    const pieces = inOrder(spec, shown);
    const root = spec.elements[spec.root];
    const setTitle = Object.values(spec.elements).find((e) => e.type === "Section" && e.props.slot === null)?.props.title;
    const setup: Setup = {
      title: typeof root?.props.title === "string" ? root.props.title : title(req.history[0] ?? req.prompt),
      kind: plan.kind,
      setTitle: typeof setTitle === "string" ? setTitle : LABEL[pieces[0]?.slot ?? "top"],
      pieces,
      prompt: plan.ui,
      say: plan.say,
    };
    let stop = "error";
    const start = last;
    const budget = within(signal, 45000);
    // Jev sometimes finishes a request about every item after a few of them. A second round on the result picks up the rest
    for (let round = 0; round < 2; round++) {
      const before = last;
      for await (const step of refineUI(plan.ui, spec, setup, budget)) {
        if ("stop" in step) stop = step.stop;
        else last = sendSpec(send, (spec = step.spec), last);
      }
      if (stop !== "finish" || last === before) break;
    }
    // A second round that finds nothing left may say unavailable, that is not a failure
    if ((stop === "unavailable" || stop === "error") && last === start && !refiltered) note("Could not make that change");
  }

  const hasLive = shown.some((p) => p.source === "live");
  const hasMock = shown.some((p) => p.source === "mock");
  send({ type: "done", source: hasLive && hasMock ? "mixed" : hasMock ? "mock" : "live" });
}

// Sends a spec only when it changed. Returns what was sent
function sendSpec(send: (e: ComposeEvent) => void, spec: Spec, last: string): string {
  const clean = { root: spec.root, elements: spec.elements as Record<string, SpecElement> };
  const json = JSON.stringify(clean);
  if (json !== last) send({ type: "spec", spec: clean });
  return json;
}

const title = (text: string) => {
  const t = text.trim().slice(0, 60);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const uniq = (pieces: Piece[]) => [...new Map(pieces.map((p) => [p.id, p])).values()];

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Shop words for the same kind of item
const SAME_KIND: Record<string, string[]> = { trainer: ["sneaker"], sneaker: ["trainer"], "t-shirt": ["tee"], tee: ["t-shirt"], trouser: ["chino"], pant: ["trouser"] };

async function search(plan: Plan, intent: Intent, signal: AbortSignal, note: (t: string) => void): Promise<Piece[]> {
  const queries = Object.fromEntries(plan.search.map(({ slot, query }) => {
    const q = intent.colour && !query.toLowerCase().includes(intent.colour) ? `${intent.colour} ${query}` : query;
    return [slot, intent.gender && !/\b(men|women)/i.test(q) ? `${intent.gender}'s ${q}` : q];
  })) as Partial<Record<SlotName, string>>;
  note(`Searching ${count(plan.search.length, "category", "categories")} across UK shops`);
  const live = await liveSearch(queries, within(signal, LIVE_BUDGET_MS), note)
    .catch((err) => (console.error(err), { pieces: [] as Piece[], noUK: 0 }));
  if (live.noUK) note(`Dropped ${count(live.noUK, "piece")}, no UK delivery`);

  // The same product in another colour or url shows once
  const photos = [...new Map(live.pieces.filter((p) => p.image).map((p) => [`${p.merchant}|${p.title}`.toLowerCase(), p])).values()];
  const noPhoto = live.pieces.filter((p) => !p.image).length;
  if (noPhoto) note(`Dropped ${count(noPhoto, "piece")} with no photo`);
  const kept = applyFilters(photos, intent, note);
  // 10 per category unless the shopper asked for a number. Below 7, samples fill in
  const cap = plan.count ?? 10;
  const min = Math.min(7, cap);
  const pieces: Piece[] = [];
  for (const { slot } of plan.search) {
    let found = kept.filter((p) => p.slot === slot);
    if (found.length < min) {
      note(`Live search found ${count(found.length, "piece")} for ${slot}, adding sample pieces`);
      // Only samples of the same kind of item, the query's last word, so chelsea boots never fill in with sneakers.
      // Live pieces and no matching sample means no fill in. Nothing live at all falls back to every sample
      const kind = (queries[slot] ?? "").toLowerCase().split(/[^a-z-]+/).filter(Boolean).at(-1)?.replace(/s$/, "") ?? "";
      const kinds = [kind, ...(SAME_KIND[kind] ?? [])];
      const all = mockPieces(slot);
      const matching = all.filter((p) => kinds.some((k) => k && p.title.toLowerCase().includes(k)));
      const mock = matching.length || found.length ? matching : all;
      const fitting = applyFilters(mock, intent);
      found = [...found, ...(fitting.length || found.length ? fitting : mock).slice(0, min - found.length)];
    }
    pieces.push(...found.slice(0, cap));
  }
  note(`Found ${count(pieces.length, "piece")} in ${count(new Set(pieces.map((p) => p.merchant)).size, "shop")}`);
  return pieces;
}

// Words in a title or shop url that mark a piece for the other gender
const OTHER_GENDER = { men: /\b(women|womens|ladies|female)\b/i, women: /\b(men|mens|male)\b/i };

// Drops pieces over budget, clearly in the wrong colour, for the other gender or without the shopper's size, and says so
function applyFilters(pieces: Piece[], intent: Intent, note?: (t: string) => void): Piece[] {
  const noSize = pieces.filter((p) => !fitsSize(p, intent.size));
  if (note && noSize.length) note(`Dropped ${count(noSize.length, "piece")} not in stock in ${intent.size}`);
  pieces = pieces.filter((p) => !noSize.includes(p));
  const gender = intent.gender;
  const otherGender = pieces.filter((p) => gender && OTHER_GENDER[gender].test(`${p.title} ${p.url.replace(/[-_/.']/g, " ")}`));
  if (note && otherGender.length) note(`Dropped ${count(otherGender.length, "piece")} for ${gender === "men" ? "women" : "men"}`);
  pieces = pieces.filter((p) => !otherGender.includes(p));
  const overBudget = pieces.filter((p) => intent.budget && p.price > intent.budget);
  const offColour = pieces.filter((p) => {
    const cs = coloursIn(p.title);
    return intent.colour && cs.length && !cs.includes(intent.colour);
  });
  if (note && overBudget.length) note(`Dropped ${count(overBudget.length, "piece")} over £${intent.budget}`);
  if (note && offColour.length) note(`Dropped ${count(offColour.length, "piece")} in other colours`);
  return pieces.filter((p) => !overBudget.includes(p) && !offColour.includes(p));
}
