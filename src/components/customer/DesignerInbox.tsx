import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MessageCircle, Send, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import fallbackLogo from "@/assets/logo.jpeg";

interface Conversation {
  customerId: string;
  customerName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  message: string;
  sender_type: "customer" | "designer";
  created_at: string;
  is_read: boolean;
}

const DesignerInbox = () => {
  const { tenantId } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [activeCustomerName, setActiveCustomerName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load conversation list ─────────────────────────────────────────────────
  const loadConversations = async () => {
    if (!tenantId) return;
    setLoadingConvos(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("customer_user_id, message, created_at, is_read, sender_type")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) { toast.error(error.message); setLoadingConvos(false); return; }

    // Group by customer
    const map = new Map<string, Conversation>();
    const customerIds = new Set<string>();

    (data ?? []).forEach((msg: any) => {
      customerIds.add(msg.customer_user_id);
      if (!map.has(msg.customer_user_id)) {
        map.set(msg.customer_user_id, {
          customerId: msg.customer_user_id,
          customerName: msg.customer_user_id, // placeholder, resolved below
          lastMessage: msg.message,
          lastMessageAt: msg.created_at,
          unreadCount: (!msg.is_read && msg.sender_type === "customer") ? 1 : 0,
        });
      } else if (!msg.is_read && msg.sender_type === "customer") {
        map.get(msg.customer_user_id)!.unreadCount++;
      }
    });

    // Resolve customer names from customer_accounts
    if (customerIds.size > 0) {
      const { data: accounts } = await (supabase
        .from("customer_accounts" as any)
        .select("user_id, full_name")
        .in("user_id", Array.from(customerIds)) as any);

      (accounts ?? []).forEach((a: any) => {
        if (map.has(a.user_id)) {
          map.get(a.user_id)!.customerName = a.full_name || a.user_id;
        }
      });
    }

    setConversations(Array.from(map.values()));
    setLoadingConvos(false);
  };

  useEffect(() => { loadConversations(); }, [tenantId]);

  // ── Load messages for selected conversation ────────────────────────────────
  const loadMessages = async (customerId: string) => {
    if (!tenantId) return;
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, message, sender_type, created_at, is_read")
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .order("created_at", { ascending: true });

    if (error) toast.error(error.message);
    else setMessages((data as Message[]) ?? []);

    // Mark customer messages as read
    await supabase
      .from("chat_messages")
      .update({ is_read: true } as any)
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .eq("sender_type", "customer");

    setLoadingMessages(false);
  };

  useEffect(() => {
    if (activeCustomerId) loadMessages(activeCustomerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCustomerId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`designer-inbox-${tenantId}`)
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
          if (activeCustomerId && msg.customer_user_id === activeCustomerId) {
            setMessages((prev) => [...prev, msg as Message]);
            supabase
              .from("chat_messages")
              .update({ is_read: true } as any)
              .eq("id", msg.id);
          }
          // Always refresh conversations list for unread counts
          loadConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, activeCustomerId]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeCustomerId || !tenantId) return;
    setSending(true);

    const { error } = await supabase.from("chat_messages").insert({
      tenant_id: tenantId,
      customer_user_id: activeCustomerId,
      message: newMessage.trim(),
      sender_type: "designer",
      is_read: false,
    } as any);

    if (error) toast.error(error.message);
    else setNewMessage("");

    setSending(false);
  };

  const openConversation = (convo: Conversation) => {
    setActiveCustomerId(convo.customerId);
    setActiveCustomerName(convo.customerName);
  };

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Customer Inbox</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Chat with customers who've placed orders or enquiries.
        </p>
      </div>

      <div className="flex-1 flex border border-border rounded-xl overflow-hidden min-h-0">

        {/* ── Conversation list ── */}
        <div
          className={`${activeCustomerId ? "hidden md:flex" : "flex"} w-full md:w-72 flex-col border-r border-border bg-card`}
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Conversations</p>
          </div>

          {loadingConvos ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <MessageCircle className="w-10 h-10 mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Customers can message you after selecting a design.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map((convo) => (
                <button
                  key={convo.customerId}
                  onClick={() => openConversation(convo)}
                  className={`w-full flex items-start gap-3 p-4 border-b border-border/50 text-left hover:bg-muted/30 transition-colors ${
                    activeCustomerId === convo.customerId ? "bg-accent/10 border-l-2 border-l-accent" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium text-foreground truncate">{convo.customerName}</p>
                      {convo.unreadCount > 0 && (
                        <span className="bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastMessage}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {format(new Date(convo.lastMessageAt), "MMM d, HH:mm")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Chat pane ── */}
        {activeCustomerId ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
              <button
                onClick={() => setActiveCustomerId(null)}
                className="md:hidden p-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{activeCustomerName}</p>
                <p className="text-xs text-muted-foreground">Customer</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="w-10 h-10 mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isDesigner = msg.sender_type === "designer";
                  return (
                    <div key={msg.id} className={`flex ${isDesigner ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isDesigner
                            ? "bg-accent text-accent-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isDesigner ? "text-accent-foreground/70 text-right" : "text-muted-foreground"}`}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} className="p-4 border-t border-border bg-card flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1"
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center flex-col text-center p-8">
            <MessageCircle className="w-14 h-14 mb-4 text-muted-foreground/20" />
            <p className="text-muted-foreground">Select a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignerInbox;
