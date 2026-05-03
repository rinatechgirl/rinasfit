-- ============================================================
-- 1. Fix notifications FK (DEFERRABLE)
-- ============================================================
-- The notifications_order_id_fkey fails when a BEFORE INSERT trigger on
-- orders tries to write a notification for NEW.id before the order row is
-- committed.  Making the constraint DEFERRABLE shifts the FK check to the
-- end of the transaction, by which point the order already exists.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_order_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES public.orders(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- 2. Allow portal customers to store their own measurements
-- ============================================================

-- 2a. Make customer_id nullable — portal customers have no CRM record yet.
ALTER TABLE public.measurements
  ALTER COLUMN customer_id DROP NOT NULL;

-- 2b. Add customer_user_id to link directly to the auth user who submitted
--     the measurement from the customer portal.
ALTER TABLE public.measurements
  ADD COLUMN IF NOT EXISTS customer_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2c. RLS: customers can insert measurements for their own orders.
--     The application always sets tenant_id so the designer can see them.
DROP POLICY IF EXISTS "Customers can insert own measurements" ON public.measurements;
CREATE POLICY "Customers can insert own measurements"
  ON public.measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

-- 2d. RLS: customers can view their own measurements.
DROP POLICY IF EXISTS "Customers can view own measurements" ON public.measurements;
CREATE POLICY "Customers can view own measurements"
  ON public.measurements
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

-- 2e. Ensure measurement_id column exists on orders (it may already be there).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS measurement_id UUID
    REFERENCES public.measurements(id) ON DELETE SET NULL;
