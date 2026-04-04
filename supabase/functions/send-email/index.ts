// supabase/functions/send-email/index.ts
// Deploy with: supabase functions deploy send-email
// Set secret: supabase secrets set RESEND_API_KEY=re_xxxxx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Rina's Fit <orders@rinasfit.com>"; // change to your verified domain

// ─── Email templates ──────────────────────────────────────────────────────────

function getEmailContent(template: string, data: Record<string, string | number>) {
  const brand = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1a1a1a;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Rina's Fit</h1>
        <p style="color:#999;margin:4px 0 0;font-size:12px">Digital Atelier Platform</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
  `;
  const footer = `
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px">
        © ${new Date().getFullYear()} Rina's Fit. All rights reserved.
      </p>
    </div>
  `;

  switch (template) {
    case "booking_code":
      return {
        subject: `Your Booking Code — ${data.booking_code}`,
        html: brand + `
          <h2 style="font-size:22px;margin:0 0 8px">Your order is being negotiated 🎉</h2>
          <p style="color:#6b7280;margin:0 0 24px">Hi ${data.customer_name}, you've selected a design from <strong>${data.business_name}</strong>. Keep this booking code safe.</p>
          <div style="background:#f9fafb;border:2px dashed #d1d5db;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Your Booking Code</p>
            <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.15em;color:#1a1a1a">${data.booking_code}</p>
          </div>
          <p style="color:#6b7280;font-size:14px">Once you and the designer agree on a price, you'll receive a payment link. You can also log in anytime to check your order at <a href="https://rinasfit.com/customer/dashboard" style="color:#1a1a1a">rinasfit.com</a>.</p>
        ` + footer,
      };

    case "order_confirmed":
      return {
        subject: `Order Confirmed — ${data.booking_code}`,
        html: brand + `
          <h2 style="font-size:22px;margin:0 0 8px">Payment received! Production starting ✂️</h2>
          <p style="color:#6b7280;margin:0 0 24px">Hi ${data.customer_name}, your payment of <strong>${data.currency} ${data.amount}</strong> has been confirmed. <strong>${data.business_name}</strong> will now begin production.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;font-size:13px;color:#166534"><strong>Status:</strong> In Production 🟢</p>
            <p style="margin:6px 0 0;font-size:13px;color:#166534"><strong>Booking Code:</strong> ${data.booking_code}</p>
          </div>
          <p style="color:#6b7280;font-size:14px">You'll receive updates as your order progresses. Track it at <a href="https://rinasfit.com/customer/dashboard" style="color:#1a1a1a">rinasfit.com</a>.</p>
        ` + footer,
      };

    case "order_in_progress":
      return {
        subject: `Update: Your order is being made — ${data.booking_code}`,
        html: brand + `
          <h2 style="font-size:22px;margin:0 0 8px">Your outfit is being crafted 🧵</h2>
          <p style="color:#6b7280;margin:0 0 24px">Hi ${data.customer_name}, great news! <strong>${data.business_name}</strong> has started working on your order.</p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;font-size:13px;color:#1e40af"><strong>Status:</strong> In Progress 🔵</p>
            <p style="margin:6px 0 0;font-size:13px;color:#1e40af"><strong>Booking Code:</strong> ${data.booking_code}</p>
          </div>
          <p style="color:#6b7280;font-size:14px">We'll notify you when your outfit is ready for collection.</p>
        ` + footer,
      };

    case "order_ready":
      return {
        subject: `Your order is ready! — ${data.booking_code}`,
        html: brand + `
          <h2 style="font-size:22px;margin:0 0 8px">Your outfit is ready for collection! 🎊</h2>
          <p style="color:#6b7280;margin:0 0 24px">Hi ${data.customer_name}, your order from <strong>${data.business_name}</strong> is complete and ready for pickup or delivery.</p>
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;font-size:13px;color:#92400e"><strong>Status:</strong> Ready 🟡</p>
            <p style="margin:6px 0 0;font-size:13px;color:#92400e"><strong>Booking Code:</strong> ${data.booking_code}</p>
          </div>
          <p style="color:#6b7280;font-size:14px">Contact ${data.business_name} to arrange collection. Their details are in your <a href="https://rinasfit.com/customer/dashboard" style="color:#1a1a1a">dashboard</a>.</p>
        ` + footer,
      };

    case "order_delivered":
      return {
        subject: `Delivered! Order ${data.booking_code} complete`,
        html: brand + `
          <h2 style="font-size:22px;margin:0 0 8px">Order delivered! Thank you 💛</h2>
          <p style="color:#6b7280;margin:0 0 24px">Hi ${data.customer_name}, your order from <strong>${data.business_name}</strong> has been marked as delivered. We hope you love your new outfit!</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;font-size:13px;color:#166534"><strong>Status:</strong> Delivered ✅</p>
            <p style="margin:6px 0 0;font-size:13px;color:#166534"><strong>Booking Code:</strong> ${data.booking_code}</p>
          </div>
          <p style="color:#6b7280;font-size:14px">Thank you for using Rina's Fit. Browse more designs at <a href="https://rinasfit.com/magazine" style="color:#1a1a1a">our magazine</a>.</p>
        ` + footer,
      };

    default:
      return { subject: "Notification from Rina's Fit", html: brand + `<p>${JSON.stringify(data)}</p>` + footer };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { to, template, data } = await req.json();
    const { subject, html } = getEmailContent(template, data);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    const result = await res.json();

    return new Response(JSON.stringify(result), {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
