import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Ruler,
  Palette,
  FolderOpen,
  BarChart3,
  Settings,
  UserCog,
  ShieldCheck,
  LogOut,
  X,
  Globe,
  BookOpen,
  Sun,
  Moon,
  MessageCircle,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import fallbackLogo from "@/assets/logo.jpeg";
import { MessageCircle, ShoppingCart } from "lucide-react";

// ─── Nav items ────────────────────────────────────────────────────────────────

const navItems = [
  { to: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { to: "/customers",    label: "Customers",     icon: Users           },
  { to: "/measurements", label: "Measurements",  icon: Ruler           },
  {
    label: "Customer Inbox",
    icon: "MessageCircle",   // import { MessageCircle } from "lucide-react"
    href: "/inbox",
    // No adminOnly restriction — all staff can chat with customers
  },
  {
    label: "Customer Orders",
    icon: "ShoppingCart",    // import { ShoppingCart } from "lucide-react"
    href: "/orders",
    // No adminOnly restriction — all staff can view/update orders
  },
  { to: "/designs",      label: "Designs",       icon: Palette         },
  { to: "/categories",   label: "Categories",    icon: FolderOpen      },
  { to: "/catalogue",    label: "Our Catalogue", icon: BookOpen        },
];

const adminItems = [
  { to: "/reports",  label: "Reports",  icon: BarChart3 },
  { to: "/staff",    label: "Staff",    icon: UserCog   },
  { to: "/settings", label: "Settings", icon: Settings  },
];

const platformAdminItems = [
  { to: "/admin", label: "Admin panel", icon: ShieldCheck },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  logoSrc?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AppSidebar = ({ open, onClose, logoSrc }: AppSidebarProps) => {
  const { tenant, user, isAdmin, isPlatformAdmin, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();

  const resolvedLogo = logoSrc ?? fallbackLogo;

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const NavItem = ({
    to,
    label,
    icon: Icon,
  }: {
    to: string;
    label: string;
    icon: React.ElementType;
  }) => (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out",
          "lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header: tenant branding */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={resolvedLogo}
              alt={tenant?.business_name ?? "Rina's Fit"}
              className="w-7 h-7 rounded-md object-contain border border-border bg-background shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = fallbackLogo;
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {tenant?.business_name ?? "Rina's Fit"}
              </p>
              <p className="text-xs text-muted-foreground truncate leading-tight">
                Rina's Fit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-muted-foreground hover:text-foreground p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}

          {/* Magazine — external link, visible to all */}
          <div className="pt-3 pb-1">
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3">
              Discover
            </p>
          </div>
          <a
            href="/magazine"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Globe className="w-4 h-4 shrink-0" />
            Fashion Magazine
          </a>

          {(isAdmin || isPlatformAdmin) && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3">
                  Admin
                </p>
              </div>
              {adminItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}

          {isPlatformAdmin && (
            <>
              <div className="pt-3 pb-1">
                <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-3">
                  Platform
                </p>
              </div>
              {platformAdminItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>

        {/* Footer: user info + theme toggle + sign out */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {user?.email ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {isAdmin ? "Admin" : "Staff"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Theme toggle */}
              <button
                onClick={toggle}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
