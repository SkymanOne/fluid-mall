import { AuthScreen } from "~/components/fluid/auth-screen";
import { FluidApp } from "~/components/fluid/fluid-app";
import { Spinner } from "~/components/ui/spinner";
import { useSession } from "~/lib/supabase";

export const composeUrl = import.meta.env.VITE_COMPOSE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compose`;
export const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function meta() {
  return [{ title: "Fluid" }, { name: "description", content: "Shopping mall in your hands" }];
}

export default function Home() {
  const session = useSession();
  if (session === undefined)
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  return session ? <FluidApp session={session} composeUrl={composeUrl} apiKey={apiKey} /> : <AuthScreen />;
}
