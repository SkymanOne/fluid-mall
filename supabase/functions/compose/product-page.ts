// Reads a product from any shop's product page: schema.org JSON-LD first, then OpenGraph meta tags.
// Page content is data. Only typed fields are copied out, nothing from it is ever run or followed.

export const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml",
  "accept-language": "en-GB,en;q=0.9",
};

export type Size = { label: string; available: boolean };

// The fields Piece gained for showing the whole shop page. Drop this once ./types.ts carries them
export type PieceExtras = {
  images: string[];
  brand: string | null;
  description: string | null;
  details: string[];
  rating: { value: number; count: number } | null;
  colours: string[];
  deliveryOptions: { name: string; price: number | null; days: string | null }[];
};

export type PageProduct = Omit<PieceExtras, "deliveryOptions"> & {
  title: string;
  site: string | null;
  image: string | null;
  price: number;
  // The earlier price in the same currency when the page marks the product down
  wasPrice: number | null;
  currency: string;
  sizes: Size[];
};

const ENTITIES: Record<string, string> = {
  amp: "&", nbsp: " ", pound: "£", quot: '"', apos: "'", rsquo: "'", lsquo: "'", ndash: "-", mdash: "-", gt: ">", lt: "<",
};

export const decode = (s: string) =>
  s.replace(/&#(x?)([\da-f]+);/gi, (_, x, n) => {
    const c = parseInt(n, x ? 16 : 10);
    return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : " ";
  }).replace(/&(\w+);/g, (m, e) => ENTITIES[e.toLowerCase()] ?? m);

