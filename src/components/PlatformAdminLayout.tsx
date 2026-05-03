import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  Building2,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
  { to: "/admin/panel", icon: Building2, label: "Organisations" },
];

// ─── PlatformAdminLayout ──────────────────────────────────────────────────────

const PlatformAdminLayout = () => {
  const { user, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin", { replace: true });
  };

  // ── Sidebar content (shared desktop + mobile) ─────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Platform branding */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={fallbackLogo}
            alt="Rina's Fit"
            className="w-9 h-9 rounded-xl object-contain border border-border bg-background p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">
              Rina's Fit
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Platform Control
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <div className="pb-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">
            Management
          </p>
        </div>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: admin info + controls */}
      <div className="px-3 py-3 border-t border-border shrink-0 space-y-1">
        {/* Admin badge */}
        <div className="px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
              {user?.email}
            </p>
            <button
              onClick={toggle}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 ml-1"
              title={isDark ? "Light mode" : "Dark mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 dark:text-violet-300">
            <ShieldCheck className="w-3 h-3" /> Platform Admin
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ─────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-card border-r border-border flex flex-col h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card/90 backdrop-blur-sm shrink-0 z-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img
              src={fallbackLogo}
              alt="Rina's Fit"
              className="w-7 h-7 rounded-lg object-contain border border-border p-0.5"
            />
            <span className="text-sm font-semibold text-foreground">Platform Control</span>
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

export default PlatformAdminLayout;
