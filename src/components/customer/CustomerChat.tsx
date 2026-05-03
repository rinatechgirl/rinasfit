import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Message {
  id: string;
  message: string;
  sender_type: "customer" | "designer";
  created_at: string;
  is_read: boolean;
}

interface CustomerChatProps {
  tenantId: string;
  tenantName: string;
  customerId: string;
  orderId?: string;
  onClose: () => void;
}

const CustomerChat = ({ tenantId, tenantName, customerId, orderId, onClose }: CustomerChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, message, sender_type, created_at, is_read")
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .order("created_at", { ascending: true });

    if (error) toast.error(error.message);
    else setMessages((data as Message[]) ?? []);

    // Mark designer messages as read
    supabase
      .from("chat_messages")
      .update({ is_read: true } as any)
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .eq("sender_type", "designer");

    setLoading(false);
  };

  useEffect(() => { loadMessages(); }, []);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`customer-chat-${tenantId}-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const msg = payload.new as any;
          if (msg.customer_user_id !== customerId) return;
          // Dedup: the sender already added the message optimistically via handleSend
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg as Message];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, customerId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage(""); // clear immediately for snappy UX
    setSending(true);

    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({
        tenant_id: tenantId,
        customer_user_id: customerId,
        message: text,
        sender_type: "customer",
        is_read: false,
        order_id: orderId ?? null,
      } as any)
      .select("id, message, sender_type, created_at, is_read")
      .single();

    if (error) {
      toast.error(error.message);
      setNewMessage(text); // restore text on failure
    } else if (inserted) {
      // Add immediately — realtime handler will dedup if it arrives too
      setMessages((prev) => {
        if (prev.some((m) => m.id === (inserted as Message).id)) return prev;
        return [...prev, inserted as Message];
      });
    }

    setSending(false);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      style={{ maxHeight: "min(520px, calc(100vh - 2rem))" }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-foreground text-background flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          <div>
            <p className="text-sm font-semibold">{tenantName}</p>
            <p className="text-[10px] text-background/60">Designer</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-background/10 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Start the conversation!</p>
            <p className="text-xs text-muted-foreground mt-1">Ask about pricing, timeline, or customisations.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isCustomer = msg.sender_type === "customer";
            return (
              <div key={msg.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    isCustomer
                      ? "bg-foreground text-background rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-0.5 ${isCustomer ? "text-background/60 text-right" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border flex items-center gap-2 shrink-0">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 h-9 text-sm"
          disabled={sending}
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={sending || !newMessage.trim()}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </form>
    </div>
  );
};

export default CustomerChat;
