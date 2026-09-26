// outfit-image Edge Function. Pictures the outfit the shopper picked as a shop the look photo with the Grok image model,
// using each piece's product photo as a reference so the picture shows the real pieces. A Grok vision model then finds
// each piece in the picture for the tags. The prompts are built here from piece facts only.

import { BROWSER_HEADERS } from "../compose/product-page.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const SLOTS = ["outer", "top", "bottom", "shoes"] as const;
type Slot = (typeof SLOTS)[number];
type Gender = "men" | "women" | null;
type Line = { slot: Slot; title: string; colour: string | null; brand: string | null; image: string | null };
type Spot = { slot: Slot; x: number; y: number };

const NOUN: Record<Slot, string> = { outer: "jacket", top: "top", bottom: "bottoms", shoes: "shoes" };

// Where each category sits on a standing model, for when the vision model cannot say
const ANCHOR: Record<Slot, { x: number; y: number }> = {
  outer: { x: 0.38, y: 0.34 },
  top: { x: 0.5, y: 0.3 },
  bottom: { x: 0.46, y: 0.62 },
  shoes: { x: 0.5, y: 0.93 },
};

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "Use POST" });
  if (!(await authorised(req))) return reply(401, { error: "Unauthorized" });
  const body = parse(await req.json().catch(() => null));
  if (!body) return reply(400, { error: "Expected { pieces: [{ slot, title, colour, brand, image }], gender }" });
  try {
    const image = await picture(body.pieces, body.gender);
    return reply(200, { image, spots: await locate(image, body.pieces) });
  } catch (err) {
    console.error(err);
    return reply(502, { error: "Could not picture this outfit" });
  }
});

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

// Same check as compose. Only `just outfit-image-dev` passes --local, so a secret alone cannot switch auth off
async function authorised(req: Request): Promise<boolean> {
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

// Trust boundary: one piece per category, short plain text. Photos are https links or small inline images,
// which is how the client sends sample photos the image model cannot reach
function parse(raw: unknown): { pieces: Line[]; gender: Gender } | null {
  const r = raw as { pieces?: unknown; gender?: unknown } | null;
  if (!Array.isArray(r?.pieces)) return null;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, max) : null);
  const photo = (v: unknown) =>
    typeof v === "string" && (/^https:\/\/\S{1,2000}$/.test(v) || (v.length < 2_000_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v))) ? v : null;
  const pieces: Line[] = [];
  for (const p of r.pieces.slice(0, 8)) {
    const slot = SLOTS.find((s) => s === p?.slot);
    const title = text(p?.title, 120);
    if (!slot || !title || pieces.some((l) => l.slot === slot)) continue;
    pieces.push({ slot, title, colour: text(p.colour, 30), brand: text(p.brand, 60), image: photo(p.image) });
  }
  if (!pieces.length) return null;
  pieces.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
  return { pieces, gender: r.gender === "men" || r.gender === "women" ? r.gender : null };
}

async function picture(lines: Line[], gender: Gender): Promise<string> {
  const photos = await Promise.all(lines.map((l) => (l.image ? inline(l.image) : null)));
  const refs = lines.filter((_, i) => photos[i]);
  if (refs.length) {
    try {
      const images = photos.filter((p) => p).map((url) => ({ url, type: "image_url" }));
      return await imagine("edits", { prompt: describe(lines, gender, refs), images });
    } catch (err) {
      console.warn("Outfit image with reference photos failed, retrying with words only", err);
    }
  }
  return await imagine("generations", { prompt: describe(lines, gender, []) });
}

// Many shops block xAI's image fetcher, so photos are fetched here like a browser and sent inline.
// A photo that fails is left out and the picture leans on the words for that piece
async function inline(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { headers: { ...BROWSER_HEADERS, accept: PHOTO_TYPES.join(",") }, signal: AbortSignal.timeout(6000) });
    const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!res.ok || !PHOTO_TYPES.includes(type)) {
      await res.body?.cancel();
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 5_000_000) return null;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function describe(lines: Line[], gender: Gender, refs: Line[]) {
  const who = gender === "men" ? "male model" : gender === "women" ? "female model" : "model";
  const pieces = lines.map((l) => {
    const facts = [l.colour, l.brand && `by ${l.brand}`].filter(Boolean).join(", ");
    return `the ${NOUN[l.slot]}, "${l.title}"${facts ? ` (${facts})` : ""}`;
  });
  const photos = refs.length
    ? ` The reference photos show the real pieces in this order: ${refs.map((l, i) => `photo ${i + 1} is the ${NOUN[l.slot]}`).join(", ")}. Each piece must look exactly like its photo: same colour, pattern, cut and details. Do not copy the people, faces or backgrounds from the photos.`
    : "";
  return `Photorealistic full body shop the look photo of one ${who} wearing all of these pieces together: ${pieces.join("; ")}.${photos} Whole body in frame from head to shoes, standing and facing the camera, plain warm off-white studio backdrop, soft natural light. No other clothes or accessories, no text, no logos.`;
}

async function imagine(endpoint: "edits" | "generations", body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`https://api.x.ai/v1/images/${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${Deno.env.get("XAI_API_KEY") ?? ""}`, "content-type": "application/json" },
    // b64_json skips downloading from xAI's image host, which needs a browser user agent
    body: JSON.stringify({ model: "grok-imagine-image", aspect_ratio: "3:4", resolution: "1k", response_format: "b64_json", ...body }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`Grok image ${endpoint} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const item = (await res.json()).data?.[0];
  if (typeof item?.b64_json !== "string") throw new Error(`Grok image ${endpoint} returned no picture`);
  return `data:${item.mime_type ?? "image/jpeg"};base64,${item.b64_json}`;
}

// The centre of each piece in the picture, 0 to 1 from the top left, for the tag dots.
// Anything missing or out of range falls back to where that category sits on a standing model
async function locate(image: string, lines: Line[]): Promise<Spot[]> {
  let found: Record<string, { x?: unknown; y?: unknown } | undefined> = {};
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${Deno.env.get("XAI_API_KEY") ?? ""}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "grok-4.7",
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image, detail: "high" } },
            {
              type: "text",
              text: `This is a full body outfit photo. For each key below, give one point that lies clearly on that piece and on no other piece, in the middle of its largest visible area, as x and y from 0 to 1 measured from the top left corner of the photo. Keys: ${
                lines.map((l) => `${l.slot} is the ${NOUN[l.slot]} ("${l.title}")`).join(", ")
              }. A jacket worn open: a point on the jacket fabric beside the opening, not on the top underneath. Shoes: a point on one shoe. Reply with JSON only, for example {"top": {"x": 0.5, "y": 0.3}}.`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`Grok vision ${res.status}: ${(await res.text()).slice(0, 300)}`);
    found = JSON.parse((await res.json()).choices[0].message.content);
  } catch (err) {
    console.warn("Could not locate the pieces, using fixed spots", err);
  }
  const unit = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;
  return lines.map(({ slot }) => {
    const p = found?.[slot];
    return p && unit(p.x) && unit(p.y) ? { slot, x: p.x, y: p.y } : { slot, ...ANCHOR[slot] };
  });
}
