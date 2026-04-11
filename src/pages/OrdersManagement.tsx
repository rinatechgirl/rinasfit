import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Package, Image as ImageIcon, User } from "lucide-react";
import { format } from "date-fns";
import { sendEmail } from "@/integrations/resend/client";

interface Order {
  id: string;
  booking_code: string | null;
  status: string;
  agreed_price: number | null;
  currency: string;
  payment_status: string;
  created_at: string;
  customer_user_id: string;
  designs: { title: string; image_url: string | null } | null;
  customer_accounts: { full_name: string; email: string } | null;
}

const STATUS_OPTIONS = [
  { value: "pending",     label: "Pending" },
  { value: "confirmed",   label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready",       label: "Ready" },
  { value: "delivered",   label: "Delivered" },
  { value: "cancelled",   label: "Cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  ready:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  delivered:   "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  cancelled:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// Map order status to email template
const STATUS_EMAIL: Record<string, string> = {
  confirmed:   "order_confirmed",
  in_progress: "order_in_progress",
  ready:       "order_ready",
  delivered:   "order_delivered",
};

const OrdersManagement = () => {
  const { tenantId, tenant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!tenantId) return;
    setLoading(true);

    const { data: rawOrders, error } = await supabase
      .from("orders")
      .select(`
        id, booking_code, status, agreed_price, currency,
        payment_status, created_at, customer_user_id,
        designs(title, image_url)
      `)
      .eq("tenant_id", tenantId)
      .not("customer_user_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) { toast.error(error.message); setLoading(false); return; }

    // Fetch customer account info separately since there's no FK relation
    const customerIds = [...new Set((rawOrders ?? []).map((o: any) => o.customer_user_id).filter(Boolean))];
    let accountMap = new Map<string, { full_name: string; email: string }>();
    if (customerIds.length > 0) {
      const { data: accounts } = await (supabase
        .from("customer_accounts" as any)
        .select("user_id, full_name, email")
        .in("user_id", customerIds) as any);
      (accounts ?? []).forEach((a: any) => accountMap.set(a.user_id, { full_name: a.full_name, email: a.email }));
    }

    const mapped = (rawOrders ?? []).map((o: any) => ({
      ...o,
      customer_accounts: accountMap.get(o.customer_user_id) ?? null,
    }));
    setOrders(mapped as Order[]);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [tenantId]);

  const updateStatus = async (order: Order, newStatus: string) => {
    setUpdatingId(order.id);

    const timestamps: Record<string, string> = {};
    if (newStatus === "in_progress") timestamps.production_started_at = new Date().toISOString();
    if (newStatus === "ready") timestamps.ready_at = new Date().toISOString();
    if (newStatus === "delivered") timestamps.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus as any, ...timestamps } as any)
      .eq("id", order.id);

    if (error) {
      toast.error(error.message);
      setUpdatingId(null);
      return;
    }

    // Log to history
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: newStatus,
      note: `Status changed to ${newStatus}`,
    });

    // Send email notification
    const emailTemplate = STATUS_EMAIL[newStatus];
    if (emailTemplate && order.customer_accounts?.email) {
      await sendEmail({
        to: order.customer_accounts.email,
        template: emailTemplate as any,
        data: {
          customer_name: order.customer_accounts.full_name,
          booking_code: order.booking_code ?? order.id,
          business_name: tenant?.business_name ?? "the designer",
          currency: order.currency,
          amount: order.agreed_price?.toLocaleString() ?? "0",
        },
      });
    }

    toast.success(`Order updated to "${newStatus}" — customer notified by email.`);
    fetchOrders();
    setUpdatingId(null);
  };

  const setAgreedPrice = async (orderId: string, price: number) => {
    const { error } = await supabase
      .from("orders")
      .update({ agreed_price: price })
      .eq("id", orderId);

    if (error) toast.error(error.message);
    else { toast.success("Price updated"); fetchOrders(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Customer Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Orders placed by customers through the magazine.
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No customer orders yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Publish designs to the magazine so customers can discover them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Design image */}
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    {order.designs?.image_url
                      ? <img src={order.designs.image_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground/30" /></div>}
                  </div>

                  {/* Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{order.designs?.title ?? "Design"}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {order.customer_accounts?.full_name ?? "Customer"}
                            {order.customer_accounts?.email && ` · ${order.customer_accounts.email}`}
                          </p>
                        </div>
                        {order.booking_code && (
                          <p className="text-xs font-mono text-accent mt-0.5">{order.booking_code}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? ""}`}>
                        {STATUS_OPTIONS.find(s => s.value === order.status)?.label ?? order.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Status updater */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Status:</span>
                        <Select
                          value={order.status}
                          onValueChange={(v) => updateStatus(order, v)}
                          disabled={updatingId === order.id}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {updatingId === order.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </div>

                      {/* Price setter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Price ({order.currency}):</span>
                        <PriceInput
                          current={order.agreed_price}
                          onSave={(price) => setAgreedPrice(order.id, price)}
                        />
                      </div>

                      {/* Payment status */}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        order.payment_status === "paid"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {order.payment_status === "paid" ? "✓ Paid" : "Unpaid"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Ordered {format(new Date(order.created_at), "MMM d, yyyy · HH:mm")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Inline price editor
function PriceInput({
  current,
  onSave,
}: {
  current: number | null;
  onSave: (price: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current?.toString() ?? "");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-foreground underline underline-offset-2 hover:text-accent transition-colors"
      >
        {current ? current.toLocaleString() : "Set price"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-24 text-xs border border-border rounded px-2 bg-background text-foreground"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(Number(value)); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => { onSave(Number(value)); setEditing(false); }}
        className="text-xs text-accent hover:underline"
      >
        Save
      </button>
    </div>
  );
}

export default OrdersManagement;
