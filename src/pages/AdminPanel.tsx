import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Building2, Check, X, Ban, Trash2, RefreshCw,
  Search, Globe, Users, ShieldAlert, ShieldCheck,
  ChevronDown, ExternalLink, Loader2, Sliders,
} from "lucide-react";
import { format } from "date-fns";
import type { FeatureKey, TenantFeatures } from "@/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  business_name: string;
  slug: string;
  business_email: string;
  owner_name: string;
  phone: string | null;
  country: string | null;
  status: string;
  logo_url: string | null;
  created_at: string;
  member_count?: number;
  features?: TenantFeatures;
}

type FilterStatus = "all" | "pending" | "approved" | "suspended" | "rejected";

// ─── Feature definitions ──────────────────────────────────────────────────────

const FEATURE_DEFS: { key: FeatureKey; label: string; description: string }[] = [
  { key: "customers",    label: "Customers",    description: "Customer database management" },
  { key: "measurements", label: "Measurements", description: "Body measurement records" },
  { key: "designs",      label: "Designs",      description: "Design catalogue" },
  { key: "categories",   label: "Categories",   description: "Design categories" },
  { key: "orders",       label: "Orders",       description: "Order processing" },
  { key: "inbox",        label: "Inbox",        description: "Customer messaging" },
  { key: "reports",      label: "Reports",      description: "Analytics & reporting" },
  { key: "staff",        label: "Staff",        description: "Staff management" },
  { key: "catalogue",    label: "Catalogue",    description: "Public catalogue" },
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  pending:   { label: "Pending",   classes: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",        dot: "bg-amber-400" },
  approved:  { label: "Active",    classes: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800", dot: "bg-emerald-500" },
  suspended: { label: "Suspended", classes: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",                    dot: "bg-red-500" },
  rejected:  { label: "Rejected",  classes: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",          dot: "bg-slate-400" },
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sublabel, active, onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-card rounded-xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md ${
        active
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${active ? "bg-primary/15" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        {active && (
          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            Active filter
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5">{value.toLocaleString()}</p>
      {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </button>
  );
}

// ─── Feature toggles panel ────────────────────────────────────────────────────

function FeaturePanel({
  tenantId,
  features: initialFeatures,
  onSaved,
}: {
  tenantId: string;
  features: TenantFeatures | undefined;
  onSaved: () => void;
}) {
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(() => {
    const saved = initialFeatures ?? {};
    const result = {} as Record<FeatureKey, boolean>;
    FEATURE_DEFS.forEach(({ key }) => { result[key] = saved[key] !== false; });
    return result;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("tenant_features")
      .upsert({ tenant_id: tenantId, features, updated_at: new Date().toISOString() } as any, {
        onConflict: "tenant_id",
      });
    setSaving(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Feature flags updated.");
      onSaved();
    }
  };

  const allOn  = Object.values(features).every(Boolean);
  const allOff = Object.values(features).every((v) => !v);

  return (
    <div className="border-t border-border px-6 py-4 bg-muted/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">Feature flags</p>
          <span className="text-[10px] text-muted-foreground">(platform admin controls)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
            onClick={() => {
              const all = {} as Record<FeatureKey, boolean>;
              FEATURE_DEFS.forEach(({ key }) => { all[key] = true; });
              setFeatures(all);
            }}
            disabled={allOn}
          >
            Enable all
          </button>
          <span className="text-muted-foreground/30">·</span>
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
            onClick={() => {
              const none = {} as Record<FeatureKey, boolean>;
              FEATURE_DEFS.forEach(({ key }) => { none[key] = false; });
              setFeatures(none);
            }}
            disabled={allOff}
          >
            Disable all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
        {FEATURE_DEFS.map(({ key, label, description }) => (
          <div
            key={key}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${
              features[key]
                ? "bg-card border-border"
                : "bg-muted/40 border-dashed border-border/60"
            }`}
          >
            <div className="min-w-0">
              <p className={`text-xs font-medium ${features[key] ? "text-foreground" : "text-muted-foreground line-through"}`}>
                {label}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{description}</p>
            </div>
            <Switch
              checked={features[key]}
              onCheckedChange={(checked) =>
                setFeatures((prev) => ({ ...prev, [key]: checked }))
              }
              className="shrink-0"
              aria-label={`Toggle ${label}`}
            />
          </div>
        ))}
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
        {saving && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
        Save feature flags
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const AdminPanel = () => {
  const [tenants, setTenants]             = useState<Tenant[]>([]);
  const [filtered, setFiltered]           = useState<Tenant[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("all");
  const [search, setSearch]               = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showFeatures, setShowFeatures]   = useState<string | null>(null);

  // ── Fetch tenants ────────────────────────────────────────────────────────────
  const fetchTenants = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Member counts
    const { data: roleCounts } = await supabase.from("user_roles").select("tenant_id");
    const countMap: Record<string, number> = {};
    (roleCounts ?? []).forEach((r: any) => {
      countMap[r.tenant_id] = (countMap[r.tenant_id] ?? 0) + 1;
    });

    // Feature flags
    const { data: featureRows } = await supabase.from("tenant_features").select("tenant_id, features");
    const featureMap: Record<string, TenantFeatures> = {};
    (featureRows ?? []).forEach((r: any) => { featureMap[r.tenant_id] = r.features; });

    const enriched = (data ?? []).map((t: any) => ({
      ...t,
      member_count: countMap[t.id] ?? 0,
      features: featureMap[t.id] ?? undefined,
    })) as Tenant[];

    setTenants(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let result = tenants;
    if (filterStatus !== "all") result = result.filter((t) => t.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.business_name.toLowerCase().includes(q) ||
          t.owner_name.toLowerCase().includes(q) ||
          t.business_email.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [tenants, filterStatus, search]);

  const counts = {
    all:       tenants.length,
    pending:   tenants.filter((t) => t.status === "pending").length,
    approved:  tenants.filter((t) => t.status === "approved").length,
    suspended: tenants.filter((t) => t.status === "suspended").length,
  };

  // ── Actions ───────────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    const { error } = await supabase.from("tenants").update({ status } as any).eq("id", id);
    setActionLoading(null);
    if (error) toast.error(error.message);
    else { toast.success(`Organisation ${status}`); fetchTenants(); }
  };

  const deleteTenant = async (tenant: Tenant) => {
    if (!confirm(`Permanently delete "${tenant.business_name}" and ALL its data?\n\nThis cannot be undone.`)) return;
    setActionLoading(tenant.id + "delete");
    const { error } = await supabase.from("tenants").delete().eq("id", tenant.id);
    setActionLoading(null);
    if (error) toast.error(error.message);
    else { toast.success("Organisation deleted"); fetchTenants(); }
  };

  const IS_DEV = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const visitOrg = (slug: string) =>
    window.open(IS_DEV ? `/?tenant=${slug}` : `https://${slug}.rinasfit.com`, "_blank");

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
            Rina's Fit · Platform
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Platform Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all registered organisations and their feature access.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTenants} disabled={loading} className="gap-2 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Building2}  label="Total"     value={counts.all}       active={filterStatus === "all"}       onClick={() => setFilterStatus("all")} />
        <StatCard icon={ShieldAlert} label="Pending"   value={counts.pending}   active={filterStatus === "pending"}   onClick={() => setFilterStatus("pending")} />
        <StatCard icon={ShieldCheck} label="Active"    value={counts.approved}  active={filterStatus === "approved"}  onClick={() => setFilterStatus("approved")} />
        <StatCard icon={Ban}         label="Suspended" value={counts.suspended} active={filterStatus === "suspended"} onClick={() => setFilterStatus("suspended")} />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Organisations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length} {filterStatus !== "all" ? filterStatus : "total"}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, email, slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading organisations…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No organisations found.</p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-2 text-xs text-primary hover:underline underline-offset-4 cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((t) => {
              const cfg        = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending;
              const isExpanded = expandedId === t.id;
              const isActing   = actionLoading?.startsWith(t.id);
              const featuresShown = showFeatures === t.id;

              return (
                <div key={t.id}>

                  {/* ── Main row ───────────────────────────────────────────── */}
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">

                    {/* Logo */}
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      {t.logo_url ? (
                        <img
                          src={t.logo_url}
                          alt={t.business_name}
                          className="w-full h-full object-contain p-0.5"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-primary" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{t.business_name}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">{t.owner_name}</p>
                        <span className="text-muted-foreground/30">·</span>
                        <p className="text-xs text-muted-foreground truncate">{t.business_email}</p>
                      </div>
                    </div>

                    {/* Slug */}
                    <div className="hidden md:block shrink-0">
                      <p className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                        {t.slug}.rinasfit.com
                      </p>
                    </div>

                    {/* Members */}
                    <div className="hidden lg:flex items-center gap-1 shrink-0">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t.member_count} {t.member_count === 1 ? "member" : "members"}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="hidden xl:block shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "MMM d, yyyy")}
                      </p>
                    </div>

                    {/* Expand */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded cursor-pointer shrink-0"
                      aria-label="Toggle details"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {/* ── Expanded: actions + feature flags ─────────────────── */}
                  {isExpanded && (
                    <div>
                      {/* Action row */}
                      <div className="px-5 py-3 flex flex-wrap items-center gap-2 bg-muted/10 border-t border-border">

                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 cursor-pointer"
                          onClick={() => visitOrg(t.slug)}>
                          <Globe className="w-3 h-3" />
                          Visit
                          <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 cursor-pointer"
                          onClick={() => setShowFeatures(featuresShown ? null : t.id)}
                        >
                          <Sliders className="w-3 h-3" />
                          {featuresShown ? "Hide features" : "Manage features"}
                        </Button>

                        {t.status === "pending" && (
                          <>
                            <Button size="sm" className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              disabled={!!isActing} onClick={() => updateStatus(t.id, "approved")}>
                              <Check className="w-3 h-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                              disabled={!!isActing} onClick={() => updateStatus(t.id, "rejected")}>
                              <X className="w-3 h-3" /> Reject
                            </Button>
                          </>
                        )}

                        {t.status === "approved" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 cursor-pointer"
                            disabled={!!isActing} onClick={() => updateStatus(t.id, "suspended")}>
                            <Ban className="w-3 h-3" /> Suspend
                          </Button>
                        )}

                        {(t.status === "suspended" || t.status === "rejected") && (
                          <Button size="sm" className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            disabled={!!isActing} onClick={() => updateStatus(t.id, "approved")}>
                            <Check className="w-3 h-3" />
                            {t.status === "suspended" ? "Reactivate" : "Approve anyway"}
                          </Button>
                        )}

                        {/* Metadata (mobile) */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground md:hidden flex-wrap">
                          <span className="font-mono text-primary">{t.slug}</span>
                          {t.country && <span>{t.country}</span>}
                          <span>{t.member_count} members</span>
                        </div>

                        <div className="flex-1" />

                        <Button size="sm" variant="ghost"
                          className="h-7 text-xs gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          disabled={!!isActing} onClick={() => deleteTenant(t)}>
                          <Trash2 className="w-3 h-3" /> Delete
                        </Button>
                      </div>

                      {/* Feature flags panel */}
                      {featuresShown && (
                        <FeaturePanel
                          tenantId={t.id}
                          features={t.features}
                          onSaved={fetchTenants}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {tenants.length} organisations
            </p>
            {filterStatus !== "all" && (
              <button
                onClick={() => setFilterStatus("all")}
                className="text-xs text-primary hover:underline underline-offset-4 cursor-pointer"
              >
                Show all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
