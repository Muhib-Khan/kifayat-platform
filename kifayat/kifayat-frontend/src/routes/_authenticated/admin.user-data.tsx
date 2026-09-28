import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminGenerateUserFinalData, adminGetUserFinalData } from "@/lib/admin.functions";
import { getAdminRole } from "@/lib/admin-roles";
import { motion } from "framer-motion";
import { Database, Search, Zap, User, Mail, MapPin, Phone, RefreshCw, ArchiveX, CheckCircle, Code, Palette } from "lucide-react";
import { PanelTableSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/user-data")({
  component: UserDataPage,
});

function UserDataPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = { timeout: null as ReturnType<typeof setTimeout> | null };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (debounceRef.timeout) clearTimeout(debounceRef.timeout);
    debounceRef.timeout = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 350);
  };

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (debouncedSearch) params.q = debouncedSearch;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-data", page, debouncedSearch],
    queryFn: () => adminGetUserFinalData(params),
  });

  const records = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, pages: 1, total: 0 };

  const generateMut = useMutation({
    mutationFn: adminGenerateUserFinalData,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-data"] }); },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <p className="eyebrow text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-px bg-brass"></span> Analytics
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            Lifetime Value<span className="text-brass">.</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-2 font-medium">Aggregated snapshot of every customer's entire order history.</p>
        </div>
        <button
          onClick={() => generateMut.mutate()}
          disabled={generateMut.isPending}
          className="flex items-center gap-2 px-6 py-3.5 text-sm font-bold bg-coal text-bone rounded-xl hover:bg-coal/90 disabled:opacity-50 transition-colors shadow-e1 whitespace-nowrap"
        >
          <RefreshCw className={`size-4 ${generateMut.isPending ? "animate-spin" : ""}`} />
          {generateMut.isPending ? "Generating Dataset…" : "Build Dataset"}
        </button>
      </div>

      {generateMut.isSuccess && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl px-5 py-4 text-sm font-bold flex items-center gap-3">
          <CheckCircle className="size-5" /> Dataset rebuilt and synced successfully.
        </motion.div>
      )}

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-card shadow-sm border border-border rounded-xl text-sm font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brass focus:ring-1 focus:ring-brass transition-all"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <PanelTableSkeleton rows={8} cols={5} />
      ) : records.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 bg-card shadow-e1 border border-border rounded-2xl flex flex-col items-center text-muted-foreground">
          <ArchiveX className="size-12 text-border mb-4" strokeWidth={1} />
          <p className="font-semibold text-lg text-foreground">{debouncedSearch ? "No users found matching that search." : `No aggregated data available.`}</p>
          {!debouncedSearch && <p className="text-sm mt-1">Click "Build Dataset" to aggregate order history.</p>}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border shadow-e1 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/30 eyebrow text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Identity</th>
                  <th className="px-6 py-4 font-semibold">Contact</th>
                  <th className="px-6 py-4 font-semibold text-center">Orders</th>
                  <th className="px-6 py-4 font-semibold text-center">Items</th>
                  <th className="px-6 py-4 font-semibold text-right">Lifetime Spent</th>
                  <th className="px-6 py-4 font-semibold">Latest Shipping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((d: any) => (
                  <tr key={d._id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground text-base tracking-tight mb-1">{d.name}</div>
                      {d.role === "admin" ? (() => {
                        const role = getAdminRole(d.email);
                        if (role) {
                          const RoleIcon = role.icon === "code" ? Code : role.icon === "zap" ? Zap : role.icon === "palette" ? Palette : null;
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold tracking-tight border ${role.bg} ${role.border} ${role.color} shadow-sm`}>
                              {RoleIcon && <RoleIcon className="size-3.5" strokeWidth={2} />}
                              <span>{role.title}</span>
                              {role.subtitle && <><span className="opacity-40 mx-0.5">·</span><span className="font-normal opacity-70">{role.subtitle}</span></>}
                            </span>
                          );
                        }
                        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold bg-coal text-bone border border-coal"><Zap className="size-3" /> Admin</span>;
                      })() : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold bg-secondary text-muted-foreground border-border border">
                          <User className="size-3" /> User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-bold text-muted-foreground flex items-center gap-2 mb-1.5"><Mail className="size-3" /> {d.email}</div>
                      {d.orderConEmail && <div className="text-[11px] font-mono font-medium text-muted-foreground/80 flex items-center gap-2"><RefreshCw className="size-3" /> {d.orderConEmail}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] bg-secondary border border-border rounded-md px-2 py-1 font-display text-lg font-bold text-foreground">{d.totalOrders}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-muted-foreground">{d.totalProductsBought}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-emerald-600 text-lg">PKR {Number(d.totalSpent ?? 0).toLocaleString("en-PK")}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                      {d.shippingName ? (
                        <div className="space-y-1 bg-secondary/50 border border-border p-2.5 rounded-lg">
                          <div className="font-bold text-foreground">{d.shippingName}</div>
                          <div className="flex items-center gap-1.5"><MapPin className="size-3 shrink-0" /> <span className="truncate">{d.courierCity}</span></div>
                          <div className="flex items-center gap-1.5 font-mono"><Phone className="size-3 shrink-0" /> {d.shippingPhone}</div>
                        </div>
                      ) : (
                        <span className="italic">No shipping history</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Previous</button>
          <span className="flex items-center text-sm font-bold text-muted-foreground">{pagination.page} / {pagination.pages}</span>
          <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
            className="px-5 py-2.5 text-sm font-bold border border-border rounded-xl bg-card text-foreground disabled:opacity-40 hover:bg-secondary transition-colors shadow-sm">Next</button>
        </div>
      )}
    </div>
  );
}
