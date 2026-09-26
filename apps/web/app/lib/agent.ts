import type { ComposeEvent, ComposeRequest, Piece, SlotName } from "./types";

// Streams NDJSON events from the compose Edge Function.
// Falls back to reading the whole response where fetch has no readable body stream.
export async function compose(
  url: string,
  token: string,
  apiKey: string,
  body: ComposeRequest,
  onEvent: (event: ComposeEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, apikey: apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Compose failed (${res.status})`);

  let buffer = "";
  const flush = (final: boolean) => {
    const lines = buffer.split("\n");
    buffer = final ? "" : (lines.pop() ?? "");
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  };

  const reader = res.body?.getReader?.();
  if (!reader) {
    buffer = await res.text();
    return flush(true);
  }
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush(false);
  }
  flush(true);
}

const outfitImageUrl = import.meta.env.VITE_OUTFIT_IMAGE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outfit-image`;

// Where a piece sits in the outfit picture, 0 to 1 from the top left
export type Spot = { slot: SlotName; x: number; y: number };

// Asks the outfit-image Edge Function for an AI picture of the picked pieces, made from their product photos,
// and where each piece sits in it. Returns a small JPEG data URL, since it is kept in localStorage
export async function outfitImage(token: string, pieces: Piece[], gender: "men" | "women" | null): Promise<{ src: string; spots: Spot[] }> {
  // Sample photos are served by this app, where the image model cannot reach them, so they go inline
  const photos = await Promise.all(pieces.map((p) => (p.image?.startsWith("/") ? shrink(p.image, 640).catch(() => null) : p.image)));
  const res = await fetch(outfitImageUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ gender, pieces: pieces.map((p, i) => ({ slot: p.slot, title: p.title, colour: p.colour, brand: p.brand, image: photos[i] })) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.image !== "string" || !Array.isArray(data.spots)) throw new Error(data.error ?? `Outfit image failed (${res.status})`);
  return { src: await shrink(data.image, 768), spots: data.spots };
}

async function shrink(src: string, max: number) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
