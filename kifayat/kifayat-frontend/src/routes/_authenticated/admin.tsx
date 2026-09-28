import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, BadgePercent, BrainCircuit, Camera, ChartBar, Database, ArrowUpRight, ChevronRight, Menu, MessageSquareHeart, Package, PackageCheck, RefreshCw, Search, Settings, ShoppingBag, SlidersHorizontal, Star, Store, Target, Ticket, Trash2, Users, Wrench, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import "@/styles/admin-workspace.css";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useReceiptNotifications } from "@/hooks/use-receipt-notifications";
import { useAdminCancelNotifications } from "@/hooks/use-admin-cancel-notifications";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    const user = (context as any)?.user;
    if (!user || user.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
  pendingComponent: AdminPending,
});

function AdminPending() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-3 w-40 rounded animate-pulse bg-secondary" />
      <div className="h-10 w-64 max-w-full rounded animate-pulse bg-secondary" />
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse bg-secondary" />
        ))}
      </div>
      <div className="h-80 rounded-xl animate-pulse bg-secondary" />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-xl animate-pulse bg-secondary" />
        <div className="h-72 rounded-xl animate-pulse bg-secondary" />
      </div>
    </div>
  );
}

const navSections = [
  {
    section: "Overview",
    items: [
      { to: "/admin/", label: "Dashboard", icon: ChartBar },
      { to: "/admin/sellers", label: "Seller Monitoring", icon: Store },
    ],
  },
  {
    section: "Catalog",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/deleted-products", label: "Deleted Products", icon: Trash2 },
      { to: "/admin/product-hunting", label: "Product Hunting", icon: Target },
      { to: "/admin/low-stock", label: "Low Stock", icon: AlertTriangle },
      { to: "/admin/featured", label: "Featured Order", icon: Star },
    ],
  },
  {
    section: "Pricing",
    items: [
      { to: "/admin/margins", label: "Profit Margins", icon: BadgePercent },
      { to: "/admin/price-ranges", label: "Price Ranges", icon: SlidersHorizontal },
    ],
  },
  {
    section: "Orders",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/order-status", label: "Order Status", icon: PackageCheck },
      { to: "/admin/receipts", label: "Receipts", icon: Camera },
      { to: "/admin/hhc", label: "HHC Sync", icon: RefreshCw },
    ],
  },
  {
    section: "Customers",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/user-data", label: "User Data", icon: Database },
    ],
  },
  {
    section: "Reviews & Reports",
    items: [
      { to: "/admin/reviews", label: "Reviews", icon: Star },
      { to: "/admin/website-reviews", label: "Site Reviews", icon: MessageSquareHeart },
      { to: "/admin/defect-reports", label: "Defect Reports", icon: ShieldAlert },
      { to: "/admin/diagnostic", label: "Diagnostic", icon: Wrench },
    ],
  },
  {
    section: "System",
    items: [
      { to: "/admin/activity-logs", label: "Activity Logs", icon: Activity },
      { to: "/admin/ai", label: "AI Studio", icon: BrainCircuit },
      { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function AdminNav({ path, query, onQueryChange, sections, onNavigate }: {
  path: string;
  query: string;
  onQueryChange: (value: string) => void;
  sections: typeof navSections;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="admin-menu-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Find a section..." aria-label="Search admin menu" />
      </div>
      {sections.map(({ section, items }) => (
        <div className="admin-nav-group" key={section}>
          <p className="admin-nav-label">{section}</p>
          {items.map(({ to, label, icon: Icon }) => {
            const active = to === "/admin/" ? path === "/admin/" || path === "/admin" : path === to || path.startsWith(to + "/");
            return (
              <Link key={to} to={to as never} onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`admin-nav-link ${active ? "is-active" : ""}`}>
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
                {active && <ChevronRight size={14} className="ml-auto" aria-hidden="true" />}
              </Link>
            );
          })}
        </div>
      ))}
      {sections.length === 0 && <p className="admin-nav-empty" role="status">No matching sections. Try another search.</p>}
    </>
  );
}

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const { user } = useAuth();
  useReceiptNotifications();
  useAdminCancelNotifications();

  useEffect(() => { setMobileOpen(false); }, [path]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  const filteredSections = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return navSections;
    return navSections.map((s) => ({ ...s,
      items: s.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((s) => s.items.length > 0);
  }, [navQuery]);
  const currentSection = navSections.find((section) => section.items.some(({ to }) =>
    to === "/admin/" ? path === "/admin/" || path === "/admin" : path === to || path.startsWith(to + "/")));
  const currentLabel = currentSection?.items.find(({ to }) =>
    to === "/admin/" ? path === "/admin/" || path === "/admin" : path === to || path.startsWith(to + "/"))?.label ?? "Admin";

  const navigation = (
    <AdminNav path={path} query={navQuery} onQueryChange={setNavQuery}
      sections={filteredSections} onNavigate={() => setMobileOpen(false)} />
  );
  const brand = (
    <Link to="/admin" onClick={() => setMobileOpen(false)} className="admin-brand" aria-label="Kifayat admin dashboard">
      <span className="admin-brand-mark">k<span>.</span></span>
      <span><strong>Kifayat<span className="text-[#d8b775]">.</span></strong><small>ADMIN WORKSPACE</small></span>
    </Link>
  );
  const profile = (
    <div className="admin-profile">
      <span className="admin-avatar">{user?.name?.[0]?.toUpperCase() ?? "A"}</span>
      <div className="min-w-0"><p>{user?.name || "Administrator"}</p><small>{user?.title || "Administrator"}</small></div>
      <ShieldAlert size={16} className="ml-auto shrink-0 text-[#d8b775]" aria-hidden="true" />
    </div>
  );

  return (
    <div className="admin-workspace">
      <a href="#admin-content" className="admin-skip-link">Skip to content</a>
      <aside className="admin-sidebar">
        {brand}
        <nav aria-label="Admin navigation" className="admin-nav-scroll" data-lenis-prevent>{navigation}</nav>
        {profile}
      </aside>
      <div className="admin-workspace-body">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button type="button" className="admin-menu-toggle" aria-label="Open admin menu"><Menu size={20} /></button>
              </SheetTrigger>
              <SheetContent side="left" className="admin-mobile-drawer" data-lenis-prevent>
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <SheetDescription className="sr-only">Search and navigate your admin workspace.</SheetDescription>
                {brand}
                <nav aria-label="Mobile admin navigation" className="admin-nav-scroll">{navigation}</nav>
                {profile}
              </SheetContent>
            </Sheet>
            <div className="admin-breadcrumb"><span>{currentSection?.section ?? "Workspace"}</span><ChevronRight size={14} aria-hidden="true" /><strong>{currentLabel}</strong></div>
          </div>
          <Link to="/" className="admin-store-link">View store <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </header>
        <main id="admin-content" tabIndex={-1} className="admin-content">
          <Outlet />
        </main>
        <footer className="admin-workspace-footer"><span>Kifayat / Admin workspace</span><span>Made for the details.</span></footer>
      </div>
    </div>
  );
}
