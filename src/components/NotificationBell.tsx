import { useState, useRef, useEffect } from "react";
import { Bell, BellRing, Check, CheckCheck, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

interface Props {
  userId: string | null | undefined;
  className?: string;
}

const NotificationBell = ({ userId, className }: Props) => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 animate-[bell-shake_0.4s_ease-in-out]" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { markRead(n.id); }}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors",
                    !n.is_read && "bg-accent/5"
                  )}
                >
                  <div className={cn(
                    "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    n.is_read ? "bg-muted" : "bg-accent/20"
                  )}>
                    <Package className={cn("w-4 h-4", n.is_read ? "text-muted-foreground" : "text-accent")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs leading-relaxed",
                      n.is_read ? "text-muted-foreground" : "text-foreground font-medium"
                    )}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {format(new Date(n.created_at), "MMM d · HH:mm")}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border/60 text-center">
              <button
                onClick={() => { markAllRead(); setOpen(false); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto transition-colors"
              >
                <Check className="w-3 h-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
