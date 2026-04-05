import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTenantSlugFromHostname } from "@/hooks/useTenantSlug";
import { useTenantBySlug } from "@/hooks/useTenantBySlug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight, Eye, EyeOff, ShieldAlert } from "lucide-react";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_DOMAIN = "rinasfit.com";
const IS_DEV =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

function redirectToTenantSubdomain(slug: string, path = "/auth") {
  if (IS_DEV) {
    window.location.href = `${path}?tenant=${slug}`;
  } else {
    window.location.href = `https://${slug}.${BASE_DOMAIN}${path}`;
  }
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Mode 1: Branded tenant login (slug.rinasfit.com/auth) ───────────────────

function TenantLogin({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading, notFound } = useTenantBySlug(slug);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // ── SECURITY CHECK: block platform admins from tenant login pages ─────────
    // Platform admins have no tenant and should only log in at rinasfit.com/auth
    const { data: isPlatAdmin } = await supabase.rpc("is_platform_admin");
    if (isPlatAdmin === true) {
      await supabase.auth.signOut();
      toast.error(
        "Platform administrators cannot sign in through a business portal. Please use the main Rina's Fit login."
      );
      setLoading(false);
      return;
    }

    // ── SECURITY CHECK: block customers from designer login ───────────────────
    if (data.user?.user_metadata?.role === "customer") {
      await supabase.auth.signOut();
      toast.error(
        "This is a designer login page. Please sign in at rinasfit.com/customer/auth."
      );
      setLoading(false);
      return;
    }

    navigate("/dashboard", { replace: true });
    setLoading(false);
  };

  if (tenantLoading) return <FullPageSpinner />;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="h-14 border-b border-border flex items-center px-6">
          <img src={fallbackLogo} alt="Rina's Fit" className="w-7 h-7 object-contain rounded-sm" />
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-64 h-44 mb-8 select-none">
            <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <ellipse cx="130" cy="168" rx="90" ry="8" fill="currentColor" className="text-muted/40"/>
              <circle cx="52" cy="54" r="16" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="38" y="72" width="28" height="38" rx="8" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="34" y="112" width="12" height="30" rx="6" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="54" y="112" width="12" height="30" rx="6" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="24" y="74" width="12" height="30" rx="6" fill="currentColor" className="text-muted-foreground/30" transform="rotate(-30 30 74)"/>
              <circle cx="208" cy="54" r="16" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="194" y="72" width="28" height="38" rx="8" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="190" y="112" width="12" height="30" rx="6" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="210" y="112" width="12" height="30" rx="6" fill="currentColor" className="text-muted-foreground/30"/>
              <rect x="220" y="74" width="12" height="30" rx="6" fill="currentColor" className="text-muted-foreground/30" transform="rotate(30 226 74)"/>
              <rect x="95" y="30" width="70" height="90" rx="14" fill="currentColor" className="text-primary/15"/>
              <text x="130" y="92" textAnchor="middle" fontSize="56" fontWeight="700" fill="currentColor" className="text-primary/40" fontFamily="sans-serif">?</text>
              <rect x="60" y="22" width="36" height="20" rx="6" fill="currentColor" className="text-muted-foreground/20"/>
              <polygon points="70,42 76,50 82,42" fill="currentColor" className="text-muted-foreground/20"/>
              <text x="78" y="36" textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground/60" fontFamily="sans-serif">hmm</text>
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-foreground">Sorry, organisation not found!</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm leading-relaxed">
            Looks like{" "}
            <span className="font-semibold text-foreground">{slug}.rinasfit.com</span>{" "}
            doesn't exist. Please check the link, or contact the business owner to get the correct address.
          </p>

          <div className="w-16 h-px bg-border my-6" />

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() =>
                IS_DEV ? navigate("/auth") : (window.location.href = `https://${BASE_DOMAIN}/auth`)
              }
            >
              Sign in to your organisation
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                IS_DEV
                  ? navigate("/register-business")
                  : (window.location.href = `https://${BASE_DOMAIN}/register-business`)
              }
            >
              Create an account
            </Button>
          </div>
        </div>

        <footer className="h-12 border-t border-border flex items-center justify-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Rina's Fit. All rights reserved.
          </p>
        </footer>
      </div>
    );
  }

  const logoSrc = tenant?.logo_url ?? fallbackLogo;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={logoSrc}
            alt={tenant?.business_name ?? slug}
            className="w-20 h-20 object-contain rounded-xl border border-border bg-background p-1 shadow-sm"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Sign in to {tenant?.business_name ?? slug}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Powered by Rina's Fit</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a
                href="/reset-password"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="text-center">
          <a
            href={IS_DEV ? "/auth" : `https://${BASE_DOMAIN}/auth`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Not your organisation? Go to main login
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Mode 2: Slug discovery (rinasfit.com/auth) ───────────────────────────────

function SlugDiscovery() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"business" | "admin">("business");

  const [slug, setSlug] = useState("");
  const [slugLoading, setSlugLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const handleSlugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) return;

    setSlugLoading(true);

    const { data } = await supabase
      .from("tenants")
      .select("id, slug, status")
      .eq("slug", cleanSlug)
      .maybeSingle();

    setSlugLoading(false);

    if (!data) {
      toast.error("Organisation not found. Check your business username and try again.");
      return;
    }
    if (data.status === "suspended") {
      toast.error("This account has been suspended. Please contact support.");
      return;
    }
    if (data.status === "pending") {
      toast.error("This account is pending approval. You will receive an email when it is ready.");
      return;
    }
    if (data.status === "rejected") {
      toast.error("This account application was rejected. Contact support for more information.");
      return;
    }

    redirectToTenantSubdomain(data.slug);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setAdminLoading(false);
      return;
    }

    // ── SECURITY CHECK: verify the user is actually a platform admin ──────────
    // Organisation admins have role = 'admin' in user_roles but are NOT platform admins.
    // They must NOT be able to access the platform admin panel.
    const { data: isPlatAdmin } = await supabase.rpc("is_platform_admin");

    if (isPlatAdmin !== true) {
      // Sign them out immediately — wrong login form
      await supabase.auth.signOut();

      // Give a helpful error based on who they likely are
      if (data.user?.user_metadata?.role === "customer") {
        toast.error(
          "This is the platform admin login. Customers should sign in at rinasfit.com/customer/auth"
        );
      } else {
        toast.error(
          "This account is not a platform administrator. Please sign in through your organisation's portal instead."
        );
      }
      setAdminLoading(false);
      return;
    }

    // Verified platform admin — proceed
    navigate("/admin", { replace: true });
    setAdminLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-muted/40 border-r border-border items-center justify-center p-12">
        <div className="max-w-sm space-y-8">
          <img src={fallbackLogo} alt="Rina's Fit" className="w-10 h-10 object-contain" />
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground leading-snug">
              Welcome back to Rina's Fit
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Your tailoring business management platform. Customers, measurements, and designs — all in one place.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "Your own branded subdomain",
              "Customer profiles & measurements",
              "Design library with photos",
              "Multi-staff with role management",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <img src={fallbackLogo} alt="Rina's Fit" className="w-8 h-8 object-contain lg:hidden" />

          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {mode === "business" ? "Sign in to your organisation" : "Platform admin sign in"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "business"
                ? "Enter your business username to continue"
                : "Restricted to Rina's Fit platform administrators only"}
            </p>
          </div>

          {/* Platform admin warning banner */}
          {mode === "admin" && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                This login is for <strong>Rina's Fit platform administrators only</strong>.
                If you're a fashion designer or organisation admin, please sign in through your business portal instead.
              </p>
            </div>
          )}

          {/* Business slug lookup */}
          {mode === "business" && (
            <form onSubmit={handleSlugSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="slug">Business username</Label>
                <div className="flex">
                  <Input
                    id="slug"
                    type="text"
                    placeholder="yourbusiness"
                    value={slug}
                    onChange={(e) =>
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                    required
                    autoFocus
                    className="rounded-r-none border-r-0 focus-visible:z-10"
                  />
                  <span className="inline-flex items-center px-3 border border-input bg-muted text-muted-foreground text-sm rounded-r-md shrink-0">
                    .rinasfit.com
                  </span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={slugLoading}>
                {slugLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Continue
              </Button>
            </form>
          )}

          {/* Platform admin email + password */}
          {mode === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@rinasfit.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={adminLoading}>
                {adminLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign in as Platform Admin
              </Button>
            </form>
          )}

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              New business?{" "}
              <a
                href="/register-business"
                className="text-foreground font-medium hover:underline underline-offset-4"
              >
                Create an account
              </a>
            </p>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "business" ? "admin" : "business");
                setSlug("");
                setEmail("");
                setPassword("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              {mode === "business"
                ? "Platform admin sign in →"
                : "← Back to business login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

const Auth = () => {
  const [searchParams] = useSearchParams();
  const subdomainSlug = getTenantSlugFromHostname();
  const devSlug = searchParams.get("tenant");
  const tenantSlug = subdomainSlug ?? devSlug;

  if (tenantSlug) return <TenantLogin slug={tenantSlug} />;
  return <SlugDiscovery />;
};

export default Auth;
