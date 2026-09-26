import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useSupabase } from "~/lib/supabase";

export function AuthScreen() {
  const supabase = useSupabase();
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = signUp
      ? await supabase.auth.signUp({ email, password, options: { data: { invite_code: inviteCode.trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (!data.session) setMessage("Check your email to confirm your account");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-8">
        <div>
          <h1 className="font-numeral text-[7.5rem] leading-[0.85] font-extrabold tracking-tight">Fluid</h1>
          <p className="text-muted-foreground">Shopping mall in your hands</p>
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete={signUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {signUp && (
            <Field>
              <FieldLabel htmlFor="invite">Invite code</FieldLabel>
              <Input id="invite" autoCapitalize="characters" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
            </Field>
          )}
          <Button type="submit" size="lg" disabled={busy || !email || !password || (signUp && !inviteCode.trim())}>
            {busy ? "One moment" : signUp ? "Sign up" : "Sign in"}
          </Button>
          <Button type="button" variant="link" className="self-start px-0 text-foreground" onClick={() => setSignUp(!signUp)}>
            {signUp ? "Have an account? Sign in" : "Have an invite? Sign up"}
          </Button>
        </FieldGroup>
        {!!message && (
          <Alert aria-live="polite">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </form>
    </main>
  );
}
