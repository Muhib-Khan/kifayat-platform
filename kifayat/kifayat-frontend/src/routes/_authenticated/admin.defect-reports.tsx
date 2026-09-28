import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminGetDefectiveReports,
  adminGetDefectiveReportById,
  adminUpdateDefectiveReportStatus,
} from "@/lib/admin.functions";
import { motion } from "framer-motion";
import { AlertTriangle, Image, Video, Search, Eye, X, ChevronLeft, CheckCircle, Clock, Ban, MessageSquare } from "lucide-react";
import { ListSkeleton, Skeleton, TextSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/defect-reports")({
  component: DefectReportsPage,
});

const statusIcon = (s: string) => {
  switch (s) {
    case "pending": return <Clock className="size-4 text-amber-500" />;
    case "reviewed": return <Eye className="size-4 text-blue-500" />;
    case "resolved": return <CheckCircle className="size-4 text-green-500" />;
    case "rejected": return <Ban className="size-4 text-red-500" />;
    default: return <Clock className="size-4 text-muted-foreground" />;
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case "pending": return "Pending";
    case "reviewed": return "Reviewed";
    case "resolved": return "Resolved";
    case "rejected": return "Rejected";
    default: return s;
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case "pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "reviewed": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "resolved": return "bg-green-500/10 text-green-600 border-green-500/20";
    case "rejected": return "bg-red-500/10 text-red-600 border-red-500/20";
    default: return "bg-secondary text-muted-foreground border-border";
  }
};

function ReportDetail({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["defective-report", reportId],
    queryFn: () => adminGetDefectiveReportById(reportId),
  });

  const [adminNote, setAdminNote] = useState("");

  const updateMut = useMutation({
    mutationFn: (payload: { status: string; adminNote?: string }) =>
      adminUpdateDefectiveReportStatus(reportId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["defective-reports"] });
      qc.invalidateQueries({ queryKey: ["defective-report", reportId] });
      toast.success("Report updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6" aria-hidden>
        <Skeleton className="h-4 w-24" />
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextSkeleton lines={2} />
            <TextSkeleton lines={2} />
            <TextSkeleton lines={2} />
            <TextSkeleton lines={2} />
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const report = data?.report;
  if (!report) {
    return <div className="text-center py-20 text-muted-foreground">Report not found.</div>;
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="size-4" /> Back to reports
      </button>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold tracking-tight">Report Details</h3>
          <span className={`text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${statusColor(report.status)}`}>
            {statusLabel(report.status)}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Name</p>
            <p className="font-medium">{report.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Email</p>
            <p className="font-medium">{report.email || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Phone</p>
            <p className="font-medium">{report.phone || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Submitted</p>
            <p className="font-medium">{new Date(report.createdAt).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>

        {report.product?.name && (
          <div className="bg-secondary/50 rounded-lg p-3.5">
            <p className="text-xs text-muted-foreground mb-1">Product</p>
            <p className="font-medium text-sm">{report.product.name}</p>
            {report.product.sku && <p className="text-xs text-muted-foreground">SKU: {report.product.sku}</p>}
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Description</p>
          <p className="text-sm leading-relaxed bg-secondary/30 rounded-lg p-3.5">{report.description}</p>
        </div>

        {report.videos && report.videos.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Video className="size-3.5" /> Videos ({report.videos.length})
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {report.videos.map((v: string, i: number) => (
                <video key={i} controls className="w-full rounded-lg border border-border bg-black max-h-48 object-contain">
                  <source src={v} />
                </video>
              ))}
            </div>
          </div>
        )}

        {report.images && report.images.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Image className="size-3.5" /> Photos ({report.images.length})
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {report.images.map((img: string, i: number) => (
                <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-border bg-secondary/50 hover:opacity-85 transition-opacity">
                  <img src={img} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {report.adminNote && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3.5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <MessageSquare className="size-3.5" /> Admin Note
            </p>
            <p className="text-sm">{report.adminNote}</p>
          </div>
        )}

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-sm font-semibold">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {["pending", "reviewed", "resolved", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => updateMut.mutate({ status: s, adminNote: adminNote || undefined })}
                disabled={updateMut.isPending}
                className={`px-4 h-9 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all ${
                  report.status === s
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                } disabled:opacity-50`}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Admin Note (optional)</label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder="Add a note for this report..."
              className="w-full px-3 py-2 rounded-md border border-border outline-none focus:border-primary text-sm resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DefectReportsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["defective-reports", page, statusFilter],
    queryFn: () => adminGetDefectiveReports(params),
  });

  const reports = data?.reports ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  if (selectedId) {
    return (
      <div className="space-y-8">
        <div>
          <p className="eyebrow text-muted-foreground flex items-center gap-2">
            <span className="w-3 h-px bg-brass"></span> Quality assurance
          </p>
          <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
            Defect Report<span className="text-brass">.</span>
          </h2>
        </div>
        <ReportDetail reportId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-muted-foreground flex items-center gap-2">
          <span className="w-3 h-px bg-brass"></span> Quality assurance
        </p>
        <h2 className="font-display italic text-3xl lg:text-4xl mt-2 tracking-tight">
          Defect Reports<span className="text-brass">.</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-2 font-medium">
          Review and diagnose defective product reports submitted by customers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { setStatusFilter(""); setPage(1); }}
          className={`px-4 h-9 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all ${
            !statusFilter ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {["pending", "reviewed", "resolved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`flex items-center gap-1.5 px-4 h-9 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all ${
              statusFilter === s ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
            }`}
          >
            {statusIcon(s)} {statusLabel(s)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : reports.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <AlertTriangle className="size-10 mx-auto mb-3 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm">No defect reports found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-e1 transition-shadow cursor-pointer"
              onClick={() => setSelectedId(r._id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-semibold text-sm">{r.name || "Anonymous"}</h4>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {r.product?.name && <span className="truncate max-w-[200px]">{r.product.name}</span>}
                    <span>{new Date(r.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="flex items-center gap-1">
                      <Image className="size-3" /> {r.images?.length || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Video className="size-3" /> {r.videos?.length || 0}
                    </span>
                  </div>
                </div>
                <button className="size-8 grid place-items-center rounded-lg hover:bg-secondary transition-colors shrink-0">
                  <Eye className="size-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`size-9 rounded-lg text-sm font-medium transition-all ${
                page === p ? "bg-foreground text-background" : "bg-card text-muted-foreground border border-border hover:border-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
