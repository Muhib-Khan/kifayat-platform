import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminGetActivityLogs } from "@/lib/admin.functions";
import { motion } from "framer-motion";
import { 
  Key, LogOut, Trash2, User, Package, Plus, Edit2, XCircle, 
  Settings, ClipboardList, Mail, MapPin, Search, Clock, Filter
} from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/activity-logs")({
  component: ActivityLogsPage,
});

const ActionIcon = ({ action, className }: { action: string; className?: string }) => {
  switch (action) {
    case "LOGIN": return <Key className={className} />;
    case "LOGOUT": return <LogOut className={className} />;
    case "USER_DELETED": return <Trash2 className={className} />;
    case "USER_ROLE_CHANGED": return <User className={className} />;
    case "ORDER_STATUS_CHANGED": return <Package className={className} />;
    case "PRODUCT_ADDED": return <Plus className={className} />;
    case "PRODUCT_UPDATED": return <Edit2 className={className} />;
    case "PRODUCT_DELETED": return <XCircle className={className} />;
    case "SETTINGS_UPDATED": return <Settings className={className} />;
    case "ACTIVITY_LOGS_VIEWED": return <ClipboardList className={className} />;
    case "PROFILE_UPDATED": return <User className={className} />;
    case "EMAIL_CHANGED": return <Mail className={className} />;
    case "PASSWORD_CHANGED": return <Key className={className} />;
    case "ORDER_CON_EMAIL_CHANGED": return <Mail className={className} />;
    case "ACCOUNT_DELETED": return <Trash2 className={className} />;
    default: return <ClipboardList className={className} />;
  }
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "#10b981", LOGOUT: "#ef4444", USER_DELETED: "#f97316", USER_ROLE_CHANGED: "#8b5cf6",
  ORDER_STATUS_CHANGED: "#3b82f6", PRODUCT_ADDED: "#10b981", PRODUCT_UPDATED: "#eab308",
  PRODUCT_DELETED: "#ef4444", SETTINGS_UPDATED: "#6366f1", ACTIVITY_LOGS_VIEWED: "#64748b",
  PROFILE_UPDATED: "#eab308", EMAIL_CHANGED: "#3b82f6", PASSWORD_CHANGED: "#8b5cf6",
  ORDER_CON_EMAIL_CHANGED: "#06b6d4", ACCOUNT_DELETED: "#ef4444",
};

const fmtFull = (v: string) => v ? new Date(v).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const formatAction = (a: string) => a.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

function ActivityLogsPage() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (filter !== "all") params.action = filter;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity-logs", page, filter],
    queryFn: () => adminGetActivityLogs(params),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass"></span> Audit trail
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Activity Logs<span className="text-brass">.</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-2 font-medium">Record of all user and admin actions across the platform.</p>
      </div>

      {/* Filter + stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card shadow-e1 border border-border rounded-xl p-4">
        <div className="flex gap-4 items-center text-sm font-bold text-foreground">
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
            <span className="text-muted-foreground">Total records:</span> {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
            <span className="text-muted-foreground">Page:</span> {page} <span className="text-muted-foreground font-normal">/ {totalPages}</span>
          </div>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-auto appearance-none pl-9 pr-8 py-2.5 bg-background border border-border rounded-lg text-sm font-bold text-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-shadow shadow-sm cursor-pointer"
          >
            <option value="all">All Activities</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="USER_DELETED">User Deleted</option>
            <option value="PROFILE_UPDATED">Profile Updated</option>
            <option value="EMAIL_CHANGED">Email Changed</option>
            <option value="PASSWORD_CHANGED">Password Changed</option>
            <option value="ORDER_CON_EMAIL_CHANGED">Order Con Email</option>
            <option value="ACCOUNT_DELETED">Account Deleted</option>
            <option value="ORDER_STATUS_CHANGED">Order Status</option>
            <option value="SETTINGS_UPDATED">Settings</option>
          </select>
        </div>
      </motion.div>

      {/* Logs list */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : logs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card shadow-e1 border border-border rounded-2xl flex flex-col items-center">
          <Search className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">No records found.</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters.</p>
        </motion.div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }} className="space-y-3">
          {logs.map((log: any) => {
            const color = ACTION_COLORS[log.action] ?? "#64748b";
            return (
              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} key={log._id} className="bg-card shadow-sm hover:shadow-e1 transition-shadow duration-300 border border-border rounded-xl p-5 relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l opacity-50 group-hover:opacity-100 transition-opacity" style={{ background: color }} />
                
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3 pl-2">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg flex items-center justify-center border" style={{ background: `${color}10`, borderColor: `${color}30`, color }}>
                      <ActionIcon action={log.action} className="size-4" />
                    </div>
                    <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest border" style={{ background: `${color}10`, color, borderColor: `${color}30` }}>
                      {formatAction(log.action)}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5"><Clock className="size-3.5" /> {fmtFull(log.createdAt)}</span>
                </div>
                
                <p className="text-sm font-medium text-foreground mb-4 pl-2 leading-relaxed">{log.description}</p>
                
                <div className="flex gap-4 flex-wrap pl-2 bg-secondary/30 rounded-lg p-3 border border-border">
                  {log.adminName ? (
                    <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <User className="size-3.5 text-muted-foreground" /> {log.adminName} <span className="font-mono text-muted-foreground ml-1">({log.adminEmail})</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 italic">
                      <User className="size-3.5" /> User self-service action
                    </span>
                  )}
                  {log.ipAddress && (
                    <span className="text-[11px] font-mono font-bold text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {log.ipAddress}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm"
          >
            Previous
          </button>
          <span className="flex items-center text-sm font-bold text-muted-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
