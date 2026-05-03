// ─────────────────────────────────────────────────────────────────────────────
// Resend Email Integration
//
// Setup steps:
// 1. Go to https://resend.com → sign up free
// 2. Add & verify your domain (or use onboarding@resend.dev for testing)
// 3. Create an API key
// 4. In Supabase: Project Settings → Edge Functions → Add secret:
//       RESEND_API_KEY = re_xxxxxxxxxxxx
// 5. Deploy the edge function in /supabase/functions/send-email/index.ts
// ─────────────────────────────────────────────────────────────────────────────

export type EmailTemplate =
  | "booking_code"
  | "order_confirmed"
  | "order_in_progress"
  | "order_ready"
  | "order_shipped"
  | "order_delivered"
  | "password_reset";

export interface SendEmailPayload {
  to: string;
  template: EmailTemplate;
  data: Record<string, string | number>;
}

export async function sendEmail(payload: SendEmailPayload): Promise<boolean> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Uses VITE_SUPABASE_PUBLISHABLE_KEY (the anon/public key)
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );
    return res.ok;
  } catch {
    console.error("Email send failed");
    return false;
  }
}
