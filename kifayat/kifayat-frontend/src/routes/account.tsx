import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/landing/PageShell";
import {
  User, Package, PackageCheck, MapPin, Heart, CreditCard, Star, Tag, LogOut,
  Calendar, Clock, Camera, Zap, ShieldCheck, Gift, Timer, Truck,
  TrendingUp, Award,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile, TIERS, TierKey } from "@/lib/shop.functions";
import { useAuth, signOut } from "@/lib/auth-store";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

const nav = [
  { to: "/account", label: "Profile", icon: User, exact: true },
  { to: "/account/your-orders", label: "Your Orders", icon: PackageCheck },
  { to: "/account/orders", label: "Orders", icon: Package },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/payment-methods", label: "Payment methods", icon: CreditCard },
  { to: "/account/reviews", label: "Reviews", icon: Star },
  { to: "/account/vouchers", label: "Vouchers", icon: Tag },
];

function AccountLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = path === "/account";
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <PageShell>
        <section className="max-w-7xl mx-auto px-4 py-24" aria-hidden>
          {loading ? (
            <div className="space-y-8">
              <div className="h-3 w-32 rounded animate-pulse bg-secondary" />
              <div className="h-40 rounded-3xl animate-pulse bg-secondary border border-border" />
              <div className="grid sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl animate-pulse bg-secondary border border-border" />
                ))}
              </div>
            </div>
          ) : (
            <p className="eyebrow text-muted-foreground">Redirecting to sign in…</p>
          )}
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="My account"
        subtitle="Manage your profile, orders and preferences."
        breadcrumbs={[{ label: "Home", to: "/" }, { label: "Account" }]}
      />
      <section className="max-w-7xl mx-auto px-4 py-6 lg:py-10 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] gap-4 lg:gap-8">
        {/* Mobile: horizontal scrollable tab nav */}
        <aside className="lg:hidden min-w-0">
          <div className="flex overflow-x-auto no-scrollbar gap-1 bg-card border border-border rounded-2xl p-2 min-w-0">
            {nav.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to as never}
                  className={`flex items-center gap-2 px-3 h-9 rounded-lg text-xs whitespace-nowrap shrink-0 transition ${
                    active
                      ? "bg-primary-soft text-primary-dark font-semibold"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" /> {label}
                </Link>
              );
            })}
            <button
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="flex items-center gap-2 px-3 h-9 rounded-lg text-xs whitespace-nowrap shrink-0 text-muted-foreground hover:bg-secondary"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        </aside>

        {/* Desktop: vertical sidebar */}
        <aside className="hidden lg:block bg-card border border-border rounded-2xl p-3 h-fit sticky top-28">
          <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to as never}
                  className={`flex items-center gap-3 px-3.5 h-11 rounded-lg text-sm transition ${
                    active
                      ? "bg-primary-soft text-primary-dark font-semibold"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              );
            })}
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="w-full flex items-center gap-3 px-3.5 h-11 rounded-lg text-sm hover:bg-secondary text-muted-foreground"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        </aside>

        <div className="min-w-0">{isIndex ? <ProfileView /> : <Outlet />}</div>
      </section>
    </PageShell>
  );
}

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

const perkIcon = (name: string) => {
  const map: Record<string, any> = { Zap, ShieldCheck, Gift, Timer, Truck, Package, MapPin, Star, Calendar, TrendingUp, Award };
  return map[name] || Star;
};

