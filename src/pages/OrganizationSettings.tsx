import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, CreditCard, Save, Upload, X, Loader2,
  Trash2, ShieldAlert, UserCog, ArrowRight,
} from "lucide-react";
import fallbackLogo from "@/assets/logo.jpeg";
import PaystackSettings from "@/components/customer/PaystackSettings";

// ─── Component ────────────────────────────────────────────────────────────────

const OrganizationSettings = () => {
  const { tenant, tenantId, refreshTenant, isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);

  // ── Logo state ─────────────────────────────────────────────────────────────
  const [logoFile, setLogoFile]         = useState<File | null>(null);
  const [logoPreview, setLogoPreview]   = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    business_name:  "",
    business_email: "",
    owner_name:     "",
    phone:          "",
    address:        "",
    country:        "",
    description:    "",
  });

  // Populate form when tenant loads
  useEffect(() => {
    if (tenant) {
      setForm({
        business_name:  tenant.business_name || "",
        business_email: (tenant as any).business_email || "",
        owner_name:     (tenant as any).owner_name || "",
        phone:          (tenant as any).phone || "",
        address:        (tenant as any).address || "",
        country:        (tenant as any).country || "",
        description:    (tenant as any).description || "",
      });
    }
  }, [tenant]);

  // ── Logo handlers ──────────────────────────────────────────────────────────

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB."); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const discardLogo = () => {
    setLogoFile(null);
    if (logoPreview) { URL.revokeObjectURL(logoPreview); setLogoPreview(null); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !tenantId || !tenant) return;
    setLogoUploading(true);
    try {
      const ext      = logoFile.name.split(".").pop() ?? "png";
      const fileName = `${(tenant as any).slug}-${Date.now()}.${ext}`;

      // Remove old logo
      if ((tenant as any).logo_url) {
        const oldPath = (tenant as any).logo_url.split("/tenant-logos/")[1];
        if (oldPath) await supabase.storage.from("tenant-logos").remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(fileName, logoFile, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from("tenant-logos").getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ logo_url: urlData.publicUrl } as any)
        .eq("id", tenantId);
      if (updateError) throw new Error(updateError.message);

      toast.success("Logo updated.");
      discardLogo();
      await refreshTenant();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveCurrentLogo = async () => {
    if (!tenantId || !(tenant as any)?.logo_url) return;
    if (!confirm("Remove your organisation logo? The default logo will be shown instead.")) return;
    setLogoUploading(true);
    try {
      const oldPath = (tenant as any).logo_url.split("/tenant-logos/")[1];
      if (oldPath) await supabase.storage.from("tenant-logos").remove([oldPath]);
      const { error } = await supabase.from("tenants").update({ logo_url: null } as any).eq("id", tenantId);
      if (error) throw new Error(error.message);
      toast.success("Logo removed.");
      await refreshTenant();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Save business details ──────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        business_name:  form.business_name.trim(),
        business_email: form.business_email.trim(),
        owner_name:     form.owner_name.trim(),
        phone:          form.phone.trim() || null,
        address:        form.address.trim() || null,
        country:        form.country.trim() || null,
        description:    form.description.trim() || null,
      } as any)
      .eq("id", tenantId);

    if (error) toast.error(error.message);
    else { toast.success("Settings saved."); await refreshTenant(); }
    setSaving(false);
  };

  // ── Access guard ───────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3">
        <ShieldAlert className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Only organisation admins can access settings.
        </p>
      </div>
    );
  }

  const currentLogoSrc = logoPreview ?? (tenant as any)?.logo_url ?? fallbackLogo;
  const hasSavedLogo   = !!(tenant as any)?.logo_url;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Organisation Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your business details and payment configuration.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Payment
          </TabsTrigger>
        </TabsList>

        {/* ── General tab ───────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-5">

          {/* Organisation logo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organisation Logo</CardTitle>
              <CardDescription>
                Appears on your branded login portal and in the app sidebar. Shown to staff and customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Preview */}
                <div className="w-24 h-24 rounded-xl border-2 border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={currentLogoSrc}
                    alt="Organisation logo"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
                  />
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                    >
                      <Upload className="w-3.5 h-3.5 mr-2" />
                      {logoFile ? "Change selection" : "Choose logo"}
                    </Button>

                    {logoFile && (
                      <>
                        <Button type="button" size="sm" onClick={handleLogoUpload} disabled={logoUploading}>
                          {logoUploading
                            ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Uploading…</>
                            : <><Save className="w-3.5 h-3.5 mr-2" />Save logo</>}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={discardLogo} disabled={logoUploading}>
                          <X className="w-3.5 h-3.5 mr-1" /> Cancel
                        </Button>
                      </>
                    )}

                    {hasSavedLogo && !logoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveCurrentLogo}
                        disabled={logoUploading}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove logo
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or WebP. Max 2 MB.
                    {logoFile && (
                      <span className="ml-2 text-foreground font-medium">
                        "{logoFile.name}" selected — click Save logo to apply.
                      </span>
                    )}
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
            </CardContent>
          </Card>

          {/* Business details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Details</CardTitle>
              <CardDescription>
                This information appears on your public catalogue and in your tenant portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s-bname">Business Name *</Label>
                    <Input
                      id="s-bname"
                      value={form.business_name}
                      onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-bemail">Business Email *</Label>
                    <Input
                      id="s-bemail"
                      type="email"
                      value={form.business_email}
                      onChange={(e) => setForm({ ...form, business_email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s-owner">Owner Name *</Label>
                    <Input
                      id="s-owner"
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-phone">Phone</Label>
                    <Input
                      id="s-phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="s-country">Country</Label>
                    <Input
                      id="s-country"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-address">Address</Label>
                    <Input
                      id="s-address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-desc">Description</Label>
                  <Textarea
                    id="s-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Tell customers about your business…"
                  />
                </div>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Staff management shortcut */}
          <Card className="border-dashed">
            <CardContent className="py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCog className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Staff & Permissions</p>
                    <p className="text-xs text-muted-foreground">
                      Invite team members and control what each staff member can access.
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <Link to="/staff">
                    Manage Staff <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payment tab ───────────────────────────────────────────────── */}
        <TabsContent value="payment">
          <PaystackSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;
