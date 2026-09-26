import type { Session } from "@supabase/supabase-js";
import { FluidApp } from "~/components/fluid/fluid-app";
import { apiKey, composeUrl } from "./home";

// Dev only: the app without sign in, for design review against `COMPOSE_DEV_SKIP_AUTH=1 just compose-dev`
const session = { user: { id: "preview", email: "preview@localhost" } } as Session;

export default function Preview() {
  if (!import.meta.env.DEV) return <p>Not found</p>;
  return <FluidApp session={session} composeUrl={composeUrl} apiKey={apiKey} />;
}
