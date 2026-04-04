import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, User } from "lucide-react";
import { format } from "date-fns";
import { sendEmail } from "@/integrations/resend/client";

interface Message {
  id: string;
  sender_type: "customer" | "designer";
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  customer_user_id: string;
  customer_name: string;
  last_message: string;
  unread: number;
  order_id?: string;
}

const DesignerInbox = () => {
  const { user, tenantId } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    if (!tenantId) return;

    const { data } = await supabase
      .from("chat_messages")
      .select("customer_user_id, message, created_at, is_read, sender_type, customer_accounts(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    const map = new Map<string, Conversation>();
    data.forEach((msg: any) => {
      if (!map.has(msg.customer_user_id)) {
        map.set(msg.customer_user_id, {
          customer_user_id: msg.customer_user_id,
          customer_name: msg.customer_accounts?.full_name ?? "Customer",
          last_message: msg.message,
          unread: !msg.is_read && msg.sender_type === "customer" ? 1 : 0,
        });
      } else if (!msg.is_read && msg.sender_type === "customer") {
        map.get(msg.customer_user_id)!.unread++;
      }
    });

    setConvos(Array.from(map.values()));
    setLoading(false);
  };

  const fetchMessages = async (customerId: string) => {
    if (!tenantId) return;

    const { data } = await supabase
      .from("chat_messages")
      .select("id, sender_type, sender_id, message, created_at, is_read")
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .order("created_at", { ascending: true });

    setMessages((data as Message[]) ?? []);

    // Mark customer messages as read
    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .eq("sender_type", "customer")
      .eq("is_read", false);

    // Update unread count in sidebar
    setConvos((prev) =>
      prev.map((c) => c.customer_user_id === customerId ? { ...c, unread: 0 } : c)
    );
  };

  useEffect(() => {
    fetchConversations();

    if (!tenantId) return;
    const channel = supabase
      .channel(`designer-inbox:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `tenant_id=eq.${tenantId}` },
        () => { fetchConversations(); if (activeCustomerId) fetchMessages(activeCustomerId); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (activeCustomerId) fetchMessages(activeCustomerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCustomerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !user || !tenantId || !activeCustomerId) return;
    setSending(true);
    setInput("");

    await supabase.from("chat_messages").insert({
      tenant_id: tenantId,
      customer_user_id: activeCustomerId,
      sender_type: "designer",
      sender_id: user.id,
      message: text,
    });

    fetchMessages(activeCustomerId);
    setSending(false);
  };

  const sendBookingCode = async (customerId: string, orderId: string) => {
    if (!tenantId) return;

    // Generate booking code
    const { data: code } = await supabase.rpc("generate_booking_code", { p_tenant_id: tenantId });

    // Update order
    await supabase.from("orders").update({ booking_code: code, status: "confirmed" }).eq("id", orderId);

    // Get customer email
    const { data: acct } = await supabase
      .from("customer_accounts")
      .select("email, full_name")
      .eq("user_id", customerId)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("business_name")
      .eq("id", tenantId)
      .maybeSingle();

    // Send email
    if (acct?.email) {
      await sendEmail({
        to: acct.email,
        template: "booking_code",
        data: {
          customer_name: acct.full_name,
          booking_code: code,
          business_name: tenant?.business_name ?? "the designer",
        },
      });
    }

    // Send in-chat notification
    await supabase.from("chat_messages").insert({
      tenant_id: tenantId,
      customer_user_id: customerId,
      sender_type: "designer",
      sender_id: user!.id,
      message: `✅ Your booking code is: ${code}. Please confirm your order and proceed to payment.`,
      order_id: orderId,
    });

    fetchMessages(customerId);
  };

  const activeConvo = convos.find((c) => c.customer_user_id === activeCustomerId);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Customer Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">Chat with customers interested in your designs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[600px]">
        {/* Conversations list */}
        <Card className="border-border/60 overflow-hidden flex flex-col">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : convos.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              convos.map((c) => (
                <button
                  key={c.customer_user_id}
                  onClick={() => setActiveCustomerId(c.customer_user_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 ${
                    activeCustomerId === c.customer_user_id ? "bg-muted/40" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{c.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="bg-accent text-accent-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Active chat */}
        <Card className="border-border/60 overflow-hidden flex flex-col">
          {!activeCustomerId ? (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-muted-foreground text-sm">Select a conversation</p>
              </div>
            </CardContent>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <p className="font-medium text-foreground text-sm">{activeConvo?.customer_name ?? "Customer"}</p>
                </div>
                <SendBookingCodeButton
                  customerId={activeCustomerId}
                  tenantId={tenantId ?? ""}
                  onSend={sendBookingCode}
                />
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.sender_type === "designer";
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                          isMe
                            ? "bg-foreground text-background rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="leading-relaxed">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-background/50 text-right" : "text-muted-foreground"}`}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2 shrink-0">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message…"
                  className="flex-1 h-9 text-sm"
                  disabled={sending}
                />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

// Helper: button to send booking code from an active order
function SendBookingCodeButton({
  customerId,
  tenantId,
  onSend,
}: {
  customerId: string;
  tenantId: string;
  onSend: (customerId: string, orderId: string) => Promise<void>;
}) {
  const [orders, setOrders] = useState<{ id: string; booking_code: string | null }[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase
      .from("orders")
      .select("id, booking_code")
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .eq("status", "pending")
      .then(({ data }) => setOrders(data ?? []));
  }, [customerId, tenantId]);

  if (orders.length === 0) return null;

  const handleSend = async () => {
    const order = orders[0];
    if (order.booking_code) return; // already sent
    setSending(true);
    await onSend(customerId, order.id);
    setSending(false);
    setOrders([]);
  };

  return (
    <Button size="sm" variant="outline" onClick={handleSend} disabled={sending} className="text-xs gap-1.5">
      {sending && <Loader2 className="w-3 h-3 animate-spin" />}
      Send Booking Code
    </Button>
  );
}

export default DesignerInbox;
