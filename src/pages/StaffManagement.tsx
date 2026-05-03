import { useState } from "react";
import { useAuth, type PermissionKey, type StaffPermissions } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  UserPlus,
  Loader2,
  Trash2,
  Mail,
  ShieldCheck,
  User,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  ShieldAlert,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  user_id: string;
  role: "admin" | "staff";
  permissions: StaffPermissions | null;
  profile: { full_name: string; email: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "staff";
  status: string;
  created_at: string;
}

// ─── Permission definitions ───────────────────────────────────────────────────

const PERMISSION_DEFS: { key: PermissionKey; label: string; description: string }[] = [
  { key: "customers",    label: "Customers",    description: "View and manage customer records" },
  { key: "measurements", label: "Measurements", description: "Record and view body measurements" },
  { key: "designs",      label: "Designs",      description: "Create and manage design catalogue" },
  { key: "categories",   label: "Categories",   description: "Manage design categories" },
  { key: "orders",       label: "Orders",       description: "View and process customer orders" },
  { key: "inbox",        label: "Inbox",        description: "Read and reply to customer messages" },
  { key: "catalogue",    label: "Catalogue",    description: "View the public catalogue" },
];

// ─── Permissions dialog ───────────────────────────────────────────────────────

const PermissionsDialog = ({
  member,
  open,
  onOpenChange,
  tenantId,
}: {
  member: StaffMember;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
}) => {
  const queryClient = useQueryClient();

  // Build initial state: missing keys default to true (allowed)
  const [perms, setPerms] = useState<Record<PermissionKey, boolean>>(() => {
    const saved = member.permissions ?? {};
    const result = {} as Record<PermissionKey, boolean>;
    PERMISSION_DEFS.forEach(({ key }) => {
      result[key] = saved[key] !== false;
    });
    return result;
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_roles")
      .update({ permissions: perms } as any)
      .eq("user_id", member.user_id)
      .eq("tenant_id", tenantId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Permissions updated.");
      queryClient.invalidateQueries({ queryKey: ["staff", tenantId] });
      onOpenChange(false);
    }
  };

  const allOn  = Object.values(perms).every(Boolean);
  const allOff = Object.values(perms).every((v) => !v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Staff permissions
          </DialogTitle>
          <DialogDescription>
            Control which modules{" "}
            <strong>{member.profile?.full_name || member.profile?.email || "this staff member"}</strong>{" "}
            can access. Admins always have full access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {/* Bulk toggles */}
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => {
                const all = {} as Record<PermissionKey, boolean>;
                PERMISSION_DEFS.forEach(({ key }) => { all[key] = true; });
                setPerms(all);
              }}
              disabled={allOn}
            >
              Allow all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => {
                const none = {} as Record<PermissionKey, boolean>;
                PERMISSION_DEFS.forEach(({ key }) => { none[key] = false; });
                setPerms(none);
              }}
              disabled={allOff}
            >
              Revoke all
            </Button>
          </div>

          {PERMISSION_DEFS.map(({ key, label, description }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={perms[key]}
                onCheckedChange={(checked) =>
                  setPerms((prev) => ({ ...prev, [key]: checked }))
                }
                aria-label={`Toggle ${label} permission`}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const StaffManagement = () => {
  const { tenantId, user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen]       = useState(false);
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteRole, setInviteRole]       = useState<"admin" | "staff">("staff");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeTarget, setRemoveTarget]   = useState<StaffMember | null>(null);
  const [permTarget, setPermTarget]       = useState<StaffMember | null>(null);

  // ── Fetch staff ────────────────────────────────────────────────────────────
  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ["staff", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, permissions, profiles(full_name, email)")
        .eq("tenant_id", tenantId!);

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        user_id:     row.user_id,
        role:        row.role,
        permissions: row.permissions ?? null,
        profile:     row.profiles ?? null,
      })) as StaffMember[];
    },
  });

  // ── Fetch invitations ──────────────────────────────────────────────────────
  const { data: invitations = [], isLoading: invLoading } = useQuery({
    queryKey: ["invitations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, created_at")
        .eq("tenant_id", tenantId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  // ── Send invitation ────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !user) return;

    const email = inviteEmail.trim().toLowerCase();
    if (staff.some((s) => s.profile?.email === email)) {
      toast.error("This person is already a team member.");
      return;
    }
    if (invitations.some((i) => i.email === email)) {
      toast.error("An invitation has already been sent to this email.");
      return;
    }

    setInviteLoading(true);
    const { error } = await supabase.from("invitations").insert({
      email,
      role: inviteRole,
      tenant_id: tenantId,
      invited_by: user.id,
      status: "pending",
    });
    setInviteLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Invitation sent to ${email}.`);
      setInviteEmail("");
      setInviteRole("staff");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["invitations", tenantId] });
    }
  };

  // ── Change role ────────────────────────────────────────────────────────────
  const handleRoleChange = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "staff" }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated.");
      queryClient.invalidateQueries({ queryKey: ["staff", tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Remove staff ───────────────────────────────────────────────────────────
  const handleRemove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff member removed.");
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["staff", tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Revoke invitation ──────────────────────────────────────────────────────
  const handleRevoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation revoked.");
      queryClient.invalidateQueries({ queryKey: ["invitations", tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Access guard ───────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3">
        <ShieldAlert className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Only organisation admins can manage staff.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-3xl">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Staff management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite team members, assign roles, and control their access permissions.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="self-start sm:self-auto">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite staff
        </Button>
      </div>

      {/* ── Role legend ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-foreground">Org Admin</p>
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] ml-auto">
              Full access
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Full access to all features including reports, settings, staff management, and billing.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <User className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-foreground">Staff</p>
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] ml-auto">
              Custom access
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Access limited to modules you enable. Cannot access admin-only areas.
          </p>
        </div>
      </div>

      {/* ── Team members ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Team members
            <span className="ml-2 font-normal text-muted-foreground">({staff.length})</span>
          </h2>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["staff", tenantId] })}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            title="Refresh"
            aria-label="Refresh staff list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {staffLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No team members yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Invite someone using the button above.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {staff.map((member) => {
              const isSelf    = member.user_id === user?.id;
              const isOrgAdmin = member.role === "admin";
              const allowedCount = isOrgAdmin
                ? PERMISSION_DEFS.length
                : PERMISSION_DEFS.filter(({ key }) => member.permissions?.[key] !== false).length;

              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(member.profile?.full_name || member.profile?.email || "?")[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.profile?.full_name || "Unknown"}
                        {isSelf && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">(you)</span>
                        )}
                      </p>
                      {isOrgAdmin ? (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] h-4 px-1.5">
                          Org Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          Staff · {allowedCount}/{PERMISSION_DEFS.length} modules
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {member.profile?.email || "—"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Permissions — only for staff */}
                    {!isOrgAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setPermTarget(member)}
                        title="Manage permissions"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        Permissions
                      </Button>
                    )}

                    {/* Role selector */}
                    {!isSelf && (
                      <Select
                        value={member.role}
                        onValueChange={(val) =>
                          handleRoleChange.mutate({ userId: member.user_id, role: val as "admin" | "staff" })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3 h-3" /> Admin
                            </span>
                          </SelectItem>
                          <SelectItem value="staff">
                            <span className="flex items-center gap-1.5">
                              <User className="w-3 h-3" /> Staff
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {/* Remove */}
                    {!isSelf && (
                      <button
                        onClick={() => setRemoveTarget(member)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded cursor-pointer"
                        title="Remove member"
                        aria-label="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Pending invitations ───────────────────────────────────────────── */}
      {(invitations.length > 0 || invLoading) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Pending invitations
            <span className="ml-2 font-normal text-muted-foreground">({invitations.length})</span>
          </h2>

          {invLoading ? (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 capitalize">
                        {inv.role}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(inv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevoke.mutate(inv.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Invite dialog ─────────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They'll receive an invitation link. Staff permissions can be customised after they join.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as "admin" | "staff")}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">
                    <div>
                      <p className="font-medium">Staff</p>
                      <p className="text-xs text-muted-foreground">
                        Custom module access — set permissions after they join
                      </p>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div>
                      <p className="font-medium">Org Admin</p>
                      <p className="text-xs text-muted-foreground">
                        Full access including settings, reports, and staff management
                      </p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Permissions dialog ─────────────────────────────────────────────── */}
      {permTarget && tenantId && (
        <PermissionsDialog
          member={permTarget}
          open={!!permTarget}
          onOpenChange={(open) => { if (!open) setPermTarget(null); }}
          tenantId={tenantId}
        />
      )}

      {/* ── Remove confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeTarget?.profile?.full_name || removeTarget?.profile?.email}</strong>{" "}
              will lose access immediately. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemove.mutate(removeTarget.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StaffManagement;
