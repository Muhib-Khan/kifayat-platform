import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Component, useEffect, useRef, useState } from "react";
import {
  adminBlockUser,
  adminUnblockUser,
  adminDeleteUser,
  adminGetLoginHistory,
  adminGetUserActivity,
  adminGetUserTimeStats,
  adminListUsers,
  adminUpdateUserProfile,
  adminSetUserTier,
  adminSetUserDiscount,
  adminResetUserTier,
  adminSetUserLoyaltyPoints,
} from "@/lib/admin.functions";
import { getAdminRole } from "@/lib/admin-roles";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Ban, Trash2, Clock, ClipboardList, User, ShieldAlert, Key, LogOut, Package, Mail, MapPin, Tag, Pencil, ShieldCheck, Camera, Timer, Code, Palette, Zap, Star, Award, TrendingUp, Gift, X, Percent, Coins, Calendar, Hash, Ticket, CheckCircle } from "lucide-react";
import { PanelTableSkeleton } from "@/components/ui/skeleton";
import { getAdminVouchers, giftVoucher } from "@/lib/voucher.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const fmtFull = (v: string) =>
  v ? new Date(v).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

const timeAgo = (v: string) => {
  if (!v) return "Never";
  const diff = Date.now() - new Date(v).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

class BodyErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground p-6">
          <p className="font-semibold text-red-500 mb-2">Panel Error</p>
          <p className="text-xs text-muted-foreground break-all">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

type PanelMode = "history" | "activity" | "edit" | "time" | "tier";
interface Panel { user: any; mode: PanelMode; }

// ─── Block Confirm Modal ─────────────────────────────────────────────────────
function BlockModal({ user, onConfirm, onCancel, blocking }: {
  user: any; onConfirm: (msg: string) => void; onCancel: () => void; blocking: boolean;
}) {
  const [msg, setMsg] = useState("");
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-card border border-border shadow-e3 rounded-2xl p-8 w-full max-w-[420px]">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <Ban className="size-8 text-amber-500" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-2xl font-bold text-center mb-2 tracking-tight">Block User</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
          Are you sure you want to block <strong className="text-foreground">{user.name}</strong> ({user.email})?<br />
          They won't be able to log in or sign up.
        </p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Reason (optional, shown to user)"
          rows={3}
          className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-foreground text-sm resize-y focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass mb-5 shadow-sm transition-shadow"
        />
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <ShieldAlert className="size-5 text-amber-500 shrink-0" strokeWidth={2} />
          <p className="text-xs text-amber-600 font-medium">The user will not be able to log in or create a new account with this email address.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={blocking}
            className="flex-1 py-3 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-secondary disabled:opacity-50 transition-colors shadow-sm">
            Cancel
          </button>
          <button onClick={() => onConfirm(msg)} disabled={blocking}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-e1">
            {blocking ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            {blocking ? "Blocking…" : "Block User"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────
function DeleteModal({ user, onConfirm, onCancel, deleting }: {
  user: any; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-card border border-border shadow-e3 rounded-2xl p-8 w-full max-w-[420px]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <Trash2 className="size-8 text-red-500" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-2xl font-bold text-center mb-2 tracking-tight">Delete User</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
          Permanently delete <strong className="text-foreground">{user.name}</strong> ({user.email})?<br />
          All their data will be removed. <span className="text-red-500 font-bold">This cannot be undone.</span>
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 py-3 rounded-xl border border-border bg-card text-foreground font-bold text-sm hover:bg-secondary disabled:opacity-50 transition-colors shadow-sm">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors shadow-e1">
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleting ? "Deleting…" : "Delete User"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Gift Voucher Modal ──────────────────────────────────────────────────────
function GiftModal({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [genMode, setGenMode] = useState(false);
  const [giftPct, setGiftPct] = useState(10);
  const [giftMaxUses, setGiftMaxUses] = useState(1);
  const [giftExpiry, setGiftExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [gifted, setGifted] = useState<any | null>(null);

  const { data: vouchersData, isLoading: vouchersLoading } = useQuery({
    queryKey: ["admin-gift-vouchers"],
    queryFn: () => getAdminVouchers(),
    enabled: !!user && !gifted,
  });
  const vouchers = (vouchersData?.vouchers ?? []).filter(
    (v: any) => v.status !== "Purchased" && v.status !== "Ended"
  );

  const giftMut = useMutation({
    mutationFn: (body: any) => giftVoucher(body),
    onSuccess: (res: any) => {
      toast.success(`Voucher gifted to ${user.name}.`);
      setGifted(res?.voucher ?? res);
      qc.invalidateQueries({ queryKey: ["admin-gift-vouchers"] });
      qc.invalidateQueries({ queryKey: ["vouchers-mine"] });
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Gift failed."),
  });

  const doGift = (v: any) => {
    if (giftMut.isPending) return;
    giftMut.mutate({ userId: user._id, voucherId: v._id });
  };

  const doGenerate = () => {
    if (giftMut.isPending) return;
    if (!giftPct || giftPct < 1 || giftPct > 100) {
      toast.error("Enter a discount between 1 and 100.");
      return;
    }
    giftMut.mutate({
      userId: user._id,
      discount_percent: Number(giftPct),
      max_uses: Number(giftMaxUses || 1),
      expires_at: giftExpiry ? new Date(giftExpiry).toISOString() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="bg-card border border-border shadow-e2 rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center shrink-0">
              <Gift className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground leading-tight">Gift Voucher</p>
              <p className="text-xs text-muted-foreground truncate">{user.name} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {gifted ? (
            <div className="text-center py-6">
              <div className="mx-auto size-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center mb-4">
                <CheckCircle className="size-7" />
              </div>
              <p className="font-display font-bold text-foreground text-xl mb-1">Voucher Gifted!</p>
              <p className="text-sm text-muted-foreground mb-4">
                {gifted.discount_percent ? `${gifted.discount_percent}% off` : "Discount voucher"} sent to {user.email}.
                {gifted.voucher_code && <span className="block mt-1 font-mono text-brass font-bold">Code: {gifted.voucher_code}</span>}
              </p>
              <button onClick={() => { setGifted(null); setGenMode(false); }}
                className="px-5 py-2.5 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
                Gift Another
              </button>
            </div>
          ) : vouchersLoading ? (
            <div className="space-y-3" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse bg-secondary" />
              ))}
            </div>
          ) : vouchers.length > 0 ? (
            <div>
              <p className="eyebrow text-muted-foreground mb-3">Available Vouchers ({vouchers.length})</p>
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {vouchers.map((v: any) => (
                  <button key={v._id} onClick={() => doGift(v)}
                    className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-border bg-secondary/30 hover:border-brass/40 hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-lg bg-brass/10 border border-brass/25 text-brass flex items-center justify-center shrink-0">
                        <Percent className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm leading-tight">{v.discount_percent}% Off</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {v.voucher_code || v.code || "—"} · {v.expires_at ? new Date(v.expires_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-lg shrink-0">
                      {giftMut.isPending ? "Gifting…" : "Gift"}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setGenMode(true)} disabled={giftMut.isPending}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold border border-dashed border-brass/40 text-brass rounded-xl hover:bg-brass/5 transition-colors disabled:opacity-50">
                <Coins className="size-4" /> Or Generate a New One & Gift
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto size-14 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center mb-4">
                <Ticket className="size-6" />
              </div>
              <p className="font-bold text-foreground mb-1">No vouchers available</p>
              <p className="text-sm text-muted-foreground mb-5">Generate a fresh voucher and gift it instantly.</p>
              <button onClick={() => setGenMode(true)} disabled={giftMut.isPending}
                className="px-5 py-2.5 text-sm font-bold bg-brass text-coal rounded-lg hover:bg-brass/90 transition-colors shadow-sm disabled:opacity-50">
                Generate & Gift
              </button>
            </div>
          )}

          {genMode && !gifted && (
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-center justify-between mb-4">
                <p className="eyebrow text-muted-foreground">Generate & Gift</p>
                <button onClick={() => setGenMode(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5"><Percent className="size-3" /> Discount Percent</span>
                  <input type="number" min={1} max={100} value={giftPct} onChange={(e) => setGiftPct(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-bold focus:outline-none focus:border-brass bg-card" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5"><Hash className="size-3" /> Max Uses</span>
                  <input type="number" min={1} value={giftMaxUses} onChange={(e) => setGiftMaxUses(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-bold focus:outline-none focus:border-brass bg-card" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5"><Calendar className="size-3" /> Expires</span>
                  <input type="date" value={giftExpiry} onChange={(e) => setGiftExpiry(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-bold focus:outline-none focus:border-brass bg-card" />
                </label>
                <button onClick={doGenerate} disabled={giftMut.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-brass text-coal rounded-xl hover:bg-brass/90 disabled:opacity-50 transition-colors">
                  {giftMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
                  {giftMut.isPending ? "Gifting…" : "Generate & Gift"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [panelPage, setPanelPage] = useState(1);
  const [blockTarget, setBlockTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [giftTarget, setGiftTarget] = useState<any | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Trap wheel events inside the panel so Lenis / page behind doesn't scroll
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [panel]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 350);
  };

  const params: Record<string, string> = {};
  if (debouncedSearch) params.q = debouncedSearch;

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: () => adminListUsers(params),
  });

  const users = usersData?.users ?? [];
  const stats = usersData?.stats ?? {};
  const blocked = usersData?.blocked ?? [];
  const deleted = usersData?.deleted ?? [];

  // Login history panel
  const { data: historyData, isLoading: histLoading } = useQuery({
    queryKey: ["admin-user-history", panel?.user?._id],
    queryFn: () => panel?.user?._id ? adminGetLoginHistory(panel.user._id) : null,
    enabled: !!panel,
  });

  // Activity panel
  const activityParams: Record<string, string> = { page: String(panelPage), limit: "20" };
  const { data: activityData, isLoading: actLoading } = useQuery({
    queryKey: ["admin-user-activity", panel?.user?._id, panelPage],
    queryFn: () => panel?.user?._id ? adminGetUserActivity(panel.user._id, activityParams) : null,
    enabled: !!panel,

  });

  const activityLogs = activityData?.logs ?? [];
  const activityPagination = activityData?.pagination ?? { page: 1, pages: 1, total: 0 };
  const history = historyData?.history ?? [];

  const { data: timeStats, isLoading: timeLoading, error: timeError } = useQuery({
    queryKey: ["admin-user-time", panel?.user?._id],
    queryFn: () => panel?.user?._id ? adminGetUserTimeStats(panel.user._id) : null,
    enabled: !!panel,
  });

  const fmtDuration = (ms: number) => {
    if (!ms) return "0m";
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `${day}d ${hr % 24}h`;
    if (hr > 0) return `${hr}h ${min % 60}m`;
    return `${min}m`;
  };

  const blockMut = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => adminBlockUser(id, message),
    onSuccess: () => {
      toast.success("User blocked.");
      setBlockTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Block failed."),
  });

  const unblockMut = useMutation({
    mutationFn: (blockedId: string) => adminUnblockUser(blockedId),
    onSuccess: () => {
      toast.success("User unblocked.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Unblock failed."),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => adminDeleteUser(userId),
    onSuccess: () => {
      toast.success("User deleted.");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed."),
  });

  const openPanel = (user: any, mode: PanelMode) => {
    setPanel({ user, mode });
    setPanelPage(1);
  };

  const ActionIcon = ({ action, className }: { action: string; className?: string }) => {
    switch (action) {
      case "PROFILE_UPDATED": return <User className={className} />;
      case "EMAIL_CHANGED": return <Mail className={className} />;
      case "PASSWORD_CHANGED": return <Key className={className} />;
      case "ORDER_CON_EMAIL_CHANGED": return <Mail className={className} />;
      case "ACCOUNT_DELETED": return <Trash2 className={className} />;
      case "LOGIN": return <Key className={className} />;
      case "LOGOUT": return <LogOut className={className} />;
      case "USER_DELETED": return <Trash2 className={className} />;
      case "ORDER_STATUS_CHANGED": return <Package className={className} />;
      default: return <ClipboardList className={className} />;
    }
  };

  const ACTION_COLORS: Record<string, string> = {
    PROFILE_UPDATED: "#eab308", EMAIL_CHANGED: "#3b82f6", PASSWORD_CHANGED: "#8b5cf6",
    LOGIN: "#10b981", LOGOUT: "#ef4444", USER_DELETED: "#f97316",
    ORDER_STATUS_CHANGED: "#3b82f6", ACCOUNT_DELETED: "#ef4444",
  };

  const formatAction = (a: string) => a.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

  return (
    <div className="space-y-8 relative">
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass"></span> Identity
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Users<span className="text-brass">.</span>
        </h2>
      </div>

      {/* Stats */}
      {stats && Object.keys(stats).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats.total ?? 0 },
            { label: "Admins", value: stats.admins ?? 0 },
            { label: "Blocked", value: stats.blocked ?? 0 },
            { label: "Active (7d)", value: stats.active7d ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-5">
              <p className="eyebrow text-muted-foreground mb-2">{label}</p>
              <p className="font-display text-3xl font-bold text-foreground leading-none tracking-tight">{value.toLocaleString()}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search users by name or email…"
          className="w-full pl-12 pr-4 py-3.5 bg-card shadow-e1 border border-border rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all"
        />
      </div>

      {/* Users table */}
      {isLoading ? (
        <PanelTableSkeleton rows={8} cols={4} />
      ) : users.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card shadow-e1 border border-border rounded-2xl flex flex-col items-center">
          <User className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">{debouncedSearch ? "No users match your search." : "No users found."}</p>
        </motion.div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-4">
          {users.map((user: any) => (
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} key={user._id} className="bg-card shadow-e1 hover:shadow-e2 transition-shadow duration-300 border border-border rounded-xl p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                {/* User info */}
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="size-12 rounded-xl bg-secondary/80 border border-border flex items-center justify-center shrink-0 shadow-sm">
                    {user.authProvider === "google" ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                ) : panel?.mode === "tier" ? (
                  <TierPanel user={panel.user} onDone={() => { setPanel(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />
                ) : (
                      <User className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="font-bold text-foreground text-lg tracking-tight leading-none">{user.name}</p>
                      {user.role === "admin" && (() => {
                        const role = getAdminRole(user.email);
                        if (role) {
                          const RoleIcon = role.icon === "code" ? Code : role.icon === "zap" ? Zap : role.icon === "palette" ? Palette : null;
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-tight border ${role.bg} ${role.border} ${role.color} shadow-sm`}>
                              {RoleIcon && <RoleIcon className="size-3.5" strokeWidth={2} />}
                              <span>{role.title}</span>
                              {role.subtitle && <><span className="opacity-50 mx-0.5">·</span><span className="font-normal opacity-70">{role.subtitle}</span></>}
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] uppercase tracking-widest font-bold bg-coal text-bone px-2 py-0.5 rounded border border-coal">Admin</span>
                        );
                      })()}
                      {user.isBlocked && (
                        <span className="text-[10px] uppercase tracking-widest font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded">Blocked</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mt-1">{user.email}</p>
                    <div className="flex gap-4 mt-2.5 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Clock className="size-3" /> Seen: {timeAgo(user.lastActiveAt ?? user.lastSeen)}</span>
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Tag className="size-3" /> Joined: {fmtFull(user.createdAt)}</span>
                      {user.tier && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border
                          ${user.tier === "platinum" ? "bg-purple-500/10 text-purple-600 border-purple-500/30" :
                            user.tier === "gold" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" :
                            user.tier === "silver" ? "bg-gray-400/10 text-gray-500 border-gray-400/30" :
                            "bg-amber-700/10 text-amber-700 border-amber-700/30"}`}
                        >
                          <Award className="size-3" /> {user.tier}
                        </span>
                      )}
                      {!user.isBlocked && user.tierAssignedManually && (
                        <span className="text-[10px] font-medium text-muted-foreground">(manual)</span>
                      )}
                      {user.customDiscountPercent > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          -{user.customDiscountPercent}%
                        </span>
                      )}
                      {(user.stats?.orderCount ?? user.totalOrdersCount) > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {(user.stats?.orderCount ?? user.totalOrdersCount)} orders
                          {user.stats?.totalSpent > 0 && (
                            <span className="text-coal/50"> · Rs {Number(user.stats.totalSpent).toLocaleString()}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2.5 flex-wrap shrink-0">
                  <button
                    onClick={() => openPanel(user, "history")}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-border bg-card rounded-lg hover:bg-secondary transition-colors text-foreground shadow-sm"
                  >
                    <Clock className="size-3.5" /> History
                  </button>
                  <button
                    onClick={() => openPanel(user, "activity")}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-border bg-card rounded-lg hover:bg-secondary transition-colors text-foreground shadow-sm"
                  >
                    <ClipboardList className="size-3.5" /> Activity
                  </button>
                  <button
                    onClick={() => openPanel(user, "time")}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-brass/30 bg-brass/5 text-brass rounded-lg hover:bg-brass/10 transition-colors shadow-sm"
                  >
                    <Timer className="size-3.5" /> Time
                  </button>
                  <button
                    onClick={() => { setPanel(null); setTimeout(() => openPanel(user, "tier"), 50); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-brass/30 bg-brass/5 text-brass rounded-lg hover:bg-brass/10 transition-colors shadow-sm"
                  >
                    <Award className="size-3.5" /> Tier
                  </button>
                  <button
                    onClick={() => { setPanel(null); setTimeout(() => openPanel(user, "edit"), 50); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-brass/30 bg-brass/5 text-brass rounded-lg hover:bg-brass/10 transition-colors shadow-sm"
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setGiftTarget(user)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 rounded-lg hover:bg-emerald-500/10 transition-colors shadow-sm"
                  >
                    <Gift className="size-3.5" /> Gift
                  </button>
                  {!user.isBlocked && user.role !== "admin" && (
                    <button
                      onClick={() => setBlockTarget(user)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-amber-500/30 bg-amber-500/5 text-amber-600 rounded-lg hover:bg-amber-500/10 transition-colors shadow-sm"
                    >
                      <Ban className="size-3.5" /> Block
                    </button>
                  )}
                  {user.role !== "admin" && (
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-red-500/30 bg-red-500/5 text-red-600 rounded-lg hover:bg-red-500/10 transition-colors shadow-sm"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Blocked & deleted accounts — no longer in the users collection, so
          they must be surfaced here or they vanish from the panel entirely */}
      {(blocked.length > 0 || deleted.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow text-muted-foreground flex items-center gap-2">
              <span className="w-3 h-px bg-brass"></span> Closed Accounts
              <span className="text-[10px] font-mono text-muted-foreground/50">({blocked.length} blocked · {deleted.length} deleted)</span>
            </p>
          </div>
          <div className="space-y-2.5">
            {blocked.map((b: any) => (
              <div key={b._id} className="bg-card shadow-e1 border border-amber-500/25 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm leading-tight">{b.name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.email}{b.message ? ` — “${b.message}”` : ""}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Blocked {timeAgo(b.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => unblockMut.mutate(b._id)}
                    disabled={unblockMut.isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                  >
                    {unblockMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    Unblock
                  </button>
                </div>
              </div>
            ))}
            {deleted.length > 0 && (
              <p className="text-xs text-muted-foreground/60 pt-1">
                {deleted.length} deleted account{deleted.length === 1 ? "" : "s"} on record (cannot be restored).
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Side panel backdrop */}
      {panel && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setPanel(null)} />}
      <AnimatePresence>
        {panel && (
          <motion.div
            key="side-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card shadow-e3 border-l border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
            ref={panelRef}
          >
            {/* Panel header */}
            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border px-6 py-5 flex items-center justify-between shadow-sm shrink-0">
              <div>
                <p className="font-display font-bold text-xl tracking-tight text-foreground line-clamp-1">{panel.user.name}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1 flex items-center gap-2">
                  {panel.mode === "history" ? <><Clock className="size-3" /> Login History</> : panel.mode === "time" ? <><Timer className="size-3" /> Time Invested</> : panel.mode === "tier" ? <><Award className="size-3" /> Tier &amp; Discount</> : <><ClipboardList className="size-3" /> Activity Log</>}
                </p>
              </div>
              <div className="flex gap-3 items-center shrink-0">
                {panel.mode !== "edit" && panel.mode !== "time" && panel.mode !== "tier" && (
                  <button
                    onClick={() => { setPanel({ user: panel.user, mode: panel.mode === "history" ? "activity" : "history" }); setPanelPage(1); }}
                    className="text-xs font-bold px-3 py-1.5 border border-border bg-secondary/50 rounded-lg hover:bg-secondary transition-colors text-foreground shadow-sm"
                  >
                    View {panel.mode === "history" ? "Activity" : "History"}
                  </button>
                )}
                {(panel.mode === "time" || panel.mode === "tier") && (
                  <button
                    onClick={() => setPanel(null)}
                    className="text-xs font-bold px-3 py-1.5 border border-border bg-secondary/50 rounded-lg hover:bg-secondary transition-colors text-foreground shadow-sm"
                  >
                    Close
                  </button>
                )}
                <button onClick={() => setPanel(null)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Panel body */}
            <BodyErrorBoundary>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
              <div className="text-[10px] font-mono text-muted-foreground/40 mb-3 border border-dashed border-border/30 rounded-lg p-2 leading-relaxed">
                mode={panel.mode} user={panel.user._id?.slice(-6)}
              </div>
                {panel.mode === "edit" ? (
                  <EditProfilePanel user={panel.user} onDone={() => { setPanel(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />
                ) : panel.mode === "history" ? (
                  histLoading ? (
                    <div className="space-y-3" aria-hidden>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-secondary/30 border border-border rounded-xl p-4 space-y-2">
                          <div className="h-3.5 w-1/3 rounded animate-pulse bg-secondary" />
                          <div className="h-3 w-2/3 rounded animate-pulse bg-secondary" />
                        </div>
                      ))}
                    </div>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
                      <Clock className="size-8 mb-3 text-border" />
                      <p className="font-semibold text-foreground">No login history</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="eyebrow text-muted-foreground">{history.length} Login Records</p>
                      {history.map((h: any, i: number) => (
                        <div key={h._id ?? i} className="bg-secondary/30 border border-border rounded-xl p-4 hover:shadow-e1 transition-shadow">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="text-sm font-bold text-foreground mb-1">{fmtFull(h.loginAt)}</p>
                              {h.ipAddress && <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5"><MapPin className="size-3" /> {h.ipAddress}</p>}
                              {h.userAgent && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed" title={h.userAgent}>{h.userAgent}</p>}
                            </div>
                            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border shrink-0 ${h.authProvider === "google" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-card text-muted-foreground border-border"}`}>
                              {h.authProvider === "google" ? "Google" : "Email"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : panel.mode === "time" ? (
                  timeLoading ? (
                    <div className="grid grid-cols-2 gap-3" aria-hidden>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-secondary/30 border border-border rounded-xl p-4 space-y-2">
                          <div className="h-3 w-16 rounded animate-pulse bg-secondary" />
                          <div className="h-5 w-24 rounded animate-pulse bg-secondary" />
                        </div>
                      ))}
                    </div>
                  ) : timeError ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <Timer className="size-8 mb-3 text-border" />
                      <p className="font-semibold text-foreground">Failed to load time stats</p>
                      <p className="text-xs mt-1 opacity-60">{(timeError as any)?.message || "Unknown error"}</p>
                    </div>
                  ) : timeStats?.stats ? (
                    <div className="space-y-5">
                      <p className="eyebrow text-muted-foreground">Session Overview</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Total Time", value: fmtDuration(timeStats.stats.totalDurationMs) },
                          { label: "Sessions", value: timeStats.stats.totalSessions ?? 0 },
                          { label: "Active Now", value: timeStats.stats.activeSessions ?? 0 },
                          { label: "Last Active", value: timeStats.stats.lastActiveAt ? fmtFull(timeStats.stats.lastActiveAt) : "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-secondary/30 border border-border rounded-xl p-4">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">{label}</p>
                            <p className="font-display text-lg font-bold text-foreground leading-none tracking-tight">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <Timer className="size-5 text-amber-500 shrink-0" strokeWidth={2} />
                        <p className="text-xs text-amber-600 font-medium">Total time reflects finished sessions. Active sessions are counted once the user logs out or their session expires.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
                      <Timer className="size-8 mb-3 text-border" />
                      <p className="font-semibold text-foreground">No time data yet</p>
                    </div>
                  )
                ) : (
                  actLoading ? (
                    <div className="space-y-3" aria-hidden>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-secondary/30 border border-border rounded-xl p-4 flex items-center gap-4">
                          <div className="size-8 rounded-lg animate-pulse bg-secondary shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-1/2 rounded animate-pulse bg-secondary" />
                            <div className="h-3 w-1/3 rounded animate-pulse bg-secondary" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
                      <ClipboardList className="size-8 mb-3 text-border" />
                      <p className="font-semibold text-foreground">No activity records</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="eyebrow text-muted-foreground">{activityPagination.total} Activity Records</p>
                      {activityLogs.map((log: any, i: number) => {
                        const color = ACTION_COLORS[log.action] ?? "#64748b";
                        return (
                          <div key={log._id ?? i} className="bg-secondary/30 border border-border rounded-xl p-4 relative overflow-hidden hover:shadow-e1 transition-shadow group">
                            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l opacity-50 group-hover:opacity-100 transition-opacity" style={{ background: color }} />
                            <div className="pl-3">
                              <div className="flex items-center gap-2 mb-2">
                                <ActionIcon action={log.action} className="size-4" />
                                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border" style={{ background: `${color}10`, color, borderColor: `${color}30` }}>
                                  {formatAction(log.action)}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-foreground mb-2 leading-relaxed">{log.description}</p>
                              <div className="flex gap-4 flex-wrap">
                                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5"><Clock className="size-3" /> {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</span>
                                {log.ipAddress && <span className="text-[11px] font-mono font-bold text-muted-foreground flex items-center gap-1.5"><MapPin className="size-3" /> {log.ipAddress}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {activityPagination.pages > 1 && (
                        <div className="flex justify-center items-center gap-4 pt-4 border-t border-border mt-6">
                          <button onClick={() => setPanelPage((p) => Math.max(1, p - 1))} disabled={panelPage <= 1}
                            className="px-4 py-2 text-xs font-bold border border-border rounded-lg bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Prev</button>
                          <span className="text-xs font-bold text-muted-foreground flex items-center">{activityPagination.page} / {activityPagination.pages}</span>
                          <button onClick={() => setPanelPage((p) => Math.min(activityPagination.pages, p + 1))} disabled={panelPage >= activityPagination.pages}
                            className="px-4 py-2 text-xs font-bold border border-border rounded-lg bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Next</button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </BodyErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Block modal */}
        {blockTarget && (
          <BlockModal
            user={blockTarget}
            blocking={blockMut.isPending}
            onConfirm={(msg) => blockMut.mutate({ id: blockTarget._id, message: msg })}
            onCancel={() => !blockMut.isPending && setBlockTarget(null)}
          />
        )}

        {/* Delete modal */}
        {deleteTarget && (
          <DeleteModal
            user={deleteTarget}
            deleting={deleteMut.isPending}
            onConfirm={() => deleteMut.mutate(deleteTarget._id)}
            onCancel={() => !deleteMut.isPending && setDeleteTarget(null)}
          />
        )}

        {/* Gift voucher modal */}
        {giftTarget && (
          <GiftModal
            user={giftTarget}
            onClose={() => setGiftTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoyaltyPointsEditor({ user, onDone }: { user: any; onDone: () => void }) {
  const [points, setPoints] = useState(user.loyaltyPoints ?? 0);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => adminSetUserLoyaltyPoints(user._id, points, reason || undefined),
    onSuccess: (res) => { toast.success(res.message); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed."),
  });

  return (
    <div>
      <p className="eyebrow text-muted-foreground mb-2">Loyalty Points</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-24 px-3 py-2.5 border border-border rounded-lg text-sm font-bold text-center focus:outline-none focus:border-brass bg-card"
        />
        <span className="text-sm font-bold text-muted-foreground">pts</span>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || (points === user.loyaltyPoints && !reason)}
          className="px-4 py-2.5 text-sm font-bold bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
        >
          {mut.isPending ? "Saving…" : "Set Points"}
        </button>
      </div>
      <input
        type="text"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-2 w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-brass bg-card"
      />
      <p className="text-[10px] text-muted-foreground mt-1.5">
        Manually set the total loyalty points for this customer. Current: {user.loyaltyPoints ?? 0} pts.
      </p>
    </div>
  );
}

const TIER_OPTIONS = [
  { value: "bronze", label: "🥉 Bronze", color: "text-amber-700" },
  { value: "silver", label: "🥈 Silver", color: "text-gray-400" },
  { value: "gold", label: "🥇 Gold", color: "text-yellow-500" },
  { value: "platinum", label: "💎 Platinum", color: "text-purple-400" },
];

function TierPanel({ user, onDone }: { user: any; onDone: () => void }) {
  const [tier, setTier] = useState(user.tier ?? "bronze");
  const [discount, setDiscount] = useState(user.customDiscountPercent ?? 0);
  const [isManual, setIsManual] = useState(user.tierAssignedManually ?? false);
  const qc = useQueryClient();

  const tierMut = useMutation({
    mutationFn: () => adminSetUserTier(user._id, tier),
    onSuccess: (res) => { toast.success(res.message); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed."),
  });

  const discountMut = useMutation({
    mutationFn: () => adminSetUserDiscount(user._id, discount),
    onSuccess: (res) => { toast.success(res.message); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed."),
  });

  const resetMut = useMutation({
    mutationFn: () => adminResetUserTier(user._id),
    onSuccess: (res) => { toast.success(res.message); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed."),
  });

  return (
    <div className="space-y-6">
      {/* Current status */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5 flex items-center gap-4">
        <div className="text-3xl">{TIER_OPTIONS.find(t => t.value === user.tier)?.label ?? "🥉"}</div>
        <div>
          <p className="font-bold text-foreground text-lg capitalize">{user.tier ?? "bronze"}</p>
          <p className="text-xs text-muted-foreground">
            {user.totalOrdersCount ?? 0} orders · Rs {(user.totalSpentAmount ?? 0).toLocaleString()} spent
            {isManual && <span className="ml-2 text-amber-500 font-bold">(manual)</span>}
          </p>
        </div>
      </div>

      {/* Tier selector */}
      <div>
        <p className="eyebrow text-muted-foreground mb-2">Assign Tier</p>
        <div className="grid grid-cols-2 gap-2">
          {TIER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTier(opt.value); setIsManual(true); }}
              className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all text-left ${
                tier === opt.value
                  ? "bg-brass/10 border-brass text-brass"
                  : "bg-card border-border text-foreground hover:bg-secondary"
              }`}
            >
              <span className="block">{opt.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => tierMut.mutate()}
          disabled={tierMut.isPending || (tier === user.tier && !isManual)}
          className="mt-3 w-full px-4 py-2.5 text-sm font-bold bg-brass text-coal rounded-lg hover:bg-brass/90 disabled:opacity-50 transition-colors"
        >
          {tierMut.isPending ? "Saving…" : "Save Tier"}
        </button>
      </div>

      {/* Custom discount */}
      <div className="border-t border-border pt-5">
        <p className="eyebrow text-muted-foreground mb-2">Custom Discount</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={100}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="w-24 px-3 py-2.5 border border-border rounded-lg text-sm font-bold text-center focus:outline-none focus:border-brass bg-card"
          />
          <span className="text-sm font-bold text-muted-foreground">% off</span>
          <button
            onClick={() => discountMut.mutate()}
            disabled={discountMut.isPending}
            className="px-4 py-2.5 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {discountMut.isPending ? "Saving…" : "Set Discount"}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          This discount applies to every order this customer places.
        </p>
      </div>

      {/* Loyalty Points */}
      <div className="border-t border-border pt-5">
        <LoyaltyPointsEditor user={user} onDone={onDone} />
      </div>

      {/* Reset to auto */}
      {isManual && (
        <div className="border-t border-border pt-5">
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            className="text-sm font-bold text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-2"
          >
            {resetMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {resetMut.isPending ? "Resetting…" : "Reset to Auto (recalculate based on orders)"}
          </button>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <button onClick={onDone} className="w-full px-4 py-2.5 text-sm font-bold border border-border rounded-lg hover:bg-secondary transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

function EditProfilePanel({ user, onDone }: { user: any; onDone: () => void }) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [gender, setGender] = useState(user.gender ?? "");
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
  const [role, setRole] = useState(user.role ?? "user");
  const [isVerifiedCustomer, setIsVerifiedCustomer] = useState(user.isVerifiedCustomer ?? false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAvatar(data.avatar);
        toast.success("Avatar uploaded.");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdateUserProfile(user._id, {
        name: name || null,
        phone: phone || null,
        gender: gender || null,
        avatar: avatar || null,
        dateOfBirth: dateOfBirth || null,
        role,
        isVerifiedCustomer,
      });
      toast.success("Profile updated.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <p className="eyebrow text-muted-foreground">Edit Profile</p>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative size-16 rounded-full overflow-hidden bg-secondary shrink-0 grid place-items-center">
          {avatar ? (
            <img src={avatar} alt="" className="size-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <User className="size-6 text-muted-foreground" strokeWidth={1.2} />
          )}
          <label className="absolute inset-0 grid place-items-center bg-coal/0 hover:bg-coal/40 transition cursor-pointer rounded-full">
            {uploading ? <span className="text-white text-xs">...</span> : <Camera className="size-4 text-white opacity-0 hover:opacity-100 transition" />}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
          </label>
        </div>
        <div className="text-xs text-muted-foreground">Click to upload avatar</div>
      </div>

      <FField label="Name" value={name} onChange={setName} />
      <FField label="Phone" value={phone} onChange={setPhone} />
      <label className="block">
        <span className="eyebrow text-xs mb-1 block">Gender</span>
        <select value={gender} onChange={(e) => setGender(e.target.value)}
          className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card">
          <option value="">Select…</option>
          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow text-xs mb-1 block">Date of birth</span>
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
          className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card" />
      </label>
      <label className="block">
        <span className="eyebrow text-xs mb-1 block">Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="flex items-center gap-3 pt-2">
        <input type="checkbox" checked={isVerifiedCustomer} onChange={(e) => setIsVerifiedCustomer(e.target.checked)}
          className="size-4 accent-brass" />
        <span className="text-sm font-medium flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-emerald-500" /> Verified Customer (15+ orders)
        </span>
      </label>

      <div className="flex gap-3 pt-4">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-coal text-bone eyebrow px-5 py-2.5 hover:bg-brass hover:text-coal transition disabled:opacity-60 rounded-lg">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={onDone}
          className="eyebrow px-5 py-2.5 border border-border hover:bg-secondary transition rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FField({ label, value, onChange, className = "" }: {
  label: string; value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow text-xs mb-1 block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-brass" />
    </label>
  );
}
