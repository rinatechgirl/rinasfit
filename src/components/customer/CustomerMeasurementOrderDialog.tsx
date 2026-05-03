import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Ruler, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// ─── Outfit schema (mirrors MeasurementForm) ──────────────────────────────────

const OUTFIT_TYPES = [
  "Short Gown", "Long Gown", "Top / Blouse", "Trousers", "Skirt",
  "Shirt", "Suit", "Native Wear", "Two-Piece Set", "Custom",
];
const GENDERS = ["Female", "Male", "Unisex"];

const OUTFIT_SCHEMAS: Record<string, { key: string; label: string }[]> = {
  "Short Gown": [
    { key: "bust", label: "Bust" }, { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" },
    { key: "shoulder", label: "Shoulder" }, { key: "sleeve_length", label: "Sleeve Length" },
    { key: "dress_length", label: "Gown Length" }, { key: "round_sleeve", label: "Round Sleeve" },
    { key: "neck_depth", label: "Neck Depth" }, { key: "back_width", label: "Back Width" },
  ],
  "Long Gown": [
    { key: "bust", label: "Bust" }, { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" },
    { key: "shoulder", label: "Shoulder" }, { key: "sleeve_length", label: "Sleeve Length" },
    { key: "dress_length", label: "Full Length" }, { key: "round_sleeve", label: "Round Sleeve" },
    { key: "neck_depth", label: "Neck Depth" }, { key: "back_width", label: "Back Width" },
  ],
  "Top / Blouse": [
    { key: "bust", label: "Bust" }, { key: "waist", label: "Waist" }, { key: "shoulder", label: "Shoulder" },
    { key: "sleeve_length", label: "Sleeve Length" }, { key: "top_length", label: "Top Length" },
  ],
  "Trousers": [
    { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" }, { key: "thigh", label: "Thigh" },
    { key: "knee", label: "Knee" }, { key: "ankle", label: "Ankle" }, { key: "trouser_length", label: "Trouser Length" },
  ],
  "Skirt": [
    { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" }, { key: "dress_length", label: "Skirt Length" },
  ],
  "Shirt": [
    { key: "chest", label: "Chest" }, { key: "shoulder", label: "Shoulder" },
    { key: "sleeve_length", label: "Sleeve Length" }, { key: "shirt_length", label: "Shirt Length" },
    { key: "neck_size", label: "Neck Size" },
  ],
  "Suit": [
    { key: "chest", label: "Chest" }, { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" },
    { key: "shoulder", label: "Shoulder" }, { key: "sleeve_length", label: "Sleeve Length" },
    { key: "shirt_length", label: "Suit Length" },
  ],
  "Native Wear": [
    { key: "chest", label: "Chest / Bust" }, { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" },
    { key: "shoulder", label: "Shoulder" }, { key: "sleeve_length", label: "Sleeve Length" },
    { key: "top_length", label: "Top Length" }, { key: "trouser_length", label: "Trouser Length" },
  ],
  "Two-Piece Set": [
    { key: "bust", label: "Bust / Chest" }, { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" },
    { key: "shoulder", label: "Shoulder" }, { key: "sleeve_length", label: "Sleeve Length" },
    { key: "top_length", label: "Top Length" }, { key: "trouser_length", label: "Trouser / Skirt Length" },
  ],
  "Custom": [
    { key: "chest", label: "Chest / Bust" }, { key: "waist", label: "Waist" }, { key: "hip", label: "Hip" },
    { key: "shoulder", label: "Shoulder" }, { key: "sleeve_length", label: "Sleeve Length" },
    { key: "dress_length", label: "Overall Length" }, { key: "neck", label: "Neck" }, { key: "inseam", label: "Inseam" },
  ],
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  designTitle: string;
  tenantId: string;
  customerId: string;   // auth user id
  onClose: () => void;
  /** Called with the saved measurement id, or null if the customer skipped. */
  onConfirm: (measurementId: string | null) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CustomerMeasurementOrderDialog = ({
  open,
  designTitle,
  tenantId,
  customerId,
  onClose,
  onConfirm,
}: Props) => {
  const [outfitType, setOutfitType] = useState("Short Gown");
  const [gender, setGender] = useState("Female");
  const [notes, setNotes] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const currentFields = OUTFIT_SCHEMAS[outfitType] ?? OUTFIT_SCHEMAS["Custom"];

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Reset form when dialog opens for a new item
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Validate numeric fields
    const numericData: Record<string, number> = {};
    for (const f of currentFields) {
      const raw = formData[f.key];
      if (raw) {
        const val = parseFloat(raw);
        if (isNaN(val) || val <= 0) {
          toast.error(`${f.label} must be a positive number`);
          setSaving(false);
          return;
        }
        numericData[f.key] = val;
      }
    }

    const { data, error } = await (supabase
      .from("measurements")
      .insert({
        customer_user_id: customerId,
        tenant_id: tenantId,
        outfit_type: outfitType,
        measurement_gender: gender,
        notes: notes || null,
        ...numericData,
      } as any)
      .select("id")
      .single() as any);

    setSaving(false);

    if (error) {
      toast.error("Could not save measurements: " + error.message);
      return;
    }

    toast.success("Measurements saved!");
    onConfirm((data as any).id);
  };

  const handleSkip = () => {
    onConfirm(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Ruler className="w-5 h-5 text-accent" />
            <DialogTitle className="font-display text-xl">Your Measurements</DialogTitle>
          </div>
          <DialogDescription>
            Share your measurements for <strong>{designTitle}</strong> so your designer can get started immediately.
            All measurements are in <strong>centimetres (cm)</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* Outfit type + gender */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Outfit Type</Label>
              <Select
                value={outfitType}
                onValueChange={(v) => { setOutfitType(v); setFormData({}); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTFIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Measurement fields */}
          <div className="border-t border-border/60 pt-4">
            <p className="text-sm font-semibold text-foreground mb-4">Dimensions (cm)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {currentFields.map((f) => {
                let label = f.label;
                if (f.key === "chest" || f.key === "bust") {
                  label = gender === "Female" ? "Bust" : gender === "Male" ? "Chest" : f.label;
                }
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      value={formData[f.key] ?? ""}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      className="h-10"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2 border-t border-border/60 pt-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Additional Notes (optional)
            </Label>
            <Textarea
              placeholder="Any special requests, fitting preferences, or adjustments…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto text-muted-foreground"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip for now
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><ChevronRight className="w-4 h-4" /> Save & Place Order</>
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerMeasurementOrderDialog;
