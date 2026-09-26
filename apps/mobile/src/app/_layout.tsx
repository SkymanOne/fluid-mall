import { SupabaseProvider } from "@fluid-mall/app";
import { Stack } from "expo-router";

import { supabase } from "@/supabase";

export default function RootLayout() {
  return (
    <SupabaseProvider value={supabase}>
      <Stack screenOptions={{ title: "Fluid Mall" }} />
    </SupabaseProvider>
  );
}
