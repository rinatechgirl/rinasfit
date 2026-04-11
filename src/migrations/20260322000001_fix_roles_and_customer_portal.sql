-- ============================================================
-- Migration: Fix has_role scoping, platform admin, and ensure
--            all required tables/columns exist for the customer
--            portal and order system.
-- ============================================================

-- ── 1. Fix has_role() to be tenant-scoped ─────────────────────────────────
--
-- The original has_role() checked for ANY admin row for a user,
-- including the platform admin row (where tenant_id IS NULL).
-- This caused org-level policies to incorrectly allow platform admins
-- and vice versa. Fix: require tenant_id to match the user's tenant.

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND tenant_id IS NOT DISTINCT FROM (
        SELECT tenant_id FROM public.user_roles
        WHERE user_id = _user_id AND tenant_id IS NOT NULL
        LIMIT 1
      )
  )
$$;

-- ── 2. Fix is_platform_admin() ────────────────────────────────────────────
--
-- Platform admin rows have tenant_id = NULL and role = 'admin'.
-- Make the check explicit.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
      AND tenant_id IS NULL
  )
$$;

-- ── 3. Ensure customer_accounts table exists ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name  TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Customers can read/update their own account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_accounts' AND policyname = 'Customers can manage own account'
  ) THEN
    CREATE POLICY "Customers can manage own account"
      ON public.customer_accounts FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Org admins / staff (any authenticated user in a tenant) can read customer accounts
-- for order management purposes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_accounts' AND policyname = 'Authenticated can read customer accounts'
  ) THEN
    CREATE POLICY "Authenticated can read customer accounts"
      ON public.customer_accounts FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ── 4. Ensure cart_items table exists ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cart_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  design_id        UUID NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_user_id, design_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cart_items' AND policyname = 'Customers manage own cart'
  ) THEN
    CREATE POLICY "Customers manage own cart"
      ON public.cart_items FOR ALL
      TO authenticated
      USING (customer_user_id = auth.uid())
      WITH CHECK (customer_user_id = auth.uid());
  END IF;
END $$;

-- ── 5. Ensure chat_messages table exists ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message          TEXT NOT NULL,
  sender_type      TEXT NOT NULL CHECK (sender_type IN ('customer', 'designer')),
  is_read          BOOLEAN NOT NULL DEFAULT false,
  order_id         UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow customers to read/write their own messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Customers can manage own messages'
  ) THEN
    CREATE POLICY "Customers can manage own messages"
      ON public.chat_messages FOR ALL
      TO authenticated
      USING (customer_user_id = auth.uid())
      WITH CHECK (customer_user_id = auth.uid());
  END IF;
END $$;

-- Allow org users (designers) to read/write messages for their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Tenant users can manage tenant messages'
  ) THEN
    CREATE POLICY "Tenant users can manage tenant messages"
      ON public.chat_messages FOR ALL
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $$;

-- Enable realtime for chat_messages
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN others THEN
    NULL; -- already added
  END;
END $$;

-- ── 6. Ensure orders table has all required columns ───────────────────────

CREATE TABLE IF NOT EXISTS public.orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id           UUID,
  design_id             UUID REFERENCES public.designs(id) ON DELETE SET NULL,
  booking_code          TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','in_progress','ready','delivered','cancelled')),
  agreed_price          NUMERIC,
  currency              TEXT NOT NULL DEFAULT 'NGN',
  payment_status        TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  payment_reference     TEXT,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id),
  confirmed_at          TIMESTAMPTZ,
  production_started_at TIMESTAMPTZ,
  ready_at              TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers see their own orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customers can view own orders'
  ) THEN
    CREATE POLICY "Customers can view own orders"
      ON public.orders FOR SELECT
      TO authenticated
      USING (customer_user_id = auth.uid());
  END IF;
END $$;

-- Customers can insert orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customers can insert orders'
  ) THEN
    CREATE POLICY "Customers can insert orders"
      ON public.orders FOR INSERT
      TO authenticated
      WITH CHECK (customer_user_id = auth.uid());
  END IF;
END $$;

-- Customers can update their own orders (for payment)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customers can update own orders'
  ) THEN
    CREATE POLICY "Customers can update own orders"
      ON public.orders FOR UPDATE
      TO authenticated
      USING (customer_user_id = auth.uid());
  END IF;
END $$;

-- Org users (designers) can see and update orders for their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Tenant users can manage tenant orders'
  ) THEN
    CREATE POLICY "Tenant users can manage tenant orders"
      ON public.orders FOR ALL
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $$;

-- ── 7. Ensure order_status_history table exists ───────────────────────────

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_status_history' AND policyname = 'Authenticated can manage order history'
  ) THEN
    CREATE POLICY "Authenticated can manage order history"
      ON public.order_status_history FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── 8. Ensure tenant_payment_config table exists ──────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_payment_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  paystack_public_key TEXT,
  paystack_secret_key TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payment_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tenant_payment_config' AND policyname = 'Tenant admins manage payment config'
  ) THEN
    CREATE POLICY "Tenant admins manage payment config"
      ON public.tenant_payment_config FOR ALL
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id())
      WITH CHECK (tenant_id = public.get_user_tenant_id());
  END IF;
END $$;

-- Public key is readable by customers (needed for Paystack checkout)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tenant_payment_config' AND policyname = 'Customers can read public payment config'
  ) THEN
    CREATE POLICY "Customers can read public payment config"
      ON public.tenant_payment_config FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ── 9. Add is_public column to designs if missing ────────────────────────

ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Public designs are readable by everyone (unauthenticated too for magazine)
DROP POLICY IF EXISTS "Public designs readable by all" ON public.designs;
CREATE POLICY "Public designs readable by all"
  ON public.designs FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- ── 10. Auto-generate booking_code on order insert ───────────────────────

CREATE OR REPLACE FUNCTION public.generate_booking_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _code TEXT;
  _exists BOOLEAN;
BEGIN
  IF NEW.booking_code IS NULL THEN
    LOOP
      _code := 'RF-' || upper(substring(md5(random()::text) from 1 for 6));
      SELECT EXISTS(SELECT 1 FROM public.orders WHERE booking_code = _code) INTO _exists;
      EXIT WHEN NOT _exists;
    END LOOP;
    NEW.booking_code := _code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_code ON public.orders;
CREATE TRIGGER set_booking_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_booking_code();
