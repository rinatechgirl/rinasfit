import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useTheme } from "@/hooks/useTheme";
import { sendEmail } from "@/integrations/resend/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, ShoppingBag, MessageCircle, Package,
  Image as ImageIcon, LogOut, User, Sun, Moon,
  CheckCircle2, Clock, Wrench, Truck, PackageCheck,
  XCircle, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import fallbackLogo from "@/assets/logo.jpeg";
import CustomerChat from "@/components/customer/CustomerChat";
import CustomerProfileDialog from "@/components/customer/CustomerProfileDialog";
import CustomerMeasurementOrderDialog from "@/components/customer/CustomerMeasurementOrderDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  design_id: string;
  tenant_id: string;
  added_at: string;
  designs: { title: string; image_url: string | null; description: string | null };
  tenants: { business_name: string; slug: string; logo_url: string | null };
}

interface Order {
  id: string;
  booking_code: string | null;
  status: string;
  agreed_price: number | null;
  currency: string;
  payment_status: string;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  tenant_id: string;
  designs: { title: string; image_url: string | null } | null;
  tenants: { business_name: string; logo_url: string | null } | null;
}

// ─── Status config ─────────────────────────────────────────────────────────────
// Full pipeline: pending → confirmed → in_progress → ready → shipped → delivered

const ORDER_PIPELINE = ["pending", "confirmed", "in_progress", "ready", "shipped", "delivered"] as const;

