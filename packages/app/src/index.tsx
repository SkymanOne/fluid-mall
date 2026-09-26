import { ActivityIndicator } from "react-native";
import { AuthScreen } from "./auth-screen";
import { HomeScreen } from "./home-screen";
import { useSession } from "./supabase";

export { AuthScreen, HomeScreen };
export { SupabaseProvider, useSession, useSupabase } from "./supabase";

export function Main() {
  const session = useSession();
  if (session === undefined) return <ActivityIndicator />;
  return session ? <HomeScreen session={session} /> : <AuthScreen />;
}
