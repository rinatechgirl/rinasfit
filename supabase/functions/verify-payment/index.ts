// supabase/functions/verify-payment/index.ts
// Deploy with: supabase functions deploy verify-payment
//
// This function verifies a Paystack transaction server-side and only marks an
// order as paid after Paystack confirms the charge. The Paystack secret key
// never leaves the server.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Authenticate the calling user ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request body ───────────────────────────────────────────────────
    const { reference, order_id } = await req.json();
    if (!reference || !order_id) {
      return new Response(JSON.stringify({ error: "Missing reference or order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch the order and confirm it belongs to the authenticated customer ─
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, tenant_id, customer_id, payment_status, agreed_price")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure the authenticated user owns this order
    if (order.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard against double-processing
    if (order.payment_status === "paid") {
      return new Response(JSON.stringify({ success: true, already_paid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch tenant's Paystack secret key (server-side only) ────────────────
    const { data: paymentConfig, error: configError } = await supabaseAdmin
      .from("tenant_payment_config" as any)
      .select("paystack_secret_key")
      .eq("tenant_id", order.tenant_id)
      .maybeSingle() as any;

    if (configError || !paymentConfig?.paystack_secret_key) {
      return new Response(JSON.stringify({ error: "Payment not configured for this tenant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify with Paystack API ─────────────────────────────────────────────
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paymentConfig.paystack_secret_key}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status || paystackData.data?.status !== "success") {
      return new Response(
        JSON.stringify({ error: "Payment verification failed", detail: paystackData.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Confirm the amount matches (Paystack returns kobo/pesewas, agreed_price is in major units)
    const expectedAmountKobo = Math.round((order.agreed_price ?? 0) * 100);
    const paidAmountKobo = paystackData.data.amount;
    if (paidAmountKobo < expectedAmountKobo) {
      return new Response(
        JSON.stringify({ error: "Amount mismatch: payment amount less than order amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Mark order as paid ───────────────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        payment_reference: reference,
        status: "in_progress",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
