"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

/** Shared email/password + Google auth form for /login and /signup. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const configured = supabaseConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    const sb = getSupabaseBrowser();
    if (!sb) { setError("Supabase is not configured. Add env vars, or continue in demo mode."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setNotice("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const sb = getSupabaseBrowser();
    if (!sb) { setError("Supabase is not configured. Add env vars, or continue in demo mode."); return; }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="mesh grain grid min-h-screen place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.21, 0.65, 0.34, 1] }}
        className="glass w-full max-w-md p-8"
      >
        <div className="flex justify-center"><Logo href="/" /></div>
        <h1 className="mt-6 text-center font-display text-2xl">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Sign in to your financial cockpit." : "Start analyzing your money in minutes."}
        </p>

        <Button variant="outline" className="mt-6 w-full" onClick={google} disabled={busy}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} />
          </div>
          {error && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          {notice && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>New here? <Link href="/signup" className="text-primary hover:underline">Create an account</Link></>
          ) : (
            <>Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link></>
          )}
        </p>
        {!configured && (
          <p className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-center text-xs text-warning">
            Supabase env vars missing — <Link href="/dashboard" className="underline">continue in demo mode</Link>.
          </p>
        )}
      </motion.div>
    </div>
  );
}
