import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Image as ImageIcon, RotateCcw, Globe, EyeOff } from "lucide-react";

interface Design {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  image_url: string | null;
  back_view_image_url: string | null;
  uploaded_by: string | null;
  gender: string | null;
  is_public: boolean;
  created_at: string;
}
interface Category { id: string; name: string; }

const Designs = () => {
  const { isAdmin, user, tenantId, isPlatformAdmin } = useAuth();
  const canManage = isAdmin || isPlatformAdmin;
  const [designs, setDesigns] = useState<Design[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category_id: "", gender: "Unisex" });
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [detailDesign, setDetailDesign] = useState<Design | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchDesigns = async () => {
    let query = supabase.from("designs").select("*").order("created_at", { ascending: false });
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (filterCategory && filterCategory !== "all") query = query.eq("category_id", filterCategory);
    if (filterGender && filterGender !== "all") {
      const { data: allData } = await query;
      const filtered = (allData ?? []).filter((d: any) => d.gender === filterGender);
      setDesigns(filtered as Design[]);
      return;
    }
    const { data } = await query;
    setDesigns((data as Design[]) ?? []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name").order("name");
    setCategories(data ?? []);
  };

  useEffect(() => { fetchCategories(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDesigns(); }, [search, filterCategory, filterGender]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("design-images").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); return null; }
    const { data: urlData } = supabase.storage.from("design-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const existing = editingId ? designs.find((d) => d.id === editingId) : null;
    let frontUrl = existing?.image_url ?? null;
    let backUrl = existing?.back_view_image_url ?? null;

    if (frontFile) {
      const url = await uploadImage(frontFile);
      if (!url) { setLoading(false); return; }
      frontUrl = url;
    }
    if (backFile) {
      const url = await uploadImage(backFile);
      if (!url) { setLoading(false); return; }
      backUrl = url;
    }

    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id || null,
      gender: form.gender,
      image_url: frontUrl,
      back_view_image_url: backUrl,
      uploaded_by: existing?.uploaded_by ?? user?.id ?? null,
      tenant_id: tenantId,
    };

    if (editingId) {
      const { error } = await supabase.from("designs").update(payload).eq("id", editingId);
      if (error) toast.error(error.message); else toast.success("Design updated");
    } else {
      const { error } = await supabase.from("designs").insert(payload);
      if (error) toast.error(error.message); else toast.success("Design added");
    }
    setLoading(false);
    setDialogOpen(false);
    resetForm();
    fetchDesigns();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", description: "", category_id: "", gender: "Unisex" });
    setFrontFile(null);
    setBackFile(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this design?")) return;
    const { error } = await supabase.from("designs").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchDesigns(); }
  };

  const toggleFlip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Publish / unpublish toggle ─────────────────────────────────────────────
  const togglePublish = async (design: Design, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManage) return;
    setTogglingId(design.id);

    const newValue = !design.is_public;
    const { error } = await supabase
      .from("designs")
      .update({ is_public: newValue } as any)
      .eq("id", design.id);

    setTogglingId(null);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(newValue ? "Published to magazine" : "Removed from magazine");
      fetchDesigns();
    }
  };

  const getCategoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Fashion Catalogue</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse and manage your design collection</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Add Design</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingId ? "Edit Design" : "New Design"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Unisex">Unisex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Front View</Label>
                    <Input type="file" accept="image/*" onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Back View</Label>
                    <Input type="file" accept="image/*" onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Saving..." : "Save Design"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search designs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11" />
        </div>
        <Select value={filterGender} onValueChange={setFilterGender}>
          <SelectTrigger className="w-32 h-11"><SelectValue placeholder="Gender" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Unisex">Unisex</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48 h-11"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Design Grid */}
      {designs.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-muted-foreground">No designs found.</CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {designs.map((d) => {
            const isFlipped = flippedCards.has(d.id);
            const isToggling = togglingId === d.id;
            return (
              <Card
                key={d.id}
                className="shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer border-border/60"
                onClick={() => setDetailDesign(d)}
              >
                <div className="aspect-[4/5] bg-muted relative overflow-hidden">
                  {/* Front view */}
                  <div className={`absolute inset-0 transition-opacity duration-500 ${isFlipped ? "opacity-0" : "opacity-100"}`}>
                    {d.image_url
                      ? <img src={d.image_url} alt={`${d.title} - Front`} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-12 h-12 text-muted-foreground/30" /></div>}
                  </div>
                  {/* Back view */}
                  <div className={`absolute inset-0 transition-opacity duration-500 ${isFlipped ? "opacity-100" : "opacity-0"}`}>
                    {d.back_view_image_url
                      ? <img src={d.back_view_image_url} alt={`${d.title} - Back`} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center flex-col gap-2"><ImageIcon className="w-12 h-12 text-muted-foreground/30" /><span className="text-xs text-muted-foreground/50">No back view</span></div>}
                  </div>

                  {/* Flip button */}
                  {(d.image_url || d.back_view_image_url) && (
                    <button
                      onClick={(e) => toggleFlip(d.id, e)}
                      className="absolute bottom-2 left-2 z-10 bg-card/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={isFlipped ? "Show front" : "Show back"}
                    >
                      <RotateCcw className="w-4 h-4 text-foreground" />
                    </button>
                  )}

                  {/* View label */}
                  <span className="absolute bottom-2 right-2 z-10 text-[10px] bg-card/70 backdrop-blur-sm text-foreground px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    {isFlipped ? "Back View" : "Front View"}
                  </span>

                  {/* Published badge */}
                  {d.is_public && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-green-500/90 text-white text-[10px] px-1.5 py-0.5 gap-1 backdrop-blur-sm">
                        <Globe className="w-2.5 h-2.5" /> Published
                      </Badge>
                    </div>
                  )}

                  {/* Admin controls */}
                  {canManage && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      {/* Publish toggle */}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        title={d.is_public ? "Remove from magazine" : "Publish to magazine"}
                        disabled={isToggling}
                        onClick={(e) => togglePublish(d, e)}
                      >
                        {d.is_public
                          ? <EyeOff className="w-3.5 h-3.5 text-green-600" />
                          : <Globe className="w-3.5 h-3.5 text-muted-foreground" />}
                      </Button>
                      {/* Edit */}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm({ title: d.title, description: d.description ?? "", category_id: d.category_id ?? "", gender: d.gender ?? "Unisex" });
                          setEditingId(d.id);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {/* Delete */}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <p className="font-display font-semibold text-foreground text-sm">{d.title}</p>
                  <div className="flex gap-2 items-center mt-1.5">
                    <p className="text-xs text-accent font-medium">{getCategoryName(d.category_id)}</p>
                    {d.gender && (
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                        {d.gender}
                      </span>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{d.description}</p>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-3 h-9 text-xs font-semibold uppercase tracking-wider"
                    onClick={(e) => { e.stopPropagation(); setDetailDesign(d); }}
                  >
                    Select Design
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailDesign} onOpenChange={(o) => { if (!o) setDetailDesign(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailDesign && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{detailDesign.title}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Front View</p>
                  <div className="aspect-[4/5] bg-muted rounded-lg overflow-hidden">
                    {detailDesign.image_url
                      ? <img src={detailDesign.image_url} alt="Front" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/30" /></div>}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Back View</p>
                  <div className="aspect-[4/5] bg-muted rounded-lg overflow-hidden">
                    {detailDesign.back_view_image_url
                      ? <img src={detailDesign.back_view_image_url} alt="Back" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-muted-foreground/30" /></div>}
                  </div>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Category:</span> {getCategoryName(detailDesign.category_id)}
                </p>
                {detailDesign.gender && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Gender:</span> {detailDesign.gender}
                  </p>
                )}
                {detailDesign.description && (
                  <p className="text-sm text-foreground mt-2">{detailDesign.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Added: {new Date(detailDesign.created_at).toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Designs;
