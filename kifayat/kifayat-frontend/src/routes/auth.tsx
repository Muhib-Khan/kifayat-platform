import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User as UserIcon, ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getPostLoginPath, refreshAuth, useAuth } from "@/lib/auth-store";
import { firebaseConfigured, signInWithGoogle } from "@/lib/firebase";
import { GoogleLogo } from "@/components/GoogleLogo";
import imgEditorial from "@/assets/editorial-hero.jpg";
import imgJournal1  from "@/assets/journal-1.jpg";
import imgHero      from "@/assets/hero.jpg";
import imgJournal2  from "@/assets/journal-2.jpg";
import imgJournal3  from "@/assets/journal-3.jpg";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const SLIDES = [
  {
    img:     imgEditorial,
    eyebrow: "Pakistan-wide · Fairly priced",
    heading: ["Quality", "essentials,", "delivered."],
    accent:  1,
    sub:     "Shop electronics, fashion, home goods and more — dispatched with care, cash on delivery.",
  },
  {
    img:     imgJournal1,
    eyebrow: "Curated · Considered · Crafted",
    heading: ["Objects,", "chosen with", "purpose."],
    accent:  0,
    sub:     "Every product on our shelf was picked for a reason — no filler, no noise, just the good stuff.",
  },
  {
    img:     imgHero,
    eyebrow: "Fashion · Footwear · Style",
    heading: ["Style that", "moves with", "you."],
    accent:  2,
    sub:     "From everyday sneakers to statement pieces — fashion delivered Pakistan-wide, always on time.",
  },
  {
    img:     imgJournal2,
    eyebrow: "Home & Kitchen · Living",
    heading: ["Your space,", "considered", "carefully."],
    accent:  1,
    sub:     "Everything your home needs, sourced with the same care we'd use for our own — shipped to your door.",
  },
  {
    img:     imgJournal3,
    eyebrow: "Beauty · Skincare · Wellness",
    heading: ["Your", "routine,", "elevated."],
    accent:  2,
    sub:     "Top-rated skincare and beauty — authentic products, fair prices, delivered fast across Pakistan.",
  },
] as const;

