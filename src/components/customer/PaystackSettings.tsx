import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CreditCard, ExternalLink } from "lucide-react";

const PaystackSettings = () => {
  const { tenantId } = useAuth();
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return;
      const { data } = await supabase
        .from("tenant_payment_config")
        .select("id, paystack_public_key, paystack_secret_key")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (data) {
        setConfigId(data.id);
        setPublicKey(data.paystack_public_key ?? "");
        setSecretKey(data.paystack_secret_key ?? "");
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      paystack_public_key: publicKey.trim(),
      paystack_secret_key: secretKey.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (configId) {
      ({ error } = await supabase.from("tenant_payment_config").update(payload).eq("id", configId));
    } else {
      const { data, error: insertError } = await supabase
        .from("tenant_payment_config")
        .insert(payload)
        .select("id")
        .single();
      error = insertError;
      if (data) setConfigId(data.id);
    }

    if (error) toast.error(error.message);
    else toast.success("Paystack keys saved! Customers can now pay through your storefront.");

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent" />
          Payment Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add your Paystack API keys so customers can pay for orders directly on your storefront.
          Payments go straight to your Paystack account.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Paystack API Keys</CardTitle>
          <CardDescription>
            Get these from your{" "}
            <a
              href="https://dashboard.paystack.com/#/settings/developer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 inline-flex items-center gap-1"
            >
              Paystack Dashboard <ExternalLink className="w-3 h-3" />
            </a>
            {" "}under Settings → API Keys & Webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pk">Public Key</Label>
              <Input
                id="pk"
                type="text"
                placeholder="pk_live_xxxxxxxxxxxxxxxxxxxx"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Starts with <code>pk_live_</code> (production) or <code>pk_test_</code> (test mode).
                This is safe to share and used by the customer's browser.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sk">Secret Key</Label>
              <div className="relative">
                <Input
                  id="sk"
                  type={showSecret ? "text" : "password"}
                  placeholder="sk_live_xxxxxxxxxxxxxxxxxxxx"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep this private. It's used server-side to verify payments.
              </p>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-400">
                ⚠️ Use <strong>test keys</strong> (<code>pk_test_</code> / <code>sk_test_</code>) while building.
                Switch to live keys when you're ready to accept real payments.
              </p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Payment Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Also need to load Paystack.js — remind admin */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-2">Required: Add Paystack script to your app</p>
          <p className="text-xs text-muted-foreground mb-3">
            Add this line to your <code>index.html</code> inside the <code>&lt;head&gt;</code> tag:
          </p>
          <pre className="text-xs bg-background border border-border rounded p-3 overflow-x-auto">
            {`<script src="https://js.paystack.co/v1/inline.js"></script>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaystackSettings;
