import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";
import { cn } from "@/lib/utils";
import fallbackLogo from "@/assets/logo.jpeg";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers",    icon: Users,           label: "Customers" },
  { to: "/measurements", icon: Ruler,           label: "Measurements" },
  { to: "/designs",      icon: Palette,         label: "Designs" },
  { to: "/categories",   icon: FolderOpen,      label: "Categories" },
  { to: "/catalogue",    icon: BookOpen,        label: "Our Catalogue" },
];

const WORK_ITEMS: NavItem[] = [
  { to: "/inbox",        icon: MessageCircle,   label: "Customer Inbox" },
  { to: "/orders",       icon: Package,         label: "Customer Orders" },
];

const DISCOVER_ITEMS: NavItem[] = [
  { to: "/magazine",     icon: Globe,           label: "Fashion Magazine" },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/reports",      icon: BarChart3,       label: "Reports",        adminOnly: true },
  { to: "/staff",        icon: UserCog,         label: "Staff",          adminOnly: true },
  { to: "/settings",     icon: Settings,        label: "Settings",       adminOnly: true },
];

const AppLayout = () => {
  const { user, tenant, isAdmin, isPlatformAdmin, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Organisation logo: use org logo if set, otherwise platform fallback
  const orgLogoSrc = (tenant as any)?.logo_url ?? fallbackLogo;
  const orgName = tenant?.business_name ?? "Rina's Fit";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    if (item.adminOnly && !isAdmin && !isPlatformAdmin) return null;
    const Icon = item.icon;
    return (
      <Link
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          isActive(item.to)
            ? "bg-accent/15 text-accent font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / org name */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src={orgLogoSrc}
            alt={orgName}
            className="w-9 h-9 rounded-lg object-contain border border-border bg-background p-0.5"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{orgName}</p>
            <p className="text-[10px] text-muted-foreground">Rina's Fit</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => <NavLink key={item.to} item={item} />)}

        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
            Work
          </p>
        </div>
        {WORK_ITEMS.map((item) => <NavLink key={item.to} item={item} />)}

        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
            Discover
          </p>
        </div>
        {DISCOVER_ITEMS.map((item) => <NavLink key={item.to} item={item} />)}

        {(isAdmin || isPlatformAdmin) && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">
                Admin
              </p>
            </div>
            {ADMIN_ITEMS.map((item) => <NavLink key={item.to} item={item} />)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {isPlatformAdmin ? "Platform Admin" : isAdmin ? "Admin" : "Staff"}
            </p>
          </div>
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-56 bg-card border-r border-border flex flex-col h-full">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src={orgLogoSrc}
              alt={orgName}
              className="w-7 h-7 rounded-lg object-contain border border-border bg-background p-0.5"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
            />
            <span className="text-sm font-semibold text-foreground truncate max-w-[160px]">{orgName}</span>
          </div>
          <div className="w-10" /> {/* spacer */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
