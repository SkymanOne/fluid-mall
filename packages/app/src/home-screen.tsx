import type { Session } from "@supabase/supabase-js";
import { Button, StyleSheet, Text, View } from "react-native";
import { useSupabase } from "./supabase";

export function HomeScreen({ session }: { session: Session }) {
  const supabase = useSupabase();

  return (
    <View style={styles.container}>
      <Text>Signed in as {session.user.email}</Text>
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 24, maxWidth: 400, width: "100%", alignSelf: "center" },
});