type Mode = "signin" | "signup" | "verify-otp" | "forgot";

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = digits.map((d, idx) => (idx === i ? "" : d)).join("");
        onChange(next.slice(0, 6));
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        const next = digits.map((d, idx) => (idx === i - 1 ? "" : d)).join("");
        onChange(next.slice(0, 6));
      }
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = digits.map((d, idx) => (idx === i ? char : d)).join("");
    onChange(next.slice(0, 6));
    if (char && i < 5) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      refs.current[Math.min(pasted.length, 5)]?.focus();
      e.preventDefault();
    }
  }

  return (
    <div className="flex gap-2 justify-between">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-full aspect-square text-center text-lg font-mono font-semibold bg-muted/50 border border-border rounded-lg focus:border-brass focus:ring-1 focus:ring-brass/30 outline-none text-foreground caret-transparent transition-all"
        />
      ))}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  autoComplete,
  ...rest
}: {
  label: string;
  icon: React.ElementType;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPw = type === "password";
  const inputType = isPw ? (showPw ? "text" : "password") : type;
  const filled = value.length > 0;

  return (
    <div className="relative">
      <input
        {...rest}
        type={inputType}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={label}
        className={`peer w-full h-12 pl-10 pr-4 bg-muted/30 border border-border rounded-lg text-sm text-foreground transition-all duration-200 outline-none
          ${focused ? "border-brass ring-1 ring-brass/20" : "hover:border-border/80"}
          ${isPw ? "pr-10" : ""}
          placeholder:text-muted-foreground/50`}
      />
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none ${
          focused ? "text-brass" : "text-muted-foreground/60"
        }`}
      >
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      {isPw && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {showPw ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  );
}

const INTERVAL = 4500;

function EditorialCarousel() {
  const [idx, setIdx]       = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback((next?: number) => {
    setIdx((cur) => next !== undefined ? next : (cur + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => advance(), INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, advance]);

  const slide = SLIDES[idx];

  return (
    <div
      className="hidden lg:flex lg:w-[52%] xl:w-[58%] relative flex-col overflow-hidden bg-coal select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={idx}
          src={slide.img}
          alt=""
          aria-hidden
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.5, ease: "easeIn" } }}
          className="absolute inset-0 size-full object-cover opacity-45 mix-blend-luminosity"
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-br from-coal/85 via-coal/50 to-coal/75 pointer-events-none" />

      <div className="absolute top-0 inset-x-0 h-[2px] bg-bone/10 z-20">
        <style>{`@keyframes auth-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
        <div
          key={idx}
          className="h-full bg-brass origin-left will-change-transform"
          style={{
            animation: `auth-progress ${INTERVAL / 1000}s linear`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full px-14 py-14">
        <Link to="/" aria-label="Kifayat — home" className="w-fit hover:opacity-80 transition-opacity">
          <img src="/logo.webp" alt="Kifayat" className="h-9 sm:h-10 w-auto" draggable={false} />
        </Link>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx + "-copy"}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 } }}
              exit={{ opacity: 0, y: -18, transition: { duration: 0.3, ease: [0.55, 0, 1, 0.45] } }}
            >
              <p className="eyebrow text-bone/40 mb-6 flex items-center gap-3">
                <span className="h-px w-6 bg-bone/30" />
                {slide.eyebrow}
              </p>
              <h2 className="font-display italic text-[clamp(3rem,6vw,5.5rem)] leading-[0.88] text-bone tracking-tight">
                {slide.heading.map((word, wi) =>
                  wi === slide.accent
                    ? <span key={wi} className="text-brass">{word}<br /></span>
                    : <span key={wi}>{word}<br /></span>
                )}
              </h2>
              <p className="mt-6 text-bone/55 text-base leading-relaxed max-w-sm">
                {slide.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => advance(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  i === idx ? "w-8 bg-brass" : "w-3 bg-bone/30 hover:bg-bone/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const panelVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.18, ease: [0.55, 0, 1, 0.45] as [number, number, number, number] } },
};

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;

  const [mode, setMode] = useState<Mode>(search?.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("Prefer not to say");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "reset">("email");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: getPostLoginPath(user) });
    }
  }, [user, loading, navigate]);

  function switchMode(next: Mode) {
    setOtp("");
    setResetStep("email");
    setResetOtp("");
    setResetNewPassword("");
    setMode(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await api.post("/auth/register", { name, email, password, gender });
        toast.success("Account created! Check your email for the verification code.");
        switchMode("verify-otp");
      } else if (mode === "verify-otp") {
        const verifyRes = await api.post<{ success: boolean; user: any }>("/auth/verify-otp", { email, otp });
        toast.success("Email verified! Signing you in…");
        await refreshAuth();
        navigate({ to: getPostLoginPath(verifyRes.user) });
      } else if (mode === "forgot") {
        if (resetStep === "email") {
          await api.post("/auth/forgot-password", { email });
          toast.success("Reset code sent to your email.");
          setResetStep("reset");
        } else {
          await api.post("/auth/reset-password", { email, otp: resetOtp, newPassword: resetNewPassword });
          toast.success("Password reset successfully! Sign in with your new password.");
          switchMode("signin");
        }
      } else {
        const loginRes = await api.post<{ success: boolean; user: any }>("/auth/login", { email, password });
        await refreshAuth();
        toast.success("Welcome back.");
        navigate({ to: getPostLoginPath(loginRes.user) });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    try {
      if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email });
        toast.success("New reset code sent.");
      } else {
        await api.post("/auth/resend-otp", { email });
        toast.success("New code sent.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not resend.");
    }
  }

  async function googleSignIn() {
    if (busy) return;
    setBusy(true);
    try {
      const { idToken } = await signInWithGoogle();
      const loginRes = await api.post<{ success: boolean; user: any }>(
        "/auth/google",
        { idToken },
      );
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

  const isSignIn = mode === "signin";
  const title = isSignIn ? "Welcome back" : mode === "signup" ? "Join us" : mode === "forgot" && resetStep === "email" ? "Reset password" : mode === "forgot" ? "Set new password" : "Verify";

  return (
    <div className="min-h-[100dvh] flex bg-background">
      <EditorialCarousel />
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-background via-background to-muted/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brass/3 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-brass/2 via-transparent to-transparent pointer-events-none" />

        <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-border relative z-10 bg-background/80 backdrop-blur-md">
          <Link to="/" aria-label="Kifayat — home" className="flex items-center">
            <img src="/logo.webp" alt="Kifayat" className="h-7 w-auto" draggable={false} />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 relative z-10">
          <div className="w-full max-w-[420px] mx-auto">
            <div className="bg-card/60 backdrop-blur-xl border border-border/60 shadow-2xl shadow-black/5 rounded-2xl p-6 sm:p-8 md:p-10">
              <div className="mb-7 sm:mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-px bg-brass/60" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground/60 font-semibold tracking-[0.15em] uppercase">
                    {mode === "verify-otp" ? "Step 2 · Verification" : mode === "forgot" ? "Password reset" : isSignIn ? "Sign in" : "Sign up"}
                  </p>
                </div>
                <h1 className="font-display italic text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.1] tracking-tight text-foreground">
                  {title}
                  <span className="text-brass">.</span>
                </h1>
              </div>

              <AnimatePresence mode="wait">
                <motion.form
                  key={mode + (resetStep === "reset" ? "-reset" : "")}
                  variants={panelVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onSubmit={submit}
                  className="space-y-3.5 sm:space-y-4"
                >
                  {mode === "verify-otp" ? (
                    <>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        We sent a 6-digit code to{" "}
                        <span className="font-medium text-foreground">{email}</span>.
                      </p>
                      <OtpInput value={otp} onChange={setOtp} />
                      <button type="button" onClick={resendOtp} className="text-xs text-muted-foreground/70 hover:text-brass transition-colors">
                        Didn't get it? Resend code →
                      </button>
                    </>
                  ) : mode === "forgot" ? (
                    resetStep === "email" ? (
                      <Field label="Email address" icon={Mail} type="email" value={email} onChange={setEmail} autoComplete="email" required />
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Enter the code sent to <span className="font-medium text-foreground">{email}</span> along with your new password.
                        </p>
                        <OtpInput value={resetOtp} onChange={setResetOtp} />
                        <Field label="New password" icon={Lock} type="password" value={resetNewPassword} onChange={setResetNewPassword} autoComplete="new-password" minLength={8} required />
                        <button type="button" onClick={resendOtp} className="text-xs text-muted-foreground/70 hover:text-brass transition-colors">
                          Didn't get it? Resend code →
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      {mode === "signup" && (
                        <>
                          <Field label="Full name" icon={UserIcon} value={name} onChange={setName} autoComplete="name" required />
                          <div className="relative">
                            <select
                              value={gender}
                              onChange={(e) => setGender(e.target.value)}
                              className="w-full h-12 px-3 bg-muted/30 border border-border rounded-lg text-sm text-foreground appearance-none focus:border-brass focus:ring-1 focus:ring-brass/20 outline-none transition-all cursor-pointer"
                            >
                              <option disabled>Gender</option>
                              <option>Male</option>
                              <option>Female</option>
                              <option>Other</option>
                              <option>Prefer not to say</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/40 text-xs">▾</span>
                          </div>
                        </>
                      )}
                      <Field label="Email address" icon={Mail} type="email" value={email} onChange={setEmail} autoComplete="email" required />
                      <Field label="Password" icon={Lock} type="password" value={password} onChange={setPassword} autoComplete={isSignIn ? "current-password" : "new-password"} minLength={8} required />
                      {isSignIn && (
                        <div className="flex justify-end -mt-1.5 sm:-mt-2">
                          <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-muted-foreground/60 hover:text-brass transition-colors">
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={busy || (mode === "verify-otp" && otp.replace(/\D/g, "").length < 6) || (mode === "forgot" && resetStep === "reset" && (resetOtp.replace(/\D/g, "").length < 6 || resetNewPassword.length < 8))}
                    className="group relative w-full h-12 sm:h-13 overflow-hidden rounded-xl bg-coal text-bone text-sm font-semibold tracking-wide hover:bg-brass hover:text-coal transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-black/10 hover:shadow-brass/20"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {busy ? (
                        <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          {isSignIn ? "Sign in" : mode === "verify-otp" ? "Verify email" : mode === "forgot" ? (resetStep === "email" ? "Send code" : "Reset password") : "Create account"}
                          <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.5} />
                        </>
                      )}
                    </span>
                  </button>

                  {mode !== "verify-otp" && mode !== "forgot" && firebaseConfigured && (
                    <>
                      <button
                        type="button"
                        onClick={googleSignIn}
                        disabled={busy}
                        className="relative w-full h-12 rounded-xl border border-border/70 bg-background/60 text-sm font-semibold text-foreground hover:border-brass/40 hover:bg-brass/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                      >
                        <GoogleLogo className="size-4" />
                        Continue with Google
                      </button>
                      <div className="relative my-2 sm:my-3">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">
                          <span className="bg-card px-3">or</span>
                        </div>
                      </div>
                    </>
                  )}

                  {mode !== "verify-otp" && mode !== "forgot" && (
                    <div className="relative my-4 sm:my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/60" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-3 text-muted-foreground/50">{isSignIn ? "New here?" : "Member?"}</span>
                      </div>
                    </div>
                  )}

                  {mode !== "verify-otp" && mode !== "forgot" && (
                    <button type="button" onClick={() => switchMode(isSignIn ? "signup" : "signin")} className="w-full h-12 rounded-xl border-2 border-border/60 text-sm font-semibold text-foreground hover:border-brass/40 hover:bg-brass/5 transition-all duration-200">
                      {isSignIn ? "Create an account" : "Sign in"}
                    </button>
                  )}
                </motion.form>
              </AnimatePresence>

              {mode === "verify-otp" && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={() => switchMode("signup")} className="mt-5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1 mx-auto">
                  <ChevronLeft className="size-3" /> Wrong email? Go back
                </motion.button>
              )}
              {mode === "forgot" && resetStep === "email" && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={() => switchMode("signin")} className="mt-5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1 mx-auto">
                  <ChevronLeft className="size-3" /> Back to sign in
                </motion.button>
              )}
              {mode === "forgot" && resetStep === "reset" && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={() => setResetStep("email")} className="mt-5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1 mx-auto">
                  <ChevronLeft className="size-3" /> Wrong email? Go back
                </motion.button>
              )}
            </div>

            <p className="mt-6 sm:mt-8 text-[11px] sm:text-xs text-center text-muted-foreground/50">
              By continuing you agree to our{" "}
              <Link to="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">Terms</Link>
              {" & "}
              <Link to="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

