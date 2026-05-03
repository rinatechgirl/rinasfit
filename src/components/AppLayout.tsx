import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, type PermissionKey, type FeatureKey } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  Ruler,
  Palette,
  FolderOpen,
  BookOpen,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  MessageCircle,
  Package,
  Sun,
  Moon,
  Menu,
  X,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";
import { cn } from "@/lib/utils";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── Nav item types ───────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  /** If set, both the feature flag and staff permission are checked */
  permKey?: PermissionKey;
  /** Feature key checked against platform-admin feature flags */
  featureKey?: FeatureKey;
  /** Visible only to org-admin and platform-admin */
  adminOnly?: boolean;
}

// ─── Navigation definitions ───────────────────────────────────────────────────

const CORE_ITEMS: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard"    },
  { to: "/customers",    icon: Users,           label: "Customers",    permKey: "customers",    featureKey: "customers"    },
  { to: "/measurements", icon: Ruler,           label: "Measurements", permKey: "measurements", featureKey: "measurements" },
  { to: "/designs",      icon: Palette,         label: "Designs",      permKey: "designs",      featureKey: "designs"      },
  { to: "/categories",   icon: FolderOpen,      label: "Categories",   permKey: "categories",   featureKey: "categories"   },
  { to: "/catalogue",    icon: BookOpen,        label: "Our Catalogue",permKey: "catalogue",    featureKey: "catalogue"    },
];

const WORK_ITEMS: NavItem[] = [
  { to: "/inbox",  icon: MessageCircle, label: "Customer Inbox",  permKey: "inbox",  featureKey: "inbox"  },
  { to: "/orders", icon: Package,       label: "Customer Orders", permKey: "orders", featureKey: "orders" },
];

const DISCOVER_ITEMS: NavItem[] = [
  { to: "/magazine", icon: Globe, label: "Fashion Magazine" },
];

// Admin-only — visible only to org-admin or platform-admin; feature-gated too
const ADMIN_ITEMS: NavItem[] = [
  { to: "/reports",  icon: BarChart3, label: "Reports",  adminOnly: true, featureKey: "reports" },
  { to: "/staff",    icon: UserCog,   label: "Staff",    adminOnly: true, featureKey: "staff"   },
  { to: "/settings", icon: Settings,  label: "Settings", adminOnly: true },
];

// ─── Role label helper ────────────────────────────────────────────────────────

function roleLabel(isPlatformAdmin: boolean, isAdmin: boolean): string {
  if (isPlatformAdmin) return "Platform Admin";
  if (isAdmin) return "Org Admin";
  return "Staff";
}

// ─── Role badge colours ───────────────────────────────────────────────────────

function roleBadgeClass(isPlatformAdmin: boolean, isAdmin: boolean): string {
  if (isPlatformAdmin) return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  if (isAdmin)         return "bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300";
  return                      "bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400";
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

const AppLayout = () => {
  const { user, tenant, isAdmin, isPlatformAdmin, hasPermission, isFeatureEnabled, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const orgLogoSrc = (tenant as any)?.logo_url ?? fallbackLogo;
  const orgName    = tenant?.business_name ?? "Rina's Fit";

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  // ── Determine whether a nav item should be shown ─────────────────────────────
  const isItemVisible = (item: NavItem): boolean => {
    if (item.adminOnly && !isAdmin && !isPlatformAdmin) return false;
    if (item.featureKey && !isFeatureEnabled(item.featureKey)) return false;
    if (item.permKey && !hasPermission(item.permKey)) return false;
    return true;
  };

  // ── Single nav link ───────────────────────────────────────────────────────────
  const NavLinkItem = ({ item }: { item: NavItem }) => {
    if (!isItemVisible(item)) return null;
    const Icon = item.icon;
    return (
      <Link
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
          isActive(item.to)
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  // ── Section label ─────────────────────────────────────────────────────────────
  const SectionLabel = ({ label }: { label: string }) => (
    <div className="pt-4 pb-1">
      <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
        {label}
      </p>
    </div>
  );

  // ── Sidebar content (shared between desktop + mobile) ─────────────────────────
  const SidebarContent = () => {
    const visibleWorkItems    = WORK_ITEMS.filter(isItemVisible);
    const visibleDiscoverItems = DISCOVER_ITEMS.filter(isItemVisible);
    const visibleAdminItems   = ADMIN_ITEMS.filter(isItemVisible);

    return (
      <div className="flex flex-col h-full">

        {/* ── Organisation branding ─────────────────────────────────────────── */}
        <div className="px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src={orgLogoSrc}
                alt={orgName}
                className="w-9 h-9 rounded-xl object-contain border border-border bg-background p-0.5"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">{orgName}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Rina's Fit</p>
            </div>
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

          {/* Core */}
          {CORE_ITEMS.filter(isItemVisible).map((item) => (
            <NavLinkItem key={item.to} item={item} />
          ))}

          {/* Work */}
          {visibleWorkItems.length > 0 && (
            <>
              <SectionLabel label="Work" />
              {visibleWorkItems.map((item) => (
                <NavLinkItem key={item.to} item={item} />
              ))}
            </>
          )}

          {/* Discover */}
          {visibleDiscoverItems.length > 0 && (
            <>
              <SectionLabel label="Discover" />
              {visibleDiscoverItems.map((item) => (
                <NavLinkItem key={item.to} item={item} />
              ))}
            </>
          )}

          {/* Organisation Admin section */}
          {visibleAdminItems.length > 0 && (
            <>
              <SectionLabel label="Organisation" />
              {visibleAdminItems.map((item) => (
                <NavLinkItem key={item.to} item={item} />
              ))}
            </>
          )}

          {/* Platform Admin shortcut */}
          {isPlatformAdmin && (
            <>
              <SectionLabel label="Platform" />
              <Link
                to="/admin/panel"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                  isActive("/admin/panel")
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Platform Control
              </Link>
            </>
          )}
        </nav>

        {/* ── User footer ──────────────────────────────────────────────────── */}
        <div className="px-3 py-3 border-t border-border shrink-0 space-y-1">
          {/* Role + email */}
          <div className="px-3 py-2 rounded-lg bg-muted/40">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-medium text-foreground truncate flex-1">{user?.email}</p>
              <button
                onClick={toggle}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                title={isDark ? "Light mode" : "Dark mode"}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
              roleBadgeClass(isPlatformAdmin, isAdmin)
            )}>
              {roleLabel(isPlatformAdmin, isAdmin)}
            </span>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Desktop sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-card border-r border-border flex flex-col h-full shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card/90 backdrop-blur-sm shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={orgLogoSrc}
              alt={orgName}
              className="w-7 h-7 rounded-lg object-contain border border-border bg-background p-0.5 shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
            />
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">{orgName}</span>
          </div>
          <div className="w-10 shrink-0" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
