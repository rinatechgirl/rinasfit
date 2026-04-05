import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2, Users, Mail, Save, Trash2, Send, Clock,
  CheckCircle2, UserPlus, Upload, X, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import fallbackLogo from "@/assets/logo.jpeg";
import PaystackSettings from "@/components/customer/PaystackSettings";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

const OrganizationSettings = () => {
  const { tenant, tenantId, user, refreshTenant, isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("staff");
  const [inviting, setInviting] = useState(false);

  // ── Logo state ─────────────────────────────────────────────────────────────
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    business_name: "",
    business_email: "",
    owner_name: "",
    phone: "",
    address: "",
    country: "",
    description: "",
  });

  // Load tenant details
  useEffect(() => {
    if (tenant) {
      setForm({
        business_name: tenant.business_name || "",
        business_email: (tenant as any).business_email || "",
        owner_name: (tenant as any).owner_name || "",
        phone: (tenant as any).phone || "",
        address: (tenant as any).address || "",
        country: (tenant as any).country || "",
        description: (tenant as any).description || "",
      });
    }
  }, [tenant]);

  // ── Logo handlers ──────────────────────────────────────────────────────────

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
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

  const handleLogoUpload = async () => {
    if (!logoFile || !tenantId || !tenant) return;
    setLogoUploading(true);

    try {
      const ext = logoFile.name.split(".").pop() ?? "png";
      const fileName = `${(tenant as any).slug}-${Date.now()}.${ext}`;

      // Delete old logo if it exists
      if ((tenant as any).logo_url) {
        const oldPath = (tenant as any).logo_url.split("/tenant-logos/")[1];
        if (oldPath) {
          await supabase.storage.from("tenant-logos").remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("tenant-logos")
        .getPublicUrl(fileName);

      const logoUrl = urlData.publicUrl;

      // Save to tenant record
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ logo_url: logoUrl } as any)
        .eq("id", tenantId);

      if (updateError) throw new Error(updateError.message);

      toast.success("Logo updated successfully.");
      removeLogo();
      await refreshTenant();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveCurrentLogo = async () => {
    if (!tenantId || !(tenant as any).logo_url) return;

    if (!confirm("Remove your organisation logo? The default logo will be shown instead.")) return;

    setLogoUploading(true);
    try {
      const oldPath = (tenant as any).logo_url.split("/tenant-logos/")[1];
      if (oldPath) {
        await supabase.storage.from("tenant-logos").remove([oldPath]);
      }

      const { error } = await supabase
        .from("tenants")
        .update({ logo_url: null } as any)
        .eq("id", tenantId);

      if (error) throw new Error(error.message);

      toast.success("Logo removed.");
      await refreshTenant();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  // ── Team & invitations ─────────────────────────────────────────────────────

  const fetchMembers = async () => {
    if (!tenantId) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("id, user_id, role")
      .eq("tenant_id", tenantId);

    if (!roles || roles.length === 0) { setMembers([]); return; }

    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", userIds);

    const merged = roles.map(r => {
      const profile = profiles?.find(p => p.user_id === r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        email: profile?.email || "",
        full_name: profile?.full_name || "",
      };
    });
    setMembers(merged);
  };

  const fetchInvitations = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setInvitations((data as Invitation[]) ?? []);
  };

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [tenantId]);

  // Save business details
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const { error } = await supabase
      .from("tenants")
      .update({
        business_name: form.business_name.trim(),
        business_email: form.business_email.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        country: form.country.trim() || null,
        description: form.description.trim() || null,
      } as any)
      .eq("id", tenantId);

    if (error) toast.error(error.message);
    else {
      toast.success("Organization details updated.");
      await refreshTenant();
    }
    setSaving(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !user) return;
    setInviting(true);

    const { error } = await supabase
      .from("invitations")
      .insert({
        tenant_id: tenantId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: user.id,
      } as any);

    if (error) {
      toast.error(error.message.includes("duplicate") ? "This email has already been invited" : error.message);
    } else {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      fetchInvitations();
    }
    setInviting(false);
  };

  const deleteInvitation = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Invitation removed"); fetchInvitations(); }
  };

  const removeMember = async (member: TeamMember) => {
    if (member.user_id === user?.id) { toast.error("You cannot remove yourself"); return; }
    if (!confirm(`Remove ${member.full_name || member.email} from the organization?`)) return;

    const { error: roleErr } = await supabase.from("user_roles").delete().eq("id", member.id);
    if (roleErr) { toast.error(roleErr.message); return; }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ tenant_id: null } as any)
      .eq("user_id", member.user_id);

    if (profileErr) toast.error(profileErr.message);
    else { toast.success("Member removed"); fetchMembers(); }
  };

  const updateMemberRole = async (member: TeamMember, newRole: string) => {
    if (member.user_id === user?.id) { toast.error("You cannot change your own role"); return; }
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole } as any)
      .eq("id", member.id);
    if (error) toast.error(error.message);
    else { toast.success("Role updated"); fetchMembers(); }
  };

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="w-3.5 h-3.5 text-warning" />;
    if (status === "accepted") return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
    return null;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Only organization admins can access settings.</p>
      </div>
    );
  }

  // Current logo to display (new preview takes priority over saved logo)
  const currentLogoSrc = logoPreview ?? (tenant as any)?.logo_url ?? fallbackLogo;
  const hasSavedLogo = !!(tenant as any)?.logo_url;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Organization Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your business details and team</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="w-4 h-4" /> General
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" /> Team
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="w-4 h-4" /> Invitations
          </TabsTrigger>
        </TabsList>

        {/* ── General Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-4">

          {/* Logo Card */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Organisation Logo</CardTitle>
              <CardDescription>
                This logo appears on your branded login page and in the app sidebar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

                {/* Logo preview */}
                <div className="w-24 h-24 rounded-xl border-2 border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={currentLogoSrc}
                    alt="Organisation logo"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = fallbackLogo;
                    }}
                  />
                </div>

                {/* Upload controls */}
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
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleLogoUpload}
                          disabled={logoUploading}
                        >
                          {logoUploading
                            ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Uploading…</>
                            : <><Save className="w-3.5 h-3.5 mr-2" />Save logo</>
                          }
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeLogo}
                          disabled={logoUploading}
                        >
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

          {/* Business details card */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Business Details</CardTitle>
              <CardDescription>Update your organization information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input
                      value={form.business_name}
                      onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Email *</Label>
                    <Input
                      type="email"
                      value={form.business_email}
                      onChange={(e) => setForm({ ...form, business_email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Owner Name *</Label>
                    <Input
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Team Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Team Members</CardTitle>
              <CardDescription>
                {members.length} member{members.length !== 1 ? "s" : ""} in your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No team members found.</p>
              ) : (
                <div className="space-y-3">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">{m.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.user_id === user?.id ? (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        ) : (
                          <>
                            <Select value={m.role} onValueChange={(v) => updateMemberRole(m, v)}>
                              <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" onClick={() => removeMember(m)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Badge className={
                          m.role === "admin"
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                        }>
                          {m.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invitations Tab ───────────────────────────────────────────────── */}
        <TabsContent value="invitations">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Invite Team Member
                </CardTitle>
                <CardDescription>
                  Send an invitation to join your organization. The invited person must create
                  an account, then their pending invitation will be automatically accepted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@email.com"
                      required
                    />
                  </div>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-full sm:w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={inviting} className="gap-2">
                    <Send className="w-4 h-4" />
                    {inviting ? "Sending..." : "Invite"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Sent Invitations</CardTitle>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No invitations sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {statusIcon(inv.status)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{inv.email}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(inv.created_at), "MMM d, yyyy")} • {inv.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={
                            inv.status === "pending"  ? "bg-warning/20 text-warning" :
                            inv.status === "accepted" ? "bg-success/20 text-success" :
                            "bg-muted text-muted-foreground"
                          }>
                            {inv.status}
                          </Badge>
                          {inv.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteInvitation(inv.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsTrigger value="payment">Payment</TabsTrigger>
        <TabsContent value="payment">
          <PaystackSettings />
        </TabsContent>
        
      </Tabs>
    </div>
  );
};

export default OrganizationSettings;
