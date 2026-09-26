import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useSupabase } from "./supabase";

export function AuthScreen() {
  const supabase = useSupabase();
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    const { data, error } = signUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { invite_code: inviteCode.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (!data.session) setMessage("Check your email to confirm your account");
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete={signUp ? "new-password" : "current-password"}
        value={password}
        onChangeText={setPassword}
      />
      {signUp && (
        <TextInput
          style={styles.input}
          placeholder="Invite code"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
      )}
      <Button
        title={signUp ? "Sign up" : "Sign in"}
        disabled={busy || !email || !password || (signUp && !inviteCode.trim())}
        onPress={submit}
      />
      <Button
        title={signUp ? "Have an account? Sign in" : "Have an invite? Sign up"}
        onPress={() => setSignUp(!signUp)}
      />
      {!!message && <Text>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 24, maxWidth: 400, width: "100%", alignSelf: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 },
});