export function htmlText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|template|nav|select|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(?:br|\/p|\/li|\/div|\/h\d|\/tr|\/td|\/th|\/dt|\/dd|\/summary|\/section)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[,;:\s]+$/, "")}…`);

// The shop's description as plain text, ending at a sentence near 700 characters
export function description(html: string | null | undefined): string | null {
  const text = oneLine(htmlText(html ?? ""));
  // "Buy X from Shop - only £99. Fast shipping" is a search engine line, not a description
  if (SEO.test(text)) return null;
  if (text.length <= 700) return text || null;
  const end = Math.max(...[". ", "! ", "? "].map((p) => text.lastIndexOf(p, 698)));
  return end > 300 ? text.slice(0, end + 1) : cut(text, 700);
}

// Prose sentences only count as facts when short and clearly about material, fit, care or origin
const FACT = /\d{1,3}\s?%|\b(fit|machine wash|hand wash|dry clean|do not tumble|made in|crafted in|model (?:is|wears)|lining|lined|composition|inseam|gsm)\b/i;
const FLUFF = /perfect|must[- ]have|elevate|effortless|timeless|iconic|you'll love|shop now|discover|staple|treat yourself|look no further/i;
const SEO = /^(buy|shop)\b|fast shipping|official (site|store)/i;

// Short facts the shop states, like "100% Cotton Twill" or "Made in Portugal", in the shop's words
export function details(descHtml: string | null | undefined, stated: string[] = []): string[] {
  const html = descHtml ?? "";
  const bullets = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => oneLine(htmlText(m[1])));
  const lines = htmlText(html).split(/\n|(?<=[.!?])\s+/).map(oneLine).filter((l) => FACT.test(l) && l.length <= 100 && /^[A-Z0-9]/.test(l));
  const seen = new Set<string>();
  return [...stated, ...bullets, ...lines]
    .map((l) => cut(l.replace(/^[-•*·\s]+/, ""), 120))
    .filter((l) => l.length >= 3 && !SEO.test(l) && !(FLUFF.test(l) && !/\d/.test(l)) && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()))
    .slice(0, 8);
}

// null when the shop blocks us or the page is not HTML
export async function fetchPage(url: string, signal: AbortSignal): Promise<{ url: string; html: string } | null> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal });
  if (!res.ok || !/html/.test(res.headers.get("content-type") ?? "")) {
    await res.body?.cancel();
    return null;
  }
  return { url: res.url, html: await res.text() };
}

type Node = Record<string, unknown>;
const isType = (n: Node, t: string) => [n["@type"]].flat().some((x) => x === t);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? decode(v).replace(/\s+/g, " ").trim() : null);
const nameOf = (v: unknown) => str(v) ?? (v && typeof v === "object" ? str((v as Node).name) : null);

function nodes(html: string): Node[] {
  const out: Node[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    out.push(v as Node);
    if ((v as Node)["@graph"]) walk((v as Node)["@graph"]);
  };
  for (const [, body] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(body));
    } catch {
      // Broken JSON-LD, skip it
    }
  }
  return out;
}

function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const inStock = (v: unknown) => {
  const a = String(v ?? "");
  return /OutOfStock|SoldOut|Discontinued/i.test(a) ? false : /InStock|LimitedAvailability|OnlineOnly|PreOrder/i.test(a) ? true : null;
};

type Offer = { price: number | null; was: number | null; currency: string | null; available: boolean | null; size: string | null };

function offersOf(v: unknown): Offer[] {
  return [v].flat().filter((o): o is Node => !!o && typeof o === "object").flatMap((o) => {
    if (isType(o, "AggregateOffer")) {
      const inner = offersOf(o.offers);
      return inner.length ? inner : [{ price: money(o.lowPrice ?? o.price), was: null, currency: str(o.priceCurrency), available: inStock(o.availability), size: null }];
    }
    // A reduced price carries the old one as a second price specification, priceType StrikethroughPrice or ListPrice
    const specs = [o.priceSpecification].flat().filter((x): x is Node => !!x && typeof x === "object");
    const listed = specs.find((x) => /StrikethroughPrice|ListPrice/i.test(String(x.priceType ?? "")));
    const spec = specs.find((x) => x !== listed);
    return [{
      price: money(o.price ?? spec?.price),
      was: money(listed?.price),
      currency: str(o.priceCurrency ?? spec?.priceCurrency),
      available: inStock(o.availability),
      size: nameOf((o.itemOffered as Node | undefined)?.size) ?? nameOf(o.size),
    }];
  });
}

function imagesOf(v: unknown, base: string): string[] {
  return [...new Set([v].flat().flatMap((x) => {
    const src = str(x) ?? (x && typeof x === "object" ? str((x as Node).url ?? (x as Node).contentUrl) : null);
    try {
      // SSENSE publishes a template url with an __IMAGE_PARAMS__ placeholder that fails as is
      return src ? [new URL(src.replace("__IMAGE_PARAMS__", "b_white,g_center,f_auto,q_auto:best"), base).href] : [];
    } catch {
      return [];
    }
  }))];
}

function ratingOf(v: unknown): PageProduct["rating"] {
  const r = [v].flat()[0] as Node | undefined;
  const value = money(r?.ratingValue);
  const count = money(r?.reviewCount ?? r?.ratingCount);
  const best = money(r?.bestRating) ?? 5;
  return value && count && value <= best ? { value: Math.round((value * 5 / best) * 10) / 10, count: Math.round(count) } : null;
}

// JSON-LD material and additionalProperty name and value pairs
function statedFacts(p: Node): string[] {
  const props = [p.additionalProperty].flat().filter((x): x is Node => !!x && typeof x === "object")
    .map((x) => [nameOf(x.name), nameOf(x.value)].filter(Boolean).join(": "));
  const material = [p.material].flat().map(nameOf).filter((m): m is string => !!m).map((m) => `Material: ${m}`);
  return [...material, ...props].filter(Boolean);
}

function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag.match(/\b(?:property|name|itemprop)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (key && content && !(key in out)) out[key] = decode(content).trim();
  }
  return out;
}

const ONE_SIZE = /^(one size|onesize|os|o\/s)$/i;
const GONE = /out of stock|sold out|unavailable|notify me/i;

// Sizes the page shows as a picker, for shops whose structured data has none: a fieldset whose legend says size,
// or a select named size. Each size needs its own label, stock comes from the label text or a disabled control
export function sizesInHtml(html: string): Size[] {
  const block = html.match(/<fieldset\b[^>]*>\s*<legend[^>]*>[^<]*size[^<]*<\/legend>([\s\S]*?)<\/fieldset>/i)?.[1] ??
    html.match(/<select\b[^>]*(?:name|id|aria-label)=["'][^"']*size[^"']*["'][^>]*>([\s\S]*?)<\/select>/i)?.[1];
  const sizes: Size[] = [];
  for (const [, , attrs, inner] of block?.matchAll(/<(label|button|option)\b([^>]*)>([\s\S]*?)<\/\1>/gi) ?? []) {
    const raw = decode(attrs.match(/aria-label=["']([^"']+)["']/i)?.[1] ?? inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const label = raw.replace(/^size\s*/i, "").split(/\s+[-–(]\s*|,/)[0].trim();
    if (!label || label.length > 16 || /select|choose|guide/i.test(label) || sizes.some((s) => s.label === label)) continue;
    const gone = GONE.test(raw) || /\bdisabled\b|aria-disabled=["']true|class=["'][^"']*(?:unavailable|sold-?out|oos)\b/i.test(attrs + inner);
    sizes.push({ label, available: !gone });
  }
  return sizes.length >= 2 ? sizes : [];
}

export function readProduct(html: string, url: string): PageProduct | null {
  const meta = metaTags(html);
  const site = meta["og:site_name"] && meta["og:site_name"].length <= 30 ? meta["og:site_name"] : null;
  const all = nodes(html);
  const product = all.find((n) => isType(n, "ProductGroup")) ?? all.find((n) => isType(n, "Product"));

  if (product) {
    const variants = [product.hasVariant].flat().filter((v): v is Node => !!v && typeof v === "object");
    const own = offersOf(product.offers);
    const fromVariants = variants.flatMap((v) => offersOf(v.offers).map((o) => ({ ...o, size: o.size ?? nameOf(v.size) })));
    const offers = [...own, ...fromVariants];
    const priced = offers.find((o) => o.price !== null);
    if (priced) {
      if (offers.every((o) => o.available === false)) return null;
      // Sizes only when the page labels each one and says if it is in stock, never guessed from sku codes
      const labelled = offers.filter((o) => o.size && o.size.length <= 16);
      let sizes: Size[] = [];
      if (labelled.every((o) => o.available !== null)) {
        for (const o of labelled) {
          const label = ONE_SIZE.test(o.size!) ? "One size" : o.size!;
          const s = sizes.find((x) => x.label === label);
          if (s) s.available ||= o.available!;
          else sizes.push({ label, available: o.available! });
        }
      }
      // A single labelled offer is usually just the variant on show, not the size range
      if (sizes.length === 1 && sizes[0].label !== "One size") sizes = [];
      const size = nameOf(product.size);
      if (!sizes.length && size && ONE_SIZE.test(size) && offers.some((o) => o.available !== null)) {
        sizes = [{ label: "One size", available: offers.some((o) => o.available === true) }];
      }
      if (!sizes.length) sizes = sizesInHtml(html);
      const images = [...new Set([...imagesOf(product.image, url), ...imagesOf(meta["og:image"], url)])];
      const own = nameOf(product.color)?.toLowerCase();
      const desc = str(product.description) ?? meta["og:description"] ?? meta["description"];
      return {
        title: str(product.name) ?? meta["og:title"] ?? "",
        brand: nameOf(product.brand),
        site,
        image: images[0] ?? null,
        images,
        price: priced.price!,
        wasPrice: priced.was && priced.was > priced.price! ? priced.was : null,
        currency: (priced.currency ?? meta["product:price:currency"] ?? meta["og:price:currency"] ?? "").toUpperCase(),
        sizes,
        description: description(desc),
        details: details(desc, statedFacts(product)),
        rating: ratingOf(product.aggregateRating),
        colours: [...new Set(variants.map((v) => nameOf(v.color)).filter((c): c is string => !!c && c.toLowerCase() !== own))],
      };
    }
  }

  const price = money(meta["product:price:amount"] ?? meta["og:price:amount"]);
  const currency = meta["product:price:currency"] ?? meta["og:price:currency"];
  if (!price || !currency || inStock(meta["product:availability"] ?? meta["og:availability"]) === false) return null;
  const images = imagesOf(meta["og:image"], url);
  return {
    title: (meta["og:title"] ?? "").split(" | ")[0],
    brand: meta["product:brand"] ?? null,
    site,
    image: images[0] ?? null,
    images,
    price,
    wasPrice: null,
    currency: currency.toUpperCase(),
    sizes: sizesInHtml(html),
    description: description(meta["og:description"] ?? meta["description"]),
    details: details(meta["og:description"] ?? meta["description"]),
    rating: null,
    colours: [],
  };
}

// Self check for the html size picker reader
export function demo() {
  const ms = `<fieldset><legend>Size</legend><ul><li><label aria-label="Size 3"><span>3</span><input type="radio"/></label></li>` +
    `<li><label aria-label="Size 4 - out of stock online"><span>4</span></label></li></ul></fieldset>`;
  console.assert(JSON.stringify(sizesInHtml(ms)) === '[{"label":"3","available":true},{"label":"4","available":false}]', "fieldset sizes");
  const sel = `<select name="size"><option>Select size</option><option>UK 7</option><option disabled>UK 8 - Sold out</option></select>`;
  console.assert(JSON.stringify(sizesInHtml(sel)) === '[{"label":"UK 7","available":true},{"label":"UK 8","available":false}]', "select sizes");
  console.assert(sizesInHtml("<p>no picker</p>").length === 0, "nothing guessed");
  const offer = (specs: unknown[]) =>
    `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Tee", offers: { "@type": "Offer", availability: "InStock", priceCurrency: "GBP", priceSpecification: specs } })}</script>`;
  const was = readProduct(offer([{ price: 30 }, { price: 45, priceType: "https://schema.org/StrikethroughPrice" }]), "https://shop.test/tee");
  console.assert(was?.price === 30 && was.wasPrice === 45, "sale price and was price");
  console.assert(readProduct(offer([{ price: 30 }]), "https://shop.test/tee")?.wasPrice === null, "no was price when not reduced");
  return "ok";
}
