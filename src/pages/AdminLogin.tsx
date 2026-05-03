import React, { useState, useEffect } from "react";
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
  const { isPlatformAdmin, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already confirmed as platform admin
  useEffect(() => {
    if (!authLoading && isPlatformAdmin) {
      navigate("/admin/panel", { replace: true });
    }
  }, [authLoading, isPlatformAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Sign in
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      toast.error("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    // Verify platform admin status immediately after sign-in
    const { data: isPlatAdmin, error: rpcError } = await supabase.rpc("is_platform_admin");

    if (rpcError || isPlatAdmin !== true) {
      // Not a platform admin — sign them out immediately
      await supabase.auth.signOut();
      toast.error("Access denied. This login is for platform administrators only.");
      setLoading(false);
      return;
    }

    // Confirmed platform admin — navigate
    toast.success("Welcome back, Admin.");
    navigate("/admin/panel", { replace: true });
    setLoading(false);
  };

  // Show loading while auth context initialises
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Platform logo */}
          <div className="relative">
            <img
              src={fallbackLogo}
              alt="Rina's Fit"
              className="w-16 h-16 object-contain rounded-2xl border border-border bg-background p-1 shadow-sm"
            />
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shadow">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Rina's Fit
            </p>
            <h1 className="text-xl font-semibold text-foreground">Platform Admin</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Restricted access — authorised personnel only.
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
