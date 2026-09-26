import { useEffect, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";

const APP_URL = import.meta.env.VITE_WEB_APP_URL;

export function meta() {
  return [
    { title: "Fluid. Shopping mall in your hands" },
    {
      name: "description",
      content: "Say what you want to wear. Fluid searches UK shops, builds a shop around your request and puts every piece in one bag.",
    },
  ];
}

// Made up shops and pieces from the compose mock (supabase/functions/compose/mock.ts). Photos are Grok generated.
const SHOPS = {
  harbour: { name: "Harbour & Loom", fee: 3.95, freeOver: 75, days: "2-4", returns: 30 },
  kestrel: { name: "Kestrel Supply", fee: 4.5, freeOver: 100, days: "3-5", returns: 28 },
  northgate: { name: "Northgate Atelier", fee: 0, freeOver: null, days: "1-2", returns: 14 },
  fernwood: { name: "Fernwood Studio", fee: 5, freeOver: 60, days: "3-6", returns: 30 },
  cobble: { name: "Cobble Lane Goods", fee: 2.99, freeOver: 50, days: "2-3", returns: 21 },
};
type ShopKey = keyof typeof SHOPS;
type Piece = { id: string; shop: ShopKey; title: string; price: number };

const piece = (id: string, shop: ShopKey, title: string, price: number): Piece => ({ id, shop, title, price });
const P = {
  tee: piece("m_top_0", "cobble", "White Heavyweight Boxy Tee", 28),
  jumper: piece("m_top_1", "northgate", "Black Merino Crew Neck Jumper", 65),
  oxford: piece("m_top_2", "harbour", "Blue Oxford Button Down Shirt", 45),
  trousers: piece("m_bottom_0", "northgate", "Black Pleated Wide Leg Trousers", 68),
  jeans: piece("m_bottom_1", "kestrel", "Blue Straight Leg Selvedge Jeans", 85),
  chinos: piece("m_bottom_2", "harbour", "Beige Relaxed Cotton Chinos", 55),
  sneakers: piece("m_shoes_0", "kestrel", "White Leather Court Sneakers", 95),
  boots: piece("m_shoes_1", "fernwood", "Brown Suede Chelsea Boots", 120),
  canvas: piece("m_shoes_2", "cobble", "Black Canvas Low Top Trainers", 45),
  overshirt: piece("m_outer_1", "kestrel", "Grey Wool Blend Overshirt", 75),
  polo: piece("m_top_4", "fernwood", "Navy Knitted Polo Shirt", 49),
  retro: piece("m_shoes_5", "kestrel", "White Retro Court Trainers", 72),
  field: piece("m_outer_4", "cobble", "Brown Waxed Cotton Field Jacket", 120),
};

type Tag = { piece: Piece; x: number; y: number; side: "left" | "right" };
const LOOKS: { prompt: string; photo: string; alt: string; tags: Tag[] }[] = [
  {
    prompt: "I wanna look cool at a tech event",
    photo: "/looks/tech.webp",
    alt: "A man in a grey overshirt, white tee, black pleated trousers and white sneakers",
    tags: [
      { piece: P.overshirt, x: 60, y: 26, side: "right" },
      { piece: P.tee, x: 44, y: 38, side: "left" },
      { piece: P.trousers, x: 43, y: 70, side: "left" },
      { piece: P.sneakers, x: 56, y: 93, side: "left" },
    ],
  },
  {
    prompt: "Something easy for a Saturday in town",
    photo: "/looks/weekend.webp",
    alt: "A woman in a navy knitted polo, straight blue jeans and white trainers, a brown field jacket over her shoulder",
    tags: [
      { piece: P.field, x: 30, y: 40, side: "left" },
      { piece: P.polo, x: 57, y: 30, side: "right" },
      { piece: P.jeans, x: 58, y: 62, side: "right" },
      { piece: P.retro, x: 40, y: 92, side: "left" },
    ],
  },
];

const CATEGORIES = [
  { name: "Tops", pieces: [P.tee, P.jumper, P.oxford] },
  { name: "Bottoms", pieces: [P.trousers, P.jeans, P.chinos] },
  { name: "Shoes", pieces: [P.sneakers, P.boots, P.canvas] },
];

const BAG = [P.overshirt, P.sneakers, P.trousers, P.tee];

const pounds = (n: number) => `£${n}`;
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format;
const shipLine = (key: ShopKey) => {
  const s = SHOPS[key];
  return s.fee === 0 ? `Free UK delivery, ${s.days} days` : `UK delivery ${money(s.fee)}, ${s.days} days`;
};

// One order per shop, with that shop's delivery rule applied to the order subtotal
function splitBag(pieces: Piece[]) {
  const keys = [...new Set(pieces.map((p) => p.shop))];
  return keys.map((key) => {
    const s = SHOPS[key];
    const items = pieces.filter((p) => p.shop === key);
    const subtotal = items.reduce((sum, p) => sum + p.price, 0);
    const delivery = s.fee === 0 || (s.freeOver !== null && subtotal >= s.freeOver) ? 0 : s.fee;
    return { key, shop: s, items, delivery, total: subtotal + delivery };
  });
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3 8.5 3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}

function OpenFluid({ small, inverse, children = "Open Fluid" }: { small?: boolean; inverse?: boolean; children?: string }) {
  return (
    <a className={`btn${small ? " btn-sm" : ""}${inverse ? " btn-inverse" : ""}`} href={APP_URL}>
      {children}
      <Arrow />
    </a>
  );
}

// Types each look's prompt, then swaps the photo and hangs its tags
function Hero() {
  const [look, setLook] = useState(0);
  const [chars, setChars] = useState(LOOKS[0].prompt.length);
  const full = LOOKS[look].prompt.length;
  const ready = chars >= full;
  const prev = (look + LOOKS.length - 1) % LOOKS.length;

  useEffect(() => {
    if (reducedMotion()) return;
    const t = ready
      ? setTimeout(() => {
          setLook((look + 1) % LOOKS.length);
          setChars(0);
        }, 6500)
      : setTimeout(() => setChars(chars + 1), chars === 0 ? 500 : 42);
    return () => clearTimeout(t);
  }, [look, chars, ready]);

  return (
    <section className="hero wrap">
      <div className="hero-copy">
        <h1>Say what you want to wear.</h1>
        <p className="lede">Fluid searches UK shops and builds a shop around your request. Pieces from every shop go in one bag.</p>
        <div className="prompt" aria-hidden="true">
          <span className="prompt-text">
            {LOOKS[look].prompt.slice(0, chars)}
            <span className="caret" />
          </span>
          <span className="prompt-send">
            <Arrow />
          </span>
        </div>
        <div className="hero-actions">
          <OpenFluid />
          <a className="link" href="#reshape">
            See how it works
          </a>
        </div>
      </div>
      <figure className="look">
        {LOOKS.map((l, i) => (
          <img
            key={l.photo}
            className="look-photo"
            src={l.photo}
            alt={l.alt}
            width={864}
            height={1152}
            data-on={ready ? i === look : i === prev}
            aria-hidden={!(ready ? i === look : i === prev)}
            fetchPriority={i === 0 ? "high" : "low"}
          />
        ))}
        {LOOKS.map((l, i) =>
          l.tags.map((t, j) => (
            <div
              key={t.piece.id}
              className="tag"
              data-side={t.side}
              data-on={ready && i === look}
              aria-hidden={!(ready && i === look)}
              style={{ left: `${t.x}%`, top: `${t.y}%`, "--i": j } as CSSProperties}
            >
              <span className="tag-pin" />
              <span className="tag-string" />
              <span className="tag-card">
                <span className="tag-shop">{SHOPS[t.piece.shop].name}</span>
                <span className="tag-title">{t.piece.title}</span>
                <span className="tag-price">{pounds(t.piece.price)}</span>
              </span>
            </div>
          )),
        )}
        <figcaption className="look-note">Sample look. The shops are made up.</figcaption>
      </figure>
    </section>
  );
}

type Layout = "grid" | "carousel" | "list";

// The page changes on request, the pieces stay the same
function Reshape() {
  const [layout, setLayout] = useState<Layout>("grid");
  const [dark, setDark] = useState(false);
  const [onlyTops, setOnlyTops] = useState(false);

  function change(update: () => void) {
    if (!document.startViewTransition || reducedMotion()) return update();
    document.startViewTransition(() => flushSync(update));
  }

  const asks: { text: string; on: boolean; run: () => void }[] = [
    { text: "Show it as a grid", on: layout === "grid", run: () => setLayout("grid") },
    { text: "Show each category as a carousel", on: layout === "carousel", run: () => setLayout("carousel") },
    { text: "Put it all in a list", on: layout === "list", run: () => setLayout("list") },
    { text: "Dark mode", on: dark, run: () => setDark(!dark) },
    { text: "Only tops", on: onlyTops, run: () => setOnlyTops(!onlyTops) },
  ];
  const cats = onlyTops ? CATEGORIES.slice(0, 1) : CATEGORIES;
  const shopCount = new Set(cats.flatMap((c) => c.pieces.map((p) => p.shop))).size;

  return (
    <section className="section wrap" id="reshape">
      <div className="section-head">
        <h2 className="h2">Change the page by asking.</h2>
        <p>Ask for a carousel, a list, dark mode or only tops. Fluid rebuilds the page around the same pieces. Try it here.</p>
      </div>
      <div className="reshape">
        <div className="asks" role="group" aria-label="Ask the page">
          {asks.map((a) => (
            <button key={a.text} type="button" className="ask" aria-pressed={a.on} onClick={() => change(a.run)}>
              “{a.text}”
              <span className="ask-mark">
                <Check />
              </span>
            </button>
          ))}
          <p className="note">Sample pieces.</p>
        </div>
        <div className="shop" data-layout={layout} data-dark={dark}>
          <div className="shop-head" style={{ viewTransitionName: "shop-head" }}>
            <h3>Outfit for a tech event</h3>
            <span>{shopCount} shops</span>
          </div>
          {cats.map((c) => (
            <div className="cat" key={c.name}>
              <h4 style={{ viewTransitionName: `cat-${c.name}` }}>{c.name}</h4>
              <ul className="cards">
                {c.pieces.map((p) => (
                  <li className="card" key={p.id} style={{ viewTransitionName: `card-${p.id}` }}>
                    <img src={`/samples/${p.id}.webp`} alt={p.title} width={900} height={600} loading="lazy" />
                    <div className="card-body">
                      <span className="card-shop">{SHOPS[p.shop].name}</span>
                      <span className="card-title">{p.title}</span>
                      <span className="card-price">{pounds(p.price)}</span>
                      <span className="card-ship">{shipLine(p.shop)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Bag() {
  const orders = splitBag(BAG);
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  return (
    <section className="section bag">
      <div className="wrap">
        <div className="section-head">
          <h2 className="h2">One bag. Every shop.</h2>
          <p>Put pieces from different shops in one bag. At checkout Fluid splits it into an order per shop, each with its own delivery and returns. You confirm every total first.</p>
        </div>
        <ol className="slips">
          {orders.map((o) => (
            <li className="slip" key={o.key}>
              <div className="slip-head">
                <h3>{o.shop.name}</h3>
                <span>{o.shop.returns} day returns</span>
              </div>
              <dl>
                {o.items.map((p) => (
                  <div key={p.id} style={{ display: "contents" }}>
                    <dt>{p.title}</dt>
                    <dd>{money(p.price)}</dd>
                  </div>
                ))}
                <dt className="sub">UK delivery, {o.shop.days} working days</dt>
                <dd className="sub">{o.delivery === 0 ? "Free" : money(o.delivery)}</dd>
              </dl>
              <div className="slip-total">
                <span>Order total</span>
                <strong>{money(o.total)}</strong>
              </div>
            </li>
          ))}
        </ol>
        <div className="bag-total">
          <p>
            {BAG.length} pieces, {orders.length} shops, one checkout
          </p>
          <strong>{money(total)}</strong>
        </div>
        <p className="note" style={{ marginTop: "1.25rem" }}>
          Sample bag. Checkout in Fluid is simulated, no money moves.
        </p>
      </div>
    </section>
  );
}

function Truth() {
  return (
    <section className="section wrap truth">
      <div className="section-head">
        <h2 className="h2">Stock information. All in one place.</h2>
        <p>
          Price, sizes, stock, UK delivery and returns come from each shop's own page. Save yourself time checking size availability.
          Fluid will fetch it for you.
        </p>
      </div>
      <div className="label">
        <p className="label-mark" aria-hidden="true">
          Fluid
        </p>
        <ul>
          <li>Price in GBP</li>
          <li>Sizes and stock</li>
          <li>UK delivery cost and time</li>
          <li>Returns</li>
        </ul>
        <p>Read from the shop. Unknown stays unknown.</p>
      </div>
    </section>
  );
}

function Phone() {
  return (
    <section className="section wrap phone">
      <div className="section-head">
        <h2 className="h2">Keep it on your phone.</h2>
        <p>Fluid runs in the browser and installs like an app. No app store needed.</p>
      </div>
      <ol className="steps">
        <li>
          <h3>iPhone</h3>
          <p>Open Fluid in Safari, tap Share, then Add to Home Screen.</p>
        </li>
        <li>
          <h3>Android</h3>
          <p>Open Fluid in Chrome, tap the menu, then Install app.</p>
        </li>
      </ol>
    </section>
  );
}

function Close() {
  return (
    <section className="wrap close">
      <img src="/looks/wedding.webp" alt="A woman in a cobalt slip dress and cream linen blazer, walking and smiling" width={864} height={1152} loading="lazy" />
      <div className="close-copy">
        <h2 className="h2">What are you shopping for?</h2>
        <div className="prompt" aria-hidden="true">
          <span className="prompt-text">Summer wedding guest, under £300</span>
          <span className="prompt-send">
            <Arrow />
          </span>
        </div>
        <OpenFluid>Start shopping</OpenFluid>
        <p className="note">Sign up needs an invite code for now.</p>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <header className="wrap nav">
        <a className="wordmark" href="/">
          Fluid
        </a>
        <OpenFluid small />
      </header>
      <main>
        <Hero />
        <Reshape />
        <Bag />
        <Truth />
        <Phone />
        <Close />
      </main>
      <footer className="wrap footer">
        <p className="footer-mark" aria-hidden="true">
          Fluid
        </p>
        <div className="footer-row">
          <p>Shopping mall in your hands</p>
        </div>
      </footer>
    </>
  );
}
