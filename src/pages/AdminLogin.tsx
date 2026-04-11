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

const AdminLogin = () => {
  const navigate = useNavigate();
  const { isPlatformAdmin, loading: authLoading, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState(false);

  // If already signed in as platform admin, go straight to panel
  if (!authLoading && isPlatformAdmin) {
    navigate("/admin/panel", { replace: true });
    return null;
  }

  // After sign-in, wait for auth context to confirm platform admin
  if (awaitingAuth && authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Verifying admin access…</span>
      </div>
    );
  }

  // If awaiting auth resolved but not platform admin, show error
  if (awaitingAuth && !authLoading && !isPlatformAdmin && user) {
    // Not a platform admin — sign them out
    supabase.auth.signOut();
    setAwaitingAuth(false);
    toast.error("This login is for platform administrators only.");
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Set awaiting flag and let auth context resolve
    setAwaitingAuth(true);
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

        {/* Back link */}
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
