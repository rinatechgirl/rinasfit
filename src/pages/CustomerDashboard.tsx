import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShoppingBag, MessageCircle, Package, Image as ImageIcon, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import fallbackLogo from "@/assets/logo.jpeg";
import CustomerChat from "@/components/customer/CustomerChat";
import CustomerProfileDialog from "@/components/customer/CustomerProfileDialog";

interface CartItem {
  id: string;
  design_id: string;
  tenant_id: string;
  added_at: string;
  designs: {
    title: string;
    image_url: string | null;
    description: string | null;
  };
  tenants: {
    business_name: string;
    slug: string;
    logo_url: string | null;
  };
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed:   { label: "Confirmed",   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
  ready:       { label: "Ready",       color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  delivered:   { label: "Delivered",   color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400" },
  cancelled:   { label: "Cancelled",   color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { customer, account, loading: authLoading, signOut } = useCustomerAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeChatTenant, setActiveChatTenant] = useState<{ tenantId: string; name: string; orderId?: string } | null>(null);

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

  const placeOrder = async (item: CartItem) => {
    if (!customer) return;

    // Create order with pending status
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_user_id: customer.id,
        design_id: item.design_id,
        tenant_id: item.tenant_id,
        created_by: customer.id,
        customer_id: customer.id, // legacy field
        status: "pending",
      })
      .select("id")
      .single();

    if (error) { toast.error(error.message); return; }

    // Remove from cart
    await supabase.from("cart_items").delete().eq("id", item.id);

    toast.success("Order placed! Start chatting with the designer to agree on a price.");
    fetchData();

    // Open chat for this designer
    setActiveChatTenant({
      tenantId: item.tenant_id,
      name: item.tenants.business_name,
      orderId: order.id,
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/magazine")} className="flex items-center gap-2">
              <img src={fallbackLogo} alt="Rina's Fit" className="w-7 h-7 object-contain rounded" />
              <span className="font-semibold text-sm hidden sm:block">Rina's Fit</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm text-foreground hidden sm:block">{account?.full_name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate("/"); }}
              className="gap-1.5 text-muted-foreground"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your designs, orders, and conversations.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: ShoppingBag, label: "Saved Designs", value: cartItems.length },
            { icon: Package, label: "Orders", value: orders.length },
            { icon: MessageCircle, label: "Active Chats", value: new Set(orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").map(o => o.tenant_id)).size },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
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
              <div className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
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
              <div className="grid sm:grid-cols-2 gap-4">
                {cartItems.map((item) => (
                  <Card key={item.id} className="border-border/60 overflow-hidden">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {item.designs?.image_url
                        ? <img src={item.designs.image_url} alt={item.designs.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/20" /></div>}
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-foreground">{item.designs?.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <img
                            src={item.tenants?.logo_url ?? fallbackLogo}
                            alt={item.tenants?.business_name}
                            className="w-4 h-4 rounded-full object-contain border border-border"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackLogo; }}
                          />
                          <span className="text-xs text-muted-foreground">{item.tenants?.business_name}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => placeOrder(item)}>
                          Place Order
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveChatTenant({ tenantId: item.tenant_id, name: item.tenants.business_name })}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.id)} className="text-destructive hover:text-destructive">
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Orders ── */}
          <TabsContent value="orders" className="mt-6">
            {dataLoading ? (
              <div className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : orders.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-16 text-center">
                  <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No orders yet. Place an order from your cart.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                  return (
                    <Card key={order.id} className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                              {order.designs?.image_url
                                ? <img src={order.designs.image_url} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground/30" /></div>}
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{order.designs?.title ?? "Design"}</p>
                              <p className="text-xs text-muted-foreground">{order.tenants?.business_name}</p>
                              {order.booking_code && (
                                <p className="text-xs font-mono text-accent mt-0.5">{order.booking_code}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-1.5 shrink-0">
                            <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                            {order.agreed_price && (
                              <p className="text-xs text-muted-foreground">{order.currency} {order.agreed_price.toLocaleString()}</p>
                            )}
                          </div>
                        </div>

                        {/* Order timeline */}
                        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
                          {["pending", "confirmed", "in_progress", "ready", "delivered"].map((s, i, arr) => {
                            const statuses = ["pending", "confirmed", "in_progress", "ready", "delivered"];
                            const currentIdx = statuses.indexOf(order.status);
                            const isActive = statuses.indexOf(s) <= currentIdx;
                            return (
                              <div key={s} className="flex items-center gap-1 shrink-0">
                                <div className={`w-2 h-2 rounded-full ${isActive ? "bg-accent" : "bg-border"}`} />
                                <span className={`text-[10px] ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                  {STATUS_CONFIG[s]?.label}
                                </span>
                                {i < arr.length - 1 && <div className={`w-4 h-px ${isActive ? "bg-accent/50" : "bg-border"}`} />}
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveChatTenant({ tenantId: order.tenant_id, name: order.tenants?.business_name ?? "Designer", orderId: order.id })}
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Chat
                          </Button>
                          {order.payment_status === "unpaid" && order.agreed_price && order.status === "confirmed" && (
                            <PaystackButton order={order} onSuccess={fetchData} />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Chats list ── */}
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
    </div>
  );
};

// ─── Paystack Button ──────────────────────────────────────────────────────────

function PaystackButton({ order, onSuccess }: { order: Order; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const initializePayment = async () => {
    setLoading(true);

    // Get public key for this tenant
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

    // Load Paystack inline
    const PaystackPop = (window as any).PaystackPop;
    if (!PaystackPop) {
      toast.error("Payment system not loaded. Please refresh.");
      setLoading(false);
      return;
    }

    const handler = PaystackPop.setup({
      key: config.paystack_public_key,
      email,
      amount: (order.agreed_price ?? 0) * 100, // Paystack uses kobo
      currency: order.currency,
      ref: `RF-${order.booking_code ?? order.id}-${Date.now()}`,
      metadata: {
        order_id: order.id,
        booking_code: order.booking_code,
      },
      callback: async (response: { reference: string }) => {
        // Update order payment status
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            payment_reference: response.reference,
            status: "in_progress",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        toast.success("Payment successful! Your order is now in production.");
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
    <Button size="sm" onClick={initializePayment} disabled={loading}>
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
  const [convos, setConvos] = useState<{ tenantId: string; name: string; logo: string | null; lastMessage: string; unread: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("tenant_id, message, created_at, is_read, tenants(business_name, logo_url)")
        .eq("customer_user_id", customerId)
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      // Group by tenant
      const map = new Map<string, typeof convos[0]>();
      data.forEach((msg: any) => {
        if (!map.has(msg.tenant_id)) {
          map.set(msg.tenant_id, {
            tenantId: msg.tenant_id,
            name: msg.tenants?.business_name ?? "Designer",
            logo: msg.tenants?.logo_url ?? null,
            lastMessage: msg.message,
            unread: !msg.is_read && msg.sender_type === "designer" ? 1 : 0,
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

  if (loading) return <div className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>;

  if (convos.length === 0) return (
    <Card className="border-border/60">
      <CardContent className="py-16 text-center">
        <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground">No conversations yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Browse the magazine and contact a designer to start.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-2">
      {convos.map((c) => (
        <button
          key={c.tenantId}
          onClick={() => onOpenChat(c.tenantId, c.name)}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left"
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
          {c.unread > 0 && (
            <span className="bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
              {c.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default CustomerDashboard;
