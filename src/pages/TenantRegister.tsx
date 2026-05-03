import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  X,
  Check,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_DOMAIN = "rinasfit.com";
const IS_DEV =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

/**
 * Converts a business name into a URL-safe slug.
 * e.g. "Royal Tailors & Co." → "royal-tailors-co"
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Combined business registration form.
 *
 * This handles the full SelPay-style onboarding in one place:
 * 1. Creates the Supabase auth user (if not already signed in)
 * 2. Uploads the business logo (optional)
 * 3. Creates the tenant record with status: "approved"
 * 4. Links the user's profile to the tenant
 * 5. Assigns the "admin" role
 * 6. Redirects to the business's own subdomain dashboard
 *
 * ⚠️  IMPORTANT — Email confirmation:
 * If Supabase has "Confirm email" enabled, signUp() returns session: null
 * and the tenant creation steps cannot run until confirmation.
 * For the smoothest UX, disable email confirmation in:
 * Supabase Dashboard → Authentication → Email → Confirm email → OFF
 *
 * ⚠️  IMPORTANT — Logo storage:
 * Create a public bucket named "tenant-logos" in:
 * Supabase Dashboard → Storage → New bucket → Name: tenant-logos → Public: ON
 */
const TenantRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Logo upload
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "email-sent">("form");
  const [confirmedSlug, setConfirmedSlug] = useState("");

  // Auto-generate slug from business name (unless user manually changed it)
  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(generateSlug(businessName));
    }
  }, [businessName, slugManuallyEdited]);

  // Pre-fill email/name if user is already signed in (edge case)
  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.user_metadata?.full_name) setOwnerName(user.user_metadata.full_name);
  }, [user]);

  // ── Logo handlers ──────────────────────────────────────────────────────────

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, etc.).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB.");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanSlug = slug.trim().toLowerCase();

    // Client-side validation
    if (!cleanSlug) {
      toast.error("Business username is required.");
      return;
    }
    if (cleanSlug.length < 3) {
      toast.error("Business username must be at least 3 characters.");
      return;
    }
    if (!user) {
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      let userId = user?.id ?? null;
      let sessionAvailable = !!user;

      // ── Step 1: Create auth user (if not already signed in) ──────────────
      if (!user) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: ownerName },
          },
        });

        if (authError) throw new Error(authError.message);

        userId = authData.user?.id ?? null;
        sessionAvailable = !!authData.session;

        // Email confirmation is enabled — instruct user and stop here.
        // Tenant creation can't happen without an active session.
        if (!sessionAvailable) {
          setConfirmedSlug(cleanSlug);
          setStep("email-sent");
          setLoading(false);
          return;
        }
      }

      if (!userId) throw new Error("Could not create user account. Please try again.");

      // ── Step 2: Check slug availability ───────────────────────────────────
      const { data: existing } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", cleanSlug)
        .maybeSingle();

      if (existing) {
        throw new Error(
          "That business username is already taken. Please choose a different one."
        );
      }

      // ── Step 3: Upload logo (optional, non-blocking) ──────────────────────
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() ?? "png";
        const fileName = `${cleanSlug}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("tenant-logos")
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) {
          // Non-fatal — tenant is still created, logo can be set later in settings
          console.warn("Logo upload failed:", uploadError.message);
          toast.warning("Logo upload failed — you can add it later in settings.");
        } else {
          const { data: urlData } = supabase.storage
            .from("tenant-logos")
            .getPublicUrl(fileName);
          logoUrl = urlData.publicUrl;
        }
      }

      // ── Step 4: Create tenant (auto-approved) ─────────────────────────────
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          business_name: businessName,
          slug: cleanSlug,
          owner_name: ownerName,
          business_email: email || user?.email,
          status: "approved",   // ← Auto-approve on signup
          logo_url: logoUrl,
        })
        .select("id")
        .single();

      if (tenantError) throw new Error(tenantError.message);

      const tenantId = tenant.id;

      // ── Step 5: Link user profile to tenant ───────────────────────────────
      // The handle_new_user trigger already created the profile row on sign-up,
      // so we UPDATE (not upsert).  A bare upsert without onConflict:'user_id'
      // tries to INSERT, hits the unique constraint, and silently fails — leaving
      // profiles.tenant_id = null and causing every subsequent sign-in on the
      // main domain to redirect to /register-business instead of /dashboard.
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          tenant_id: tenantId,
          email: (email || user?.email) ?? "",
          full_name: ownerName,
        })
        .eq("user_id", userId);

      if (profileUpdateError) {
        // If the profile row somehow doesn't exist yet, fall back to insert.
        const { error: profileInsertError } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            tenant_id: tenantId,
            email: (email || user?.email) ?? "",
            full_name: ownerName,
          });
        if (profileInsertError) {
          console.warn("Profile insert fallback failed:", profileInsertError.message);
        }
      }

      // ── Step 6: Assign admin role ─────────────────────────────────────────
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin",
          tenant_id: tenantId,
        });

      if (roleError) {
        console.warn("Role insert:", roleError.message);
      }

      toast.success("Business account created! Redirecting to your dashboard…");

      // ── Step 7: Force session refresh ────────────────────────────────────
      // After writing to profiles + user_roles, we MUST refresh the session.
      // This triggers onAuthStateChange in useAuth, which re-runs
      // fetchUserContext and loads the new tenant_id + admin role.
      // Without this, the user arrives at /dashboard with no tenant context
      // and gets bounced back to /register-business.
      await supabase.auth.refreshSession();

      // Small delay so the toast is readable before navigation
      await new Promise((r) => setTimeout(r, 800));

      if (IS_DEV) {
        // On localhost, subdomains don't resolve — go to /dashboard directly.
        navigate("/dashboard", { replace: true });
      } else {
        window.location.href = `https://${cleanSlug}.${BASE_DOMAIN}/dashboard`;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Email confirmation pending screen ──────────────────────────────────────

  if (step === "email-sent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Confirm your email</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              We sent a confirmation link to{" "}
              <strong className="text-foreground">{email}</strong>. Click the link in
              your inbox to activate your account.
            </p>
          </div>
          <div className="p-4 bg-muted rounded-xl text-sm text-left space-y-1">
            <p className="text-muted-foreground">After confirming, sign in at:</p>
            <p className="font-mono font-medium text-foreground">
              {confirmedSlug}.{BASE_DOMAIN}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: disable email confirmation in Supabase Auth settings for a frictionless signup flow.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main registration form ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex">

      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-muted/40 border-r border-border items-center justify-center p-12">
        <div className="max-w-sm space-y-8">
          <img src={fallbackLogo} alt="Rina's Fit" className="w-10 h-10 object-contain" />
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground leading-snug">
              Set up your tailoring business today
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              You'll get your own branded portal at{" "}
              <span className="text-foreground font-medium">yourname.rinasfit.com</span> — ready in minutes.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "Branded subdomain with your logo",
              "Customer profiles & measurements",
              "Design library with photo uploads",
              "Invite staff and assign roles",
              "Reports available to admins",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-6 py-10">
          <div className="w-full max-w-md space-y-8">

            <div>
              <img
                src={fallbackLogo}
                alt="Rina's Fit"
                className="w-8 h-8 object-contain lg:hidden mb-6"
              />
              <h1 className="text-xl font-semibold text-foreground">Create your business account</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Already have an account?{" "}
                <a
                  href="/auth"
                  className="text-foreground font-medium hover:underline underline-offset-4"
                >
                  Sign in
                </a>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Business details ────────────────────────────────────── */}
              <section className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Business details
                </p>

                {/* Business name */}
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business name</Label>
                  <Input
                    id="business-name"
                    type="text"
                    placeholder="Royal Tailors"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>

                {/* Slug / subdomain */}
                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Business username{" "}
                    <span className="font-normal text-muted-foreground">— your subdomain</span>
                  </Label>
                  <div className="flex">
                    <Input
                      id="slug"
                      type="text"
                      placeholder="royaltailors"
                      value={slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setSlug(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                        );
                      }}
                      required
                      minLength={3}
                      maxLength={40}
                      className="rounded-r-none border-r-0 focus-visible:z-10"
                    />
                    <span className="inline-flex items-center px-3 border border-input bg-muted text-muted-foreground text-sm rounded-r-md shrink-0">
                      .rinasfit.com
                    </span>
                  </div>
                  {slug.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Your portal:{" "}
                      <span className="font-medium text-foreground">
                        {slug}.rinasfit.com
                      </span>
                    </p>
                  )}
                </div>

                {/* Logo upload */}
                <div className="space-y-2">
                  <Label>
                    Business logo{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="flex items-center gap-4">

                    {/* Preview circle */}
                    <div
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-foreground/30 transition-colors overflow-hidden bg-muted/30 shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5 mr-2" />
                        {logoFile ? "Change logo" : "Upload logo"}
                      </Button>
                      {logoFile && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-full justify-center"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground text-center">
                        PNG or JPG, max 2 MB
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </div>
                </div>
              </section>

              <div className="border-t border-border" />

              {/* ── Account details (hidden if already signed in) ────────── */}
              {!user ? (
                <section className="space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Your account
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="owner-name">Full name</Label>
                    <Input
                      id="owner-name"
                      type="text"
                      placeholder="Rina Mensah"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="rina@yourbusiness.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 8 chars"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          className="pr-9"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm">Confirm</Label>
                      <div className="relative">
                        <Input
                          id="confirm"
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repeat password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="pr-9"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirm ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  Creating business for{" "}
                  <strong className="text-foreground">{user.email}</strong>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create business account
              </Button>

              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                By creating an account you agree to our{" "}
                <a href="/terms" className="underline underline-offset-4">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline underline-offset-4">
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantRegister;
