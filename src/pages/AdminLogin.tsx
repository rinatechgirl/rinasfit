import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── AdminLogin ───────────────────────────────────────────────────────────────
// This page lives at /admin.
// It is NOT linked from anywhere in the public UI — platform admins know this URL.
// Only users who pass the is_platform_admin() RPC check are allowed through.

const AdminLogin = () => {
  const navigate = useNavigate();
  const { isPlatformAdmin, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already signed in as platform admin, go straight to panel
  if (!authLoading && isPlatformAdmin) {
    navigate("/admin/panel", { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Verify platform admin status — the ONLY check that matters here
    const { data: isPlatAdmin } = await supabase.rpc("is_platform_admin");

    if (isPlatAdmin !== true) {
      // Sign out immediately — wrong person, wrong page
      await supabase.auth.signOut();

      if (data.user?.user_metadata?.role === "customer") {
        toast.error("Customers should sign in at rinasfit.com/customer/auth.");
      } else {
        // Org admin or staff trying to use this page
        toast.error(
          "This login is for Rina's Fit platform administrators only. Please sign in through your organisation's portal."
        );
      }
      setLoading(false);
      return;
    }

    // Verified — go to admin panel
    navigate("/admin/panel", { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-background" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <img
                src={fallbackLogo}
                alt="Rina's Fit"
                className="w-5 h-5 object-contain rounded"
              />
              <span className="text-sm font-semibold text-foreground">Rina's Fit</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">Platform Admin</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Restricted access. Authorised personnel only.
            </p>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@rinasfit.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>

        {/* Back link — subtle, not prominent */}
        <div className="text-center">
          <a
            href="/"
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            ← Back to rinasfit.com
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
