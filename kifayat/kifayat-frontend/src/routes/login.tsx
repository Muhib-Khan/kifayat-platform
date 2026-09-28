import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/landing/PageShell";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getPostLoginPath, refreshAuth } from "@/lib/auth-store";
import { firebaseConfigured, signInWithGoogle } from "@/lib/firebase";
import { GoogleLogo } from "@/components/GoogleLogo";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function emailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const loginRes = await api.post<{ success: boolean; user: any }>("/auth/login", { email, password });
      await refreshAuth();
      toast.success("Welcome back.");
      navigate({ to: getPostLoginPath(loginRes.user) });
    } catch (err: any) {
      toast.error(err?.message ?? "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    if (busy) return;
    setBusy(true);
    try {
      const { idToken } = await signInWithGoogle();
      const loginRes = await api.post<{ success: boolean; user: any }>("/auth/google", { idToken });
      await refreshAuth();
      toast.success("Welcome back.");
      navigate({ to: getPostLoginPath(loginRes.user) });
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        const code = err?.code ?? "";
        const msg = err?.message ?? "";
        if (code === "auth/invalid-api-key" || code === "auth/unauthorized-domain" || code === "auth/operation-not-allowed") {
          toast.error("Google sign-in isn't configured yet. Please use email to sign in.");
        } else if (code === "auth/id-token-expired" || code === "auth/invalid-id-token" || code === "auth/id-token-revoked" || msg.includes("Session expired")) {
          toast.error("Your Google session expired. Please try signing in again.");
        } else {
          toast.error(msg || "Google sign-in failed. Please try again.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <Link to="/" aria-label="Kifayat — home" className="inline-flex items-center">
            <img src="/logo.webp" alt="Kifayat" className="h-9 w-auto" draggable={false} />
          </Link>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-e1)]">
          <h1 className="text-2xl mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-6">Sign in to continue shopping.</p>
          <form className="space-y-4" onSubmit={emailSignIn}>
            <label className="block"><span className="block text-sm font-medium mb-1.5">Email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
            </label>
            <label className="block"><span className="block text-sm font-medium mb-1.5 flex justify-between">Password <Link to="/auth" className="text-xs text-primary hover:underline">Forgot?</Link></span>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-11 px-3.5 rounded-md border border-border outline-none focus:border-primary text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[color:var(--color-primary)]" /> Remember me</label>
            <button type="submit" disabled={busy} className="w-full h-12 rounded-pill bg-primary text-primary-foreground font-semibold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed">{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <div className="flex items-center gap-3 my-6 text-xs text-muted-foreground"><span className="flex-1 h-px bg-border" />OR<span className="flex-1 h-px bg-border" /></div>
          {firebaseConfigured ? (
            <button
              type="button"
              onClick={googleSignIn}
              disabled={busy}
              className="w-full h-11 rounded-pill border border-border font-medium hover:bg-secondary inline-flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleLogo className="size-4" />
              {busy ? "Signing in…" : "Continue with Google"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/auth" })}
              className="w-full h-11 rounded-pill border border-border font-medium hover:bg-secondary inline-flex items-center justify-center gap-2.5"
            >
              Sign in with Email
            </button>
          )}
          <p className="text-sm text-center text-muted-foreground mt-6">No account? <Link to="/register" className="text-primary font-medium hover:underline">Create one</Link></p>
        </div>
      </div>
    </PageShell>
  );
}
