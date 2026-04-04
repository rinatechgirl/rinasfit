import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CustomerAuthProvider, useCustomerAuth } from "@/hooks/useCustomerAuth";
import { getTenantSlugFromHostname } from "@/hooks/useTenantSlug";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
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

// ── New customer portal pages ──────────────────────────────────────────────
import CustomerAuth from "@/pages/CustomerAuth";
import CustomerDashboard from "@/pages/CustomerDashboard";
import OrdersManagement from "@/pages/OrdersManagement";
import DesignerInbox from "@/components/customer/DesignerInbox";

const queryClient = new QueryClient();

// ─── Route guards — Designer side ─────────────────────────────────────────────

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

const PlatformAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isPlatformAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RegisterGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isPlatformAdmin, tenantId } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isPlatformAdmin) return <Navigate to="/admin" replace />;
  if (user && tenantId) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AuthGate = () => {
  const { user, loading, isPlatformAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && isPlatformAdmin) return <Navigate to="/admin" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Auth />;
};

const LandingGate = () => {
  const { user, loading, isPlatformAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && isPlatformAdmin) return <Navigate to="/admin" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
};

// ─── Route guards — Customer side ─────────────────────────────────────────────

const CustomerAuthGate = ({ children }: { children: React.ReactNode }) => {
  const { customer, loading } = useCustomerAuth();
  if (loading) return <LoadingScreen />;
  if (!customer) return <Navigate to="/customer/auth" replace />;
  return <>{children}</>;
};

// ─── Shared ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen text-muted-foreground">
      Loading…
    </div>
  );
}

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
              {/* ── Public routes ── */}
              <Route path="/" element={<LandingGate />} />
              <Route path="/auth" element={<AuthGate />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/magazine" element={<Magazine />} />
              <Route path="/catalogue" element={<Catalogue />} />

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

              {/* ── Business registration ── */}
              <Route
                path="/register-business"
                element={
                  <RegisterGuard>
                    <TenantRegister />
                  </RegisterGuard>
                }
              />

              {/* ── Pending approval ── */}
              <Route
                path="/pending-approval"
                element={
                  <ProtectedRoute>
                    <PendingApproval />
                  </ProtectedRoute>
                }
              />

              {/* ── Authenticated + tenant-scoped designer routes ── */}
              <Route
                element={
                  <TenantGuard>
                    <AppLayout />
                  </TenantGuard>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/measurements" element={<Measurements />} />
                <Route path="/designs" element={<Designs />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/inbox" element={<DesignerInbox />} />
                <Route path="/orders" element={<OrdersManagement />} />
                <Route
                  path="/reports"
                  element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>}
                />
                <Route
                  path="/settings"
                  element={<ProtectedRoute adminOnly><OrganizationSettings /></ProtectedRoute>}
                />
                <Route
                  path="/staff"
                  element={<ProtectedRoute adminOnly><StaffManagement /></ProtectedRoute>}
                />
                <Route
                  path="/admin"
                  element={<PlatformAdminRoute><AdminPanel /></PlatformAdminRoute>}
                />
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
