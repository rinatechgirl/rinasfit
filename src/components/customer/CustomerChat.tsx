import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import fallbackLogo from "@/assets/logo.jpeg";

interface Message {
  id: string;
  sender_type: "customer" | "designer";
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface Props {
  tenantId: string;
  tenantName: string;
  customerId: string;
  orderId?: string;
  onClose: () => void;
}

const CustomerChat = ({ tenantId, tenantName, customerId, orderId, onClose }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    const { data } = await (supabase
      .from("chat_messages" as any)
      .select("id, sender_type, sender_id, message, created_at, is_read")
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .order("created_at", { ascending: true }) as any);

    setMessages((data as Message[]) ?? []);
    setLoading(false);

    // Mark designer messages as read
    await (supabase
      .from("chat_messages" as any)
      .update({ is_read: true } as any)
      .eq("tenant_id", tenantId)
      .eq("customer_user_id", customerId)
      .eq("sender_type", "designer")
      .eq("is_read", false) as any);
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat:${tenantId}:${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id !== customerId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, customerId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      sender_type: "customer",
      sender_id: customerId,
      message: text,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages((prev) => [...prev, tempMsg]);

    const { error } = await (supabase.from("chat_messages" as any).insert({
      tenant_id: tenantId,
      customer_user_id: customerId,
      sender_type: "customer",
      sender_id: customerId,
      message: text,
      order_id: orderId ?? null,
    } as any) as any);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } else {
      fetchMessages();
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] flex flex-col shadow-2xl rounded-2xl border border-border overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <img
          src={fallbackLogo}
          alt={tenantName}
          className="w-8 h-8 rounded-lg object-contain border border-border"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{tenantName}</p>
          <p className="text-xs text-muted-foreground">Fashion Designer</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[380px] min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            <p>No messages yet.</p>
            <p className="mt-1">Say hi and tell the designer which outfit you're interested in!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === "customer";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
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
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-card flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1 h-9 text-sm"
          disabled={sending}
          autoFocus
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={sendMessage}
          disabled={sending || !input.trim()}
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
};

export default CustomerChat;
