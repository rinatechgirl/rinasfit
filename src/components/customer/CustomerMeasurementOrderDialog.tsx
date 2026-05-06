import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Ruler, CreditCard, ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { sendEmail } from "@/integrations/resend/client";

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  design_id: string;
  tenant_id: string;
  added_at: string;
  designs: { title: string; image_url: string | null; back_view_image_url: string | null; description: string | null; price: number | null };
  tenants: { business_name: string; slug: string; logo_url: string | null; currency?: string };
}

type Step = "measurements" | "payment" | "done";

interface Props {
  open: boolean;
  item: CartItem;
  customerId: string;
  customerEmail: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CustomerMeasurementOrderDialog = ({
  open,
  item,
  customerId,
  customerEmail,
  customerName,
  onClose,
  onSuccess,
}: Props) => {
  const [step, setStep] = useState<Step>("measurements");

  // Measurements state
  const [outfitType, setOutfitType] = useState("Short Gown");
  const [gender, setGender] = useState("Female");
  const [notes, setNotes] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Order state (set after step 1)
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  // Loading / payment state
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const currentFields = OUTFIT_SCHEMAS[outfitType] ?? OUTFIT_SCHEMAS["Custom"];
  const designPrice   = item.designs.price;
  const currency      = item.tenants.currency ?? "NGN";

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state for next open
      setStep("measurements");
      setFormData({});
      setNotes("");
      setOrderId(null);
      setBookingCode(null);
      onClose();
    }
  };

  // ── Step 1: save measurements + create order ─────────────────────────────

  const handleMeasurementsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeasurement(true);

    // Validate numeric fields
    const numericData: Record<string, number> = {};
    for (const f of currentFields) {
      const raw = formData[f.key];
      if (raw) {
        const val = parseFloat(raw);
        if (isNaN(val) || val <= 0) {
          toast.error(`${f.label} must be a positive number`);
          setSavingMeasurement(false);
          return;
        }
        numericData[f.key] = val;
      }
    }

    // Save measurement
    const { data: measurement, error: measError } = await (supabase
      .from("measurements")
      .insert({
        customer_user_id: customerId,
        tenant_id: item.tenant_id,
        outfit_type: outfitType,
        measurement_gender: gender,
        notes: notes || null,
        ...numericData,
      } as any)
      .select("id")
      .single() as any);

    if (measError) {
      toast.error("Could not save measurements: " + measError.message);
      setSavingMeasurement(false);
      return;
    }

    const measurementId = (measurement as any).id as string;

    // Create order (pending)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_user_id: customerId,
        design_id:        item.design_id,
        tenant_id:        item.tenant_id,
        created_by:       customerId,
        status:           "pending",
        measurement_id:   measurementId,
        ...(designPrice ? { agreed_price: designPrice } : {}),
      } as any)
      .select("id, booking_code")
      .single();

    if (orderError) {
      toast.error(orderError.message);
      setSavingMeasurement(false);
      return;
    }

    const newOrderId    = (order as any).id as string;
    const newBookingCode = (order as any).booking_code ?? newOrderId;

    setOrderId(newOrderId);
    setBookingCode(newBookingCode);

    // Remove from cart
    await supabase.from("cart_items").delete().eq("id", item.id);

    // Notify designer via chat message
    await supabase.from("chat_messages").insert({
      tenant_id:        item.tenant_id,
      customer_user_id: customerId,
      message:          `📦 New order placed!\n\nDesign: ${item.designs.title}\nBooking code: ${newBookingCode}\n\nMeasurements have been shared. ${designPrice ? `Price: ₦${designPrice.toLocaleString()} — awaiting payment.` : "Please reply to agree on a price."}`,
      sender_type:      "customer",
      is_read:          false,
    } as any);

    // Create notification for designer
    const { data: adminUser } = await (supabase
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", item.tenant_id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle() as any);

    if (adminUser) {
      await supabase.from("notifications").insert({
        user_id:   (adminUser as any).user_id,
        tenant_id: item.tenant_id,
        order_id:  newOrderId,
        message:   `New order: "${item.designs.title}" — Booking ${newBookingCode}${designPrice ? ` (₦${designPrice.toLocaleString()}, awaiting payment)` : " (price to be agreed)"}`,
        is_read:   false,
      } as any);
    }

    // Send booking confirmation email to customer
    if (customerEmail) {
      await sendEmail({
        to:       customerEmail,
        template: "booking_code",
        data: {
          customer_name: customerName,
          booking_code:  newBookingCode,
          business_name: item.tenants.business_name,
        },
      });
    }

    setSavingMeasurement(false);

    // Go to payment or finish
    if (designPrice && designPrice > 0) {
      setStep("payment");
    } else {
      toast.success("Order placed! The designer will contact you about pricing.");
      onSuccess();
    }
  };

  const handleSkipMeasurements = async () => {
    setSavingMeasurement(true);

    // Create order without measurements
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_user_id: customerId,
        design_id:        item.design_id,
        tenant_id:        item.tenant_id,
        created_by:       customerId,
        status:           "pending",
        ...(designPrice ? { agreed_price: designPrice } : {}),
      } as any)
      .select("id, booking_code")
      .single();

    if (orderError) {
      toast.error(orderError.message);
      setSavingMeasurement(false);
      return;
    }

    const newOrderId     = (order as any).id as string;
    const newBookingCode = (order as any).booking_code ?? newOrderId;

    setOrderId(newOrderId);
    setBookingCode(newBookingCode);

    await supabase.from("cart_items").delete().eq("id", item.id);

    await supabase.from("chat_messages").insert({
      tenant_id:        item.tenant_id,
      customer_user_id: customerId,
      message:          `📦 New order placed!\n\nDesign: ${item.designs.title}\nBooking code: ${newBookingCode}\n\n${designPrice ? `Price: ₦${designPrice.toLocaleString()} — awaiting payment.` : "Please reply to agree on a price."}`,
      sender_type:      "customer",
      is_read:          false,
    } as any);

    const { data: adminUser } = await (supabase
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", item.tenant_id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle() as any);

    if (adminUser) {
      await supabase.from("notifications").insert({
        user_id:   (adminUser as any).user_id,
        tenant_id: item.tenant_id,
        order_id:  newOrderId,
        message:   `New order: "${item.designs.title}" — Booking ${newBookingCode}`,
        is_read:   false,
      } as any);
    }

    if (customerEmail) {
      await sendEmail({
        to:       customerEmail,
        template: "booking_code",
        data: {
          customer_name: customerName,
          booking_code:  newBookingCode,
          business_name: item.tenants.business_name,
        },
      });
    }

    setSavingMeasurement(false);

    if (designPrice && designPrice > 0) {
      setStep("payment");
    } else {
      toast.success("Order placed! The designer will contact you.");
      onSuccess();
    }
  };

  // ── Step 2: Paystack payment ─────────────────────────────────────────────

  const initPaystack = async () => {
    if (!orderId || !designPrice) return;
    setPaymentLoading(true);
    try {
      const { data: config, error: configError } = await (supabase as any)
        .from("tenant_payment_config")
        .select("paystack_public_key")
        .eq("tenant_id", item.tenant_id)
        .maybeSingle();

      if (configError) {
        console.error("Paystack config fetch error:", configError);
        toast.error("Could not load payment config. Please try again.");
        return;
      }

      if (!(config as any)?.paystack_public_key) {
        toast.error("Payment not configured for this designer yet. Your order is placed — they will contact you.");
        onSuccess();
        return;
      }

      const PaystackPop = (window as any).PaystackPop;
      if (!PaystackPop || typeof PaystackPop.setup !== "function") {
        toast.error("Payment system not loaded. Please refresh the page and try again.");
        return;
      }

      console.log("Launching Paystack:", {
        key: (config as any).paystack_public_key?.slice(0, 12) + "…",
        email: customerEmail,
        amount: designPrice * 100,
        currency,
      });

      const handler = PaystackPop.setup({
        key:      (config as any).paystack_public_key,
        email:    customerEmail,
        amount:   designPrice * 100,
        currency: currency || "NGN",
        ref:      `RF-${bookingCode ?? orderId}-${Date.now()}`,
        metadata: { order_id: orderId, booking_code: bookingCode },
        // Paystack v1 rejects async functions — use a regular function with an inner async IIFE
        callback: (response: { reference: string }) => {
          (async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const { error: fnError } = await supabase.functions.invoke("verify-payment", {
                body: { reference: response.reference, order_id: orderId },
                headers: session?.access_token
                  ? { Authorization: `Bearer ${session.access_token}` }
                  : undefined,
              });

              if (fnError) {
                console.error("verify-payment error:", fnError);
                toast.error(`Payment received but verification failed. Reference: ${response.reference} — contact support.`);
                return;
              }

              toast.success("Payment confirmed! Your outfit is now being made.");
              onSuccess();
            } catch (err) {
              console.error("Payment callback error:", err);
              toast.error(`Payment received but could not be confirmed. Reference: ${response.reference}`);
            }
          })();
        },
        onClose: () => {
          toast("Payment cancelled.");
        },
      });

      handler.openIframe();
    } catch (err) {
      console.error("Paystack launch error:", err);
      toast.error("Could not launch payment. Please refresh and try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* ── Step 1: Measurements ── */}
        {step === "measurements" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Ruler className="w-5 h-5 text-accent" />
                <DialogTitle className="font-display text-xl">Your Measurements</DialogTitle>
              </div>
              <DialogDescription>
                Share your measurements for <strong>{item.designs.title}</strong> so your designer can get started.
                All measurements in <strong>centimetres (cm)</strong>.
                {designPrice && (
                  <span className="block mt-1 font-medium text-foreground">
                    Price: ₦{designPrice.toLocaleString()} — you&apos;ll pay after confirming measurements.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleMeasurementsSubmit} className="space-y-5 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Outfit Type</Label>
                  <Select value={outfitType} onValueChange={(v) => { setOutfitType(v); setFormData({}); }}>
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

              <div className="border-t border-border/60 pt-4">
                <p className="text-sm font-semibold text-foreground mb-3">Dimensions (cm)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {currentFields.map((f) => {
                    let label = f.label;
                    if (f.key === "chest" || f.key === "bust") {
                      label = gender === "Female" ? "Bust" : gender === "Male" ? "Chest" : f.label;
                    }
                    return (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <Input
                          type="number" step="0.1" min="0" placeholder="0.0"
                          value={formData[f.key] ?? ""}
                          onChange={(e) => setFormData((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="h-9"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Notes (optional)</Label>
                <Textarea
                  placeholder="Special requests, fitting preferences…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/60">
                <Button type="button" variant="ghost" className="sm:mr-auto text-muted-foreground"
                  onClick={handleSkipMeasurements} disabled={savingMeasurement}>
                  Skip for now
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={savingMeasurement}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingMeasurement} className="gap-2">
                  {savingMeasurement
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : designPrice
                      ? <><ArrowRight className="w-4 h-4" /> Save & Continue to Payment</>
                      : <><ArrowRight className="w-4 h-4" /> Place Order</>
                  }
                </Button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 2: Payment ── */}
        {step === "payment" && designPrice && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-5 h-5 text-accent" />
                <DialogTitle className="font-display text-xl">Complete Payment</DialogTitle>
              </div>
              <DialogDescription>
                Your measurements are saved. Complete payment to confirm your order.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Order summary */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Order Summary</p>
                <div className="flex items-center gap-3">
                  {/* Show front + back side by side if both exist */}
                  {item.designs.image_url && item.designs.back_view_image_url ? (
                    <div className="flex gap-1.5 shrink-0">
                      <div className="relative">
                        <img src={item.designs.image_url} alt={item.designs.title}
                          className="w-14 h-14 rounded-lg object-cover border border-border" />
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-card/80 px-1 rounded font-medium">Front</span>
                      </div>
                      <div className="relative">
                        <img src={item.designs.back_view_image_url} alt={`${item.designs.title} — Back`}
                          className="w-14 h-14 rounded-lg object-cover border border-border" />
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-card/80 px-1 rounded font-medium">Back</span>
                      </div>
                    </div>
                  ) : item.designs.image_url ? (
                    <img src={item.designs.image_url} alt={item.designs.title}
                      className="w-14 h-14 rounded-lg object-cover border border-border" />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.designs.title}</p>
                    <p className="text-xs text-muted-foreground">{item.tenants.business_name}</p>
                    {bookingCode && (
                      <p className="text-xs text-muted-foreground mt-0.5">Booking: <span className="font-mono font-medium text-foreground">{bookingCode}</span></p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-xl font-bold text-foreground">
                    {currency === "NGN" ? "₦" : currency}{designPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 dark:text-blue-400">
                    You can still chat with your designer before and after payment.
                    Your order is <strong>already placed</strong> — payment confirms and starts production.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={onSuccess} className="sm:mr-auto text-muted-foreground">
                  Pay later (keep order pending)
                </Button>
                <Button onClick={initPaystack} disabled={paymentLoading} className="gap-2 flex-1 sm:flex-none">
                  {paymentLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                    : <><CreditCard className="w-4 h-4" /> Pay {currency === "NGN" ? "₦" : currency}{designPrice.toLocaleString()}</>
                  }
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step: done (should auto-close, but safety fallback) ── */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold text-foreground">Order confirmed!</p>
              <p className="text-sm text-muted-foreground mt-1">Your outfit is now being made.</p>
            </div>
            <Button onClick={onSuccess}>View my orders</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerMeasurementOrderDialog;
