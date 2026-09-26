import type { ComposeEvent, ComposeRequest } from "./types";

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
