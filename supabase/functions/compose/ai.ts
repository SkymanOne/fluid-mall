// Thin clients for TypeSafe Jev, Grok and Tavily. Keys come from Edge Function secrets.

const key = (name: string) => Deno.env.get(name) ?? "";

export type JevAnswer = { type: string; choice?: string; noul?: number; confidence?: number };

export async function jev(
  state: unknown,
  questions: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ answers: Record<string, JevAnswer>; usage?: { input_tokens?: number } }> {
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${key("TYPESAFE_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "jev-latest", state, questions }),
    signal,
  });
  if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

// The plan needs accuracy: the newest Grok with light reasoning, 4 to 10s in tests.
// Reading delivery policies runs inside a 6s budget, so it uses the fast non reasoning model
export const GROK_ACCURATE = { model: "grok-4.7", reasoning_effort: "low" };
export const GROK_FAST = { model: "grok-4.20-0309-non-reasoning" };

export async function grokJson(system: string, user: unknown, signal: AbortSignal, grok: Record<string, string> = GROK_FAST): Promise<unknown> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key("XAI_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({
      ...grok,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Grok ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export type TavilyResult = { url: string; title: string; content: string };

export async function tavily(body: Record<string, unknown>, signal: AbortSignal): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { authorization: `Bearer ${key("TAVILY_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  return (await res.json()).results ?? [];
}

// Aborts on whichever comes first, the outer signal or a per call timeout
export const within = (signal: AbortSignal, ms: number) => AbortSignal.any([signal, AbortSignal.timeout(ms)]);
