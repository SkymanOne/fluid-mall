import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

const SupabaseContext = createContext<SupabaseClient | null>(null);

export const SupabaseProvider = SupabaseContext.Provider;

export function useSupabase() {
  const supabase = useContext(SupabaseContext);
  if (!supabase) throw new Error("useSupabase needs a SupabaseProvider");
  return supabase;
}

// undefined while the stored session loads, null when signed out
export function useSession() {
  const supabase = useSupabase();
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  return session;
}