const STATUS_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  icon: React.ElementType;
}> = {
  pending:     { label: "Pending",          description: "Waiting for the designer to confirm",         color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",   icon: Clock         },
  confirmed:   { label: "Confirmed",        description: "Designer confirmed — awaiting payment",       color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",       icon: CheckCircle2  },
  in_progress: { label: "Being Made",       description: "Your outfit is being crafted",                color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", icon: Wrench        },
  ready:       { label: "Ready",            description: "Your outfit is ready for collection",         color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: PackageCheck },
  shipped:     { label: "Out for Delivery", description: "Your outfit is on its way to you",            color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: Truck        },
  delivered:   { label: "Delivered",        description: "Your outfit has arrived — enjoy it!",         color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",      icon: CheckCircle2  },
  cancelled:   { label: "Cancelled",        description: "This order was cancelled",                    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",           icon: XCircle       },
};

// ─── Order Timeline ────────────────────────────────────────────────────────────

function OrderTimeline({ status }: { status: string }) {
  if (status === "cancelled") return null;
  const currentIdx = ORDER_PIPELINE.indexOf(status as any);

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <div className="flex items-center min-w-max gap-0">
        {ORDER_PIPELINE.map((s, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent   = i === currentIdx;
          const cfg         = STATUS_CONFIG[s];
          const Icon        = cfg.icon;
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted ? "bg-primary border-primary text-primary-foreground" :
                  isCurrent   ? "bg-primary/15 border-primary text-primary" :
                                "bg-muted border-border text-muted-foreground"
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[9px] font-medium whitespace-nowrap ${
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {cfg.label}
                </span>
              </div>
              {i < ORDER_PIPELINE.length - 1 && (
                <div className={`w-8 h-0.5 mb-4 transition-colors ${
                  i < currentIdx ? "bg-primary" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CustomerDashboard ────────────────────────────────────────────────────────

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { customer, account, loading: authLoading, signOut } = useCustomerAuth();
  const { isDark, toggle } = useTheme();

  const [cartItems, setCartItems]         = useState<CartItem[]>([]);
  const [orders, setOrders]               = useState<Order[]>([]);
  const [dataLoading, setDataLoading]     = useState(true);
  const [placingIds, setPlacingIds]       = useState<Set<string>>(new Set());
  const [pendingOrderItem, setPendingOrderItem] = useState<CartItem | null>(null);
  const [activeChatTenant, setActiveChatTenant] = useState<{
    tenantId: string; name: string; orderId?: string;
  } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !customer) {
      navigate("/customer/auth", { replace: true });
    }
  }, [authLoading, customer, navigate]);

  const fetchData = async () => {
    if (!customer) return;
    setDataLoading(true);

    const [cartRes, ordersRes] = await Promise.all([
      supabase
        .from("cart_items")
        .select("id, design_id, tenant_id, added_at, designs(title, image_url, description), tenants(business_name, slug, logo_url)")
        .eq("customer_user_id", customer.id)
        .order("added_at", { ascending: false }),

      supabase
        .from("orders")
        .select("id, booking_code, status, agreed_price, currency, payment_status, created_at, confirmed_at, delivered_at, tenant_id, designs(title, image_url), tenants(business_name, logo_url)")
        .eq("customer_user_id", customer.id)
        .order("created_at", { ascending: false }),
    ]);

    setCartItems((cartRes.data as CartItem[]) ?? []);
    setOrders((ordersRes.data as Order[]) ?? []);
    setDataLoading(false);
  };

  useEffect(() => {
    if (customer) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const removeFromCart = async (itemId: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else { toast.success("Removed from cart"); fetchData(); }
  };

  // ── Place Order (called after measurement dialog confirms) ──────────────────
  const placeOrder = async (item: CartItem, measurementId: string | null) => {
    if (!customer) return;
    setPlacingIds((prev) => new Set(prev).add(item.id));

    try {
      // Create order (pending status)
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_user_id: customer.id,
          design_id:        item.design_id,
          tenant_id:        item.tenant_id,
          created_by:       customer.id,
          status:           "pending",
          ...(measurementId ? { measurement_id: measurementId } : {}),
        } as any)
        .select("id, booking_code")
        .single();

      if (error) { toast.error(error.message); return; }

      // Remove from cart
      await supabase.from("cart_items").delete().eq("id", item.id);

      // ── Notify the org via chat ────────────────────────────────────────────
      const bookingCode = (order as any).booking_code ?? order.id;
      await supabase.from("chat_messages").insert({
        tenant_id:        item.tenant_id,
        customer_user_id: customer.id,
        message:          `📦 New order placed!\n\nDesign: ${item.designs.title}\nBooking code: ${bookingCode}\n\nPlease reply to agree on a price so we can proceed.`,
        sender_type:      "customer",
        is_read:          false,
      } as any);

      // ── Send booking_code email to customer ────────────────────────────────
      const customerEmail = account?.email ?? (await supabase.auth.getUser()).data.user?.email ?? "";
      if (customerEmail) {
        await sendEmail({
          to:       customerEmail,
          template: "booking_code",
          data: {
            customer_name: account?.full_name ?? "Customer",
            booking_code:  bookingCode,
            business_name: item.tenants.business_name,
          },
        });
      }

      toast.success("Order placed! The designer has been notified.");
      fetchData();

      // Open chat with the designer
      setActiveChatTenant({
        tenantId: item.tenant_id,
        name:     item.tenants.business_name,
        orderId:  order.id,
      });
    } finally {
      setPlacingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <button
            onClick={() => navigate("/magazine")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <img src={fallbackLogo} alt="Rina's Fit" className="w-7 h-7 object-contain rounded" />
            <span className="font-semibold text-sm hidden sm:block text-foreground">Rina's Fit</span>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Profile */}
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
              aria-label="Edit profile"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border">
                {account?.avatar_url
                  ? <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User className="w-4 h-4 text-primary" />}
              </div>
              <span className="text-sm text-foreground hidden sm:block truncate max-w-[120px]">
                {account?.full_name}
              </span>
            </button>

            {/* Sign out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate("/"); }}
              className="gap-1.5 text-muted-foreground cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Page heading */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your saved designs, track orders, and chat with designers.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { icon: ShoppingBag,   label: "Saved Designs", value: cartItems.length },
            { icon: Package,       label: "Orders",        value: orders.length },
            { icon: MessageCircle, label: "Active Chats",  value: new Set(orders.filter(o => !["delivered","cancelled"].includes(o.status)).map(o => o.tenant_id)).size },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="border-border/60">
              <div className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="cart">
          <TabsList className="grid grid-cols-3 w-full max-w-sm">
            <TabsTrigger value="cart">Cart</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>

          {/* ── Cart ── */}
          <TabsContent value="cart" className="mt-6">
            {dataLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : cartItems.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-16 text-center">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No saved designs yet.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/magazine")}>
                    Browse Magazine
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {cartItems.map((item) => {
                  const placing = placingIds.has(item.id);
                  return (
                    <Card key={item.id} className="border-border/60 overflow-hidden">
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {item.designs?.image_url
                          ? <img src={item.designs.image_url} alt={item.designs.title} className="w-full h-full object-cover" loading="lazy" />
                          : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/20" /></div>}
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm line-clamp-1">{item.designs?.title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <img
                              src={item.tenants?.logo_url ?? fallbackLogo}
                              alt={item.tenants?.business_name}
                              className="w-4 h-4 rounded-full object-contain border border-border"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
                            />
                            <span className="text-xs text-muted-foreground truncate">{item.tenants?.business_name}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full h-8 text-xs cursor-pointer"
                          onClick={() => setPendingOrderItem(item)}
                          disabled={placing}
                        >
                          {placing ? (
                            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Placing…</>
                          ) : (
                            "Place Order"
                          )}
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs cursor-pointer"
                            onClick={() => setActiveChatTenant({ tenantId: item.tenant_id, name: item.tenants.business_name })}
                          >
                            <MessageCircle className="w-3 h-3 mr-1" /> Chat
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive cursor-pointer"
                            onClick={() => removeFromCart(item.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Orders ── */}
          <TabsContent value="orders" className="mt-6">
            {dataLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-16 text-center">
                  <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No orders yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Place an order from your cart to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const cfg  = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <Card key={order.id} className="border-border/60">
                      <CardContent className="p-4 sm:p-5">

                        {/* Order header */}
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
                            {order.designs?.image_url
                              ? <img src={order.designs.image_url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground/30" /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">
                                  {order.designs?.title ?? "Design"}
                                </p>
                                <p className="text-xs text-muted-foreground">{order.tenants?.business_name}</p>
                                {order.booking_code && (
                                  <p className="text-xs font-mono text-primary mt-0.5">{order.booking_code}</p>
                                )}
                              </div>
                              <Badge className={`${cfg.color} text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 flex items-center gap-1`}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </Badge>
                            </div>

                            {/* Status description */}
                            <p className="text-xs text-muted-foreground mt-1.5 italic">{cfg.description}</p>

                            {/* Price */}
                            {order.agreed_price && (
                              <p className="text-xs text-foreground font-medium mt-1">
                                {order.currency} {order.agreed_price.toLocaleString()}
                                <span className={`ml-2 ${order.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
                                  {order.payment_status === "paid" ? "· Paid" : "· Unpaid"}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Visual timeline */}
                        <OrderTimeline status={order.status} />

                        {/* Actions */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 cursor-pointer"
                            onClick={() => setActiveChatTenant({
                              tenantId: order.tenant_id,
                              name: order.tenants?.business_name ?? "Designer",
                              orderId: order.id,
                            })}
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Chat with designer
                          </Button>

                          {/* Pay button — shown when confirmed + unpaid + price set */}
                          {order.payment_status === "unpaid" && order.agreed_price && order.status === "confirmed" && (
                            <PaystackButton order={order} onSuccess={fetchData} />
                          )}
                        </div>

                        <p className="text-[10px] text-muted-foreground mt-3">
                          Ordered {format(new Date(order.created_at), "MMM d, yyyy · HH:mm")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Chats ── */}
          <TabsContent value="chats" className="mt-6">
            <ChatsList
              customerId={customer?.id ?? ""}
              onOpenChat={(tenantId, name) => setActiveChatTenant({ tenantId, name })}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating chat window */}
      {activeChatTenant && customer && (
        <CustomerChat
          tenantId={activeChatTenant.tenantId}
          tenantName={activeChatTenant.name}
          customerId={customer.id}
          orderId={activeChatTenant.orderId}
          onClose={() => setActiveChatTenant(null)}
        />
      )}

      <CustomerProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Measurement dialog — shown before the order is placed */}
      {pendingOrderItem && customer && (
        <CustomerMeasurementOrderDialog
          open={!!pendingOrderItem}
          designTitle={pendingOrderItem.designs.title}
          tenantId={pendingOrderItem.tenant_id}
          customerId={customer.id}
          onClose={() => setPendingOrderItem(null)}
          onConfirm={(measurementId) => {
            const item = pendingOrderItem;
            setPendingOrderItem(null);
            placeOrder(item, measurementId);
          }}
        />
      )}
    </div>
  );
};

// ─── Paystack Button ──────────────────────────────────────────────────────────

function PaystackButton({ order, onSuccess }: { order: Order; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const initializePayment = async () => {
    setLoading(true);

    const { data: config } = await supabase
      .from("tenant_payment_config")
      .select("paystack_public_key")
      .eq("tenant_id", order.tenant_id)
      .maybeSingle();

    if (!config?.paystack_public_key) {
      toast.error("Payment not configured for this designer yet.");
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? "";

    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      toast.error("Payment system not loaded. Please refresh the page.");
      setLoading(false);
      return;
    }

    const handler = PaystackPop.setup({
      key:      config.paystack_public_key,
      email,
      amount:   (order.agreed_price ?? 0) * 100,
      currency: order.currency,
      ref:      `RF-${order.booking_code ?? order.id}-${Date.now()}`,
      metadata: { order_id: order.id, booking_code: order.booking_code },
      callback: async (response: { reference: string }) => {
        // Verify the payment server-side before marking the order paid.
        const { data: { session } } = await supabase.auth.getSession();
        const { error: fnError } = await supabase.functions.invoke("verify-payment", {
          body: { reference: response.reference, order_id: order.id },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });

        if (fnError) {
          toast.error("Payment could not be verified. Please contact support with your reference: " + response.reference);
          setLoading(false);
          return;
        }

        toast.success("Payment successful! Your outfit is now being made.");
        onSuccess();
        setLoading(false);
      },
      onClose: () => {
        toast("Payment cancelled.");
        setLoading(false);
      },
    });

    handler.openIframe();
  };

  return (
    <Button size="sm" onClick={initializePayment} disabled={loading} className="cursor-pointer">
      {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
      Pay Now
    </Button>
  );
}

// ─── Chats List ───────────────────────────────────────────────────────────────

function ChatsList({
  customerId,
  onOpenChat,
}: {
  customerId: string;
  onOpenChat: (tenantId: string, name: string) => void;
}) {
  const [convos, setConvos] = useState<{
    tenantId: string; name: string; logo: string | null; lastMessage: string; unread: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("tenant_id, message, created_at, is_read, sender_type, tenants(business_name, logo_url)")
        .eq("customer_user_id", customerId)
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const map = new Map<string, typeof convos[0]>();
      data.forEach((msg: any) => {
        if (!map.has(msg.tenant_id)) {
          map.set(msg.tenant_id, {
            tenantId:    msg.tenant_id,
            name:        msg.tenants?.business_name ?? "Designer",
            logo:        msg.tenants?.logo_url ?? null,
            lastMessage: msg.message,
            unread:      !msg.is_read && msg.sender_type === "designer" ? 1 : 0,
          });
        } else if (!msg.is_read && msg.sender_type === "designer") {
          map.get(msg.tenant_id)!.unread++;
        }
      });

      setConvos(Array.from(map.values()));
      setLoading(false);
    };
    if (customerId) load();
  }, [customerId]);

  if (loading) return (
    <div className="text-center py-12">
      <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
    </div>
  );

  if (convos.length === 0) return (
    <Card className="border-border/60">
      <CardContent className="py-16 text-center">
        <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground">No conversations yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Browse the magazine, save a design, and place an order to start chatting.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-2">
      {convos.map((c) => (
        <button
          key={c.tenantId}
          onClick={() => onOpenChat(c.tenantId, c.name)}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left cursor-pointer"
        >
          <img
            src={c.logo ?? fallbackLogo}
            alt={c.name}
            className="w-10 h-10 rounded-lg object-contain border border-border bg-background"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {c.unread > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                {c.unread}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

export default CustomerDashboard;
