-- ============================================================
-- 1. Design pricing — designer sets base price on each design
-- ============================================================
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS price NUMERIC;

-- ============================================================
-- 2. Notifications — enable RLS + add policies
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Each user reads only their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Any authenticated user can insert a notification (order events cross user boundaries)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can mark their own notifications as read
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Platform admins can manage all
DROP POLICY IF EXISTS "Platform admins manage all notifications" ON public.notifications;
CREATE POLICY "Platform admins manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
