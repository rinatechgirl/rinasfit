import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import fallbackLogo from "@/assets/logo.jpeg";

const CustomerAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnTo = searchParams.get("returnTo") ?? "/customer/dashboard";
  const designId = searchParams.get("designId");
  const tenantId = searchParams.get("tenantId");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        // Sign up with customer role in metadata
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: "customer" },
          },
        });

        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error("Signup failed. Please try again.");

        // Create customer_accounts row
        const { error: accountError } = await supabase
          .from("customer_accounts")
          .insert({
            user_id: authData.user.id,
            full_name: fullName,
            email,
            phone: phone || null,
          });

        if (accountError) {
          console.warn("Account row error:", accountError.message);
        }

        toast.success("Account created! Welcome to Rina's Fit.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);

        // Ensure the signed-in user is actually a customer
        if (data.user?.user_metadata?.role !== "customer") {
          await supabase.auth.signOut();
          throw new Error("This account is not a customer account. Please use the business login.");
        }

        toast.success("Welcome back!");
      }

      // If they were adding to cart before login, do it now
      if (designId && tenantId) {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (userId) {
          await supabase.from("cart_items").upsert({
            customer_user_id: userId,
            design_id: designId,
            tenant_id: tenantId,
          });
          toast.success("Design added to your dashboard!");
        }
      }

      navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-3">
            <img src={fallbackLogo} alt="Rina's Fit" className="w-8 h-8 object-contain rounded-lg border border-border" />
            <div>
              <p className="font-semibold text-sm text-foreground">Rina's Fit</p>
              <p className="text-xs text-muted-foreground">Customer Portal</p>
            </div>
          </div>
        </div>

        {/* Design prompt banner */}
        {designId && (
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-sm text-foreground">
            {mode === "signup"
              ? "Create a free account to save this design and start your order."
              : "Sign in to save this design to your dashboard."}
          </div>
        )}

        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup"
              ? "Browse designs, place orders, and track your outfits."
              : "Sign in to your customer account."}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-lg border border-border p-1 gap-1">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signup" ? "Sign up" : "Sign in"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                type="text"
                placeholder="Ada Okafor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === "login"}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "login" && (
                <a
                  href="/reset-password"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </a>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "Min. 8 characters" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          {mode === "signup"
            ? "Already have an account? "
            : "New here? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="text-foreground font-medium hover:underline underline-offset-4"
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="text-xs text-center text-muted-foreground">
          Are you a fashion designer?{" "}
          <a href="/auth" className="text-foreground hover:underline underline-offset-4">
            Business login →
          </a>
        </p>
      </div>
    </div>
  );
};

export default CustomerAuth;
