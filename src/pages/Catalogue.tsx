import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTenantSlugFromHostname } from "@/hooks/useTenantSlug";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Image as ImageIcon, RotateCcw, Globe } from "lucide-react";
import fallbackLogo from "@/assets/logo.jpeg";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantInfo {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
}

interface PublicDesign {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  back_view_image_url: string | null;
  gender: string | null;
  category_name: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Catalogue = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resolve slug from subdomain (production) or ?tenant= param (dev)
  const subdomainSlug = getTenantSlugFromHostname();
  const devSlug = searchParams.get("tenant");
  const slug = subdomainSlug ?? devSlug;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [designs, setDesigns] = useState<PublicDesign[]>([]);
  const [filtered, setFiltered] = useState<PublicDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGender, setActiveGender] = useState("All");
  const [detail, setDetail] = useState<PublicDesign | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  const genders = ["All", "Female", "Male", "Unisex"];

  // ── Fetch tenant + their public designs ────────────────────────────────────
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Get tenant info
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, business_name, slug, logo_url, description")
        .eq("slug", slug)
        .maybeSingle();

      if (!tenantData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTenant(tenantData as TenantInfo);

      // Get their public designs
      const { data: designData } = await supabase
        .from("designs")
        .select(`
          id,
          title,
          description,
          image_url,
          back_view_image_url,
          gender,
          categories ( name )
        `)
        .eq("tenant_id", tenantData.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      const mapped: PublicDesign[] = (designData ?? []).map((d: any) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        image_url: d.image_url,
        back_view_image_url: d.back_view_image_url,
        gender: d.gender,
        category_name: d.categories?.name ?? null,
      }));

      setDesigns(mapped);
      setFiltered(mapped);
      setLoading(false);
    };

    fetchData();
  }, [slug]);

  // ── Filter ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let result = designs;
    if (activeGender !== "All") result = result.filter((d) => d.gender === activeGender);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.category_name?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, activeGender, designs]);

  const toggleFlip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-xl font-semibold text-foreground">Catalogue not found</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          This organisation doesn't exist or hasn't published any designs yet.
        </p>
        <Button className="mt-6" onClick={() => navigate("/magazine")}>
          Browse all designs
        </Button>
      </div>
    );
  }

  const logoSrc = tenant?.logo_url ?? fallbackLogo;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                <div className="h-3 w-60 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Org branding */}
              <img
                src={logoSrc}
                alt={tenant?.business_name}
                className="w-16 h-16 rounded-xl object-contain border border-border bg-background p-1 shadow-sm"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
              />
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-foreground">
                  {tenant?.business_name}
                </h1>
                {tenant?.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    {tenant.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <Globe className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {slug}.rinasfit.com
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/customer/auth`)}
                >
                  Sign in to book
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search designs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {genders.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGender(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  activeGender === g
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        {loading ? (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="break-inside-avoid mb-4 rounded-xl bg-muted animate-pulse"
                style={{ height: `${200 + (i % 3) * 70}px` }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {designs.length === 0
                ? "No published designs yet."
                : "No designs match your filters."}
            </p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4">
            {filtered.map((d) => {
              const isFlipped = flippedCards.has(d.id);
              return (
                <div
                  key={d.id}
                  className="break-inside-avoid mb-4 rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setDetail(d)}
                >
                  <div className="relative overflow-hidden bg-muted">
                    <div className={`transition-opacity duration-500 ${isFlipped ? "opacity-0 absolute inset-0" : "opacity-100"}`}>
                      {d.image_url
                        ? <img src={d.image_url} alt={d.title} className="w-full object-cover" loading="lazy" />
                        : <div className="w-full h-48 flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/30" /></div>}
                    </div>
                    {d.back_view_image_url && (
                      <div className={`transition-opacity duration-500 ${isFlipped ? "opacity-100" : "opacity-0 absolute inset-0"}`}>
                        <img src={d.back_view_image_url} alt={`${d.title} back`} className="w-full object-cover" loading="lazy" />
                      </div>
                    )}
                    {(d.image_url && d.back_view_image_url) && (
                      <button
                        onClick={(e) => toggleFlip(d.id, e)}
                        className="absolute bottom-2 left-2 z-10 bg-card/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-foreground" />
                      </button>
                    )}
                    <span className="absolute bottom-2 right-2 text-[10px] bg-card/70 backdrop-blur-sm text-foreground px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {isFlipped ? "Back" : "Front"}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground leading-tight">{d.title}</p>
                    {d.category_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{d.category_name}</p>
                    )}
                    {d.gender && (
                      <span className="inline-block mt-1.5 text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                        {d.gender}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────────────────── */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{detail.title}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Front View</p>
                  <div className="aspect-[4/5] bg-muted rounded-lg overflow-hidden">
                    {detail.image_url
                      ? <img src={detail.image_url} alt="Front" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/30" /></div>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Back View</p>
                  <div className="aspect-[4/5] bg-muted rounded-lg overflow-hidden">
                    {detail.back_view_image_url
                      ? <img src={detail.back_view_image_url} alt="Back" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/30" /></div>}
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {detail.category_name && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Category:</span> {detail.category_name}
                  </p>
                )}
                {detail.gender && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Gender:</span> {detail.gender}
                  </p>
                )}
                {detail.description && (
                  <p className="text-sm text-foreground mt-2">{detail.description}</p>
                )}
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => navigate(
                  tenant
                    ? `/customer/auth?designId=${detail?.id}&tenantId=${tenant.id}&returnTo=/customer/dashboard`
                    : "/customer/auth"
                )}
              >
                Book this design
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <button
              onClick={() => navigate("/")}
              className="font-medium text-foreground hover:underline underline-offset-4"
            >
              Rina's Fit
            </button>
          </p>
          <button
            onClick={() => navigate("/magazine")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all designers →
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Catalogue;