async function uploadAvatar(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("avatar", file);
  try {
    const res = await fetch("/api/auth/avatar", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = await res.json();
    if (data.success) return data.avatar;
    throw new Error(data.message || "Upload failed");
  } catch {
    return null;
  }
}

function ProfileView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [avatar, setAvatar] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [uploading, setUploading] = useState(false);

  const tierKey: TierKey = data?.profile?.tier ?? "bronze";
  const tier = TIERS[tierKey];
  const profile = data?.profile;
  const email = data?.email;
  const nextTier: [TierKey, typeof TIERS[TierKey]] | null = (() => {
    const order = ["bronze", "silver", "gold", "platinum"] as TierKey[];
    const idx = order.indexOf(tierKey);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      return [next, TIERS[next]];
    }
    return null;
  })();

  const nextTierProgress = (() => {
    if (!nextTier || !profile) return null;
    const next = nextTier[1];
    const targetOrders = next.minOrders;
    const targetSpent = next.minSpent;
    const currentOrders = profile.totalOrdersCount ?? 0;
    const currentSpent = profile.totalSpentAmount ?? 0;
    const ordersPct = Math.min(100, Math.round((currentOrders / Math.max(targetOrders, 1)) * 100));
    const spentPct = Math.min(100, Math.round((currentSpent / Math.max(targetSpent, 1)) * 100));
    return {
      currentOrders,
      targetOrders,
      ordersPct,
      currentSpent,
      targetSpent,
      spentPct,
      overallPct: Math.max(ordersPct, spentPct),
      ordersNeeded: Math.max(0, targetOrders - currentOrders),
      spentNeeded: Math.max(0, targetSpent - currentSpent),
    };
  })();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setGender(profile.gender ?? "");
      setAvatar(profile.avatar ?? "");
      setDateOfBirth(profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "");
    }
  }, [profile]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadAvatar(file);
    setUploading(false);
    if (url) {
      setAvatar(url);
      toast.success("Avatar uploaded.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } else {
      toast.error("Avatar upload failed.");
    }
  };

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({
        full_name: fullName,
        phone: phone || null,
        gender: gender || null,
        avatar: avatar || null,
        dateOfBirth: dateOfBirth || null,
      }),
    onSuccess: () => {
      toast.success("Profile saved.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed."),
  });

  if (isLoading) {
    return (
      <div className="space-y-8" aria-hidden>
        <div className="h-40 rounded-3xl animate-pulse bg-secondary border border-border" />
        <div className="grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse bg-secondary border border-border" />
          ))}
        </div>
        <div className="h-56 rounded-2xl animate-pulse bg-secondary border border-border" />
      </div>
    );
  }

  const memberSince = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : null;

  const discount = profile?.customDiscountPercent ?? 0;

  return (
    <div className="space-y-8">

      {/* ── Membership Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-[1px]"
        style={{ background: `linear-gradient(135deg, ${tier.color}80, ${tier.color}20, ${tier.color}80)` }}
      >
        <div className="relative bg-card rounded-3xl p-7 sm:p-9 overflow-hidden">
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.06]"
            style={{ background: `radial-gradient(circle, ${tier.color}, transparent)` }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.04]"
            style={{ background: `radial-gradient(circle, ${tier.color}, transparent)` }}
          />
          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="size-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${tier.color}30, ${tier.color}10)`, border: `1px solid ${tier.color}40` }}
                >
                  {tier.emoji}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Membership</p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: tier.color }}>{tier.label}</h1>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-lg font-semibold text-foreground">{fullName || email || "Member"}</p>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  {memberSince && <span>Member since {memberSince}</span>}
                  <span>{profile?.totalOrdersCount ?? 0} orders</span>
                  <span>Rs {(profile?.totalSpentAmount ?? 0).toLocaleString()} spent</span>
                </p>
              </div>
            </div>
            {discount > 0 && (
              <div className="shrink-0 text-center sm:text-right">
                <div
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}30`, color: tier.color }}
                >
                  <span className="text-lg">{discount}%</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70">OFF</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">on every order</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Progress to Next Tier ── */}
      {nextTier && nextTierProgress && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Next tier</p>
            <div className="flex items-center gap-2">
              <span className="text-sm">{nextTier[1].emoji}</span>
              <span className="text-sm font-bold" style={{ color: nextTier[1].color }}>{nextTier[1].label}</span>
            </div>
          </div>
          <div className="relative">
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${nextTierProgress.overallPct}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${tier.color}, ${nextTier[1].color})` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
              <span>Current</span>
              <span className="font-semibold text-foreground">{nextTierProgress.overallPct}%</span>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{nextTierProgress.currentOrders}</span> / {nextTierProgress.targetOrders} orders</span>
            <span>Rs <span className="font-semibold text-foreground">{nextTierProgress.currentSpent.toLocaleString()}</span> / {nextTierProgress.targetSpent.toLocaleString()}</span>
            {nextTierProgress.ordersNeeded > 0 && (
              <span className="font-medium" style={{ color: nextTier[1].color }}>{nextTierProgress.ordersNeeded} more orders</span>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Perks / Benefits ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Benefits</p>
            <h2 className="text-lg font-bold text-foreground mt-0.5">{tier.label} privileges</h2>
          </div>
          {profile?.isVerifiedCustomer && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <ShieldCheck className="size-3" /> Verified
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tier.perks.map((perk: any, i: number) => {
            const Icon = perkIcon(perk.icon);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="group relative bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:shadow-black/5 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="size-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${tier.color}12`, color: tier.color }}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">{perk.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{tier.label} benefit</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Stats Strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="grid grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden"
      >
        {[
          { label: "Orders", value: profile?.totalOrdersCount ?? 0, icon: Package },
          { label: "Spent", value: `Rs ${(profile?.totalSpentAmount ?? 0).toLocaleString()}`, icon: TrendingUp },
          { label: "Points", value: profile?.loyaltyPoints ?? 0, icon: Star },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-card py-5 px-3 text-center">
              <Icon className="size-4 mx-auto mb-2 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-xl font-bold text-foreground tracking-tight">{stat.value}</p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">{stat.label}</p>
            </div>
          );
        })}
      </motion.div>

      {/* ── Personal Information ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="bg-card border border-border rounded-2xl p-6 sm:p-8"
      >
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground mb-6">Personal information</p>

        <div className="space-y-5 max-w-lg">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative size-20 rounded-full overflow-hidden bg-secondary shrink-0 grid place-items-center ring-2 ring-border">
              {avatar ? (
                <img src={avatar} alt="" className="size-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <User className="size-8 text-muted-foreground" strokeWidth={1.2} />
              )}
              <label className="absolute inset-0 grid place-items-center bg-black/0 hover:bg-black/40 transition cursor-pointer rounded-full">
                {uploading ? (
                  <span className="text-white text-xs font-bold">...</span>
                ) : (
                  <Camera className="size-5 text-white opacity-0 hover:opacity-100 transition" />
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
              </label>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Avatar</p>
              <p className="text-[10px] text-muted-foreground">Click the camera icon to upload</p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Email</p>
            <p className="text-sm font-semibold text-foreground">{email ?? "—"}</p>
          </div>

          <label className="block">
            <span className="text-xs text-muted-foreground mb-1.5 block font-medium">Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-muted-foreground mb-1.5 block font-medium">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX XXXXXXX"
                className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground mb-1.5 block font-medium">Gender</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)}
                className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all"
              >
                <option value="">Select</option>
                {GENDERS.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-muted-foreground mb-1.5 block font-medium">Date of birth</span>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all" />
          </label>

          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="w-full h-11 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </motion.div>

      {/* ── Member since ── */}
      {memberSince && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-[10px] text-muted-foreground/60 text-center tracking-wider"
        >
          Member since {memberSince}
        </motion.p>
      )}
    </div>
  );
}
