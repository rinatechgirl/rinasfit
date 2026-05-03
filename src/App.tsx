import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CustomerAuthProvider, useCustomerAuth } from "@/hooks/useCustomerAuth";
import { getTenantSlugFromHostname } from "@/hooks/useTenantSlug";
import AppLayout from "@/components/AppLayout";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import Auth from "@/pages/Auth";
import AdminLogin from "@/pages/AdminLogin";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Measurements from "@/pages/Measurements";
import Designs from "@/pages/Designs";
import Categories from "@/pages/Categories";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";
import ResetPassword from "@/pages/ResetPassword";
import TenantRegister from "@/pages/TenantRegister";
import PendingApproval from "@/pages/PendingApproval";
import AdminPanel from "@/pages/AdminPanel";
import OrganizationSettings from "@/pages/OrganizationSettings";
import StaffManagement from "@/pages/StaffManagement";
import Landing from "@/pages/Landing";
import Magazine from "@/pages/Magazine";
import Catalogue from "@/pages/Catalogue";
import CustomerAuth from "@/pages/CustomerAuth";
import CustomerDashboard from "@/pages/CustomerDashboard";
import OrdersManagement from "@/pages/OrdersManagement";
import DesignerInbox from "@/components/customer/DesignerInbox";
import { queryClient } from "@/queryClient";

// ─── Branded loading screen ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background">
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="text-primary font-bold text-lg">R</span>
        </div>
        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping opacity-60" />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-primary" />
      </div>
      <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>
    </div>
  );
}

// ─── Designer route guards ────────────────────────────────────────────────────

/**
 * Requires authenticated designer/staff.
 * adminOnly: additionally restricts to org-admin or platform-admin.
 */
const ProtectedRoute = ({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) => {
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin && !isPlatformAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/**
 * Ensures the user belongs to an approved tenant.
 * Platform admins bypass (they have no tenant but have platform-wide access).
 */
const TenantGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, tenantId, tenant, isPlatformAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isPlatformAdmin) return <>{children}</>;
  const subdomainSlug = getTenantSlugFromHostname();
  if (!tenantId && !subdomainSlug) return <Navigate to="/register-business" replace />;
  if (tenant && tenant.status !== "approved") return <Navigate to="/pending-approval" replace />;
  if (tenantId && !tenant) return <LoadingScreen />;
  return <>{children}</>;
};

/**
 * Prevents already-registered users from hitting the business registration page.
 */
const RegisterGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isPlatformAdmin, tenantId } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isPlatformAdmin) return <Navigate to="/admin/panel" replace />;
  if (user && tenantId) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/**
 * Only verified platform admins may access this area.
 */
const PlatformAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isPlatformAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/admin" replace />;
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

/**
 * /auth gate — signed-in users are routed to their correct destination.
 * Platform admin → /admin/panel
 * Org/staff with tenant → /dashboard
 * Org/staff without tenant → /register-business (they need to register first)
 */
const AuthGate = () => {
  const { user, loading, isPlatformAdmin, tenantId } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && isPlatformAdmin) return <Navigate to="/admin/panel" replace />;
  if (user && tenantId) return <Navigate to="/dashboard" replace />;
  if (user) return <Navigate to="/register-business" replace />;
  return <Auth />;
};

/**
 * Landing page gate.
 *
 * On a TENANT SUBDOMAIN (slug.rinasfit.com):
 *   → Always send to /auth so TenantLogin shows the branded portal.
 *     If already logged in, TenantGuard + AppLayout handle it.
 *
 * On the MAIN DOMAIN (rinasfit.com):
 *   → Platform admin → /admin/panel
 *   → Logged-in user with tenant → /dashboard
 *   → Logged-in user WITHOUT tenant → stay on landing (no forced register)
 *   → Guest → show landing page
 */
const LandingGate = () => {
  const { user, loading, isPlatformAdmin, tenantId } = useAuth();
  const subdomainSlug = getTenantSlugFromHostname();

  if (loading) return <LoadingScreen />;

  // Tenant subdomain root URL — send to branded login/dashboard
  if (subdomainSlug) {
    if (user && tenantId) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/auth" replace />;
  }

  // Main platform domain
  if (user && isPlatformAdmin) return <Navigate to="/admin/panel" replace />;
  if (user && tenantId)        return <Navigate to="/dashboard" replace />;
  // Logged-in but no tenant: show landing so they can browse or register voluntarily
  return <Landing />;
};

// ─── Customer route guards ────────────────────────────────────────────────────

const CustomerAuthGate = ({ children }: { children: React.ReactNode }) => {
  const { customer, loading } = useCustomerAuth();
  if (loading) return <LoadingScreen />;
  if (!customer) return <Navigate to="/customer/auth" replace />;
  return <>{children}</>;
};

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CustomerAuthProvider>
            <Routes>

              {/* ── Public ── */}
              <Route path="/"               element={<LandingGate />} />
              <Route path="/auth"           element={<AuthGate />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/magazine"       element={<Magazine />} />
              <Route path="/catalogue"      element={<Catalogue />} />

              {/* ── Platform admin — dedicated login + panel with layout ── */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route
                element={
                  <PlatformAdminRoute>
                    <PlatformAdminLayout />
                  </PlatformAdminRoute>
                }
              >
                <Route path="/admin/panel" element={<AdminPanel />} />
              </Route>

              {/* ── Customer portal ── */}
              <Route path="/customer/auth" element={<CustomerAuth />} />
              <Route
                path="/customer/dashboard"
                element={
                  <CustomerAuthGate>
                    <CustomerDashboard />
                  </CustomerAuthGate>
                }
              />

              {/* ── Business registration (new org admin onboarding) ── */}
              <Route
                path="/register-business"
                element={
                  <RegisterGuard>
                    <TenantRegister />
                  </RegisterGuard>
                }
              />

              {/* ── Pending approval waiting room ── */}
              <Route
                path="/pending-approval"
                element={
                  <ProtectedRoute>
                    <PendingApproval />
                  </ProtectedRoute>
                }
              />

              {/* ── Authenticated org-admin / staff routes ── */}
              <Route
                element={
                  <TenantGuard>
                    <AppLayout />
                  </TenantGuard>
                }
              >
                {/* Available to all (feature + permission flags applied via sidebar) */}
                <Route path="/dashboard"     element={<Dashboard />} />
                <Route path="/customers"     element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/measurements"  element={<Measurements />} />
                <Route path="/designs"       element={<Designs />} />
                <Route path="/categories"    element={<Categories />} />
                <Route path="/inbox"         element={<DesignerInbox />} />
                <Route path="/orders"        element={<OrdersManagement />} />

                {/* Org-admin only */}
                <Route path="/reports"  element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute adminOnly><OrganizationSettings /></ProtectedRoute>} />
                <Route path="/staff"    element={<ProtectedRoute adminOnly><StaffManagement /></ProtectedRoute>} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </CustomerAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
