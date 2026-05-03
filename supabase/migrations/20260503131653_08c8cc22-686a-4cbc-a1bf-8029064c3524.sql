
-- 1. Make legacy orders.customer_id nullable (we use customer_user_id now)
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;

-- 2. Make chat_messages.sender_id nullable (sender_type tells us who sent it)
ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- 3. Avatars bucket for customer profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-avatars', 'customer-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "customer avatars public read" ON storage.objects;
CREATE POLICY "customer avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-avatars');

-- Each user manages their own folder named with their auth uid
DROP POLICY IF EXISTS "customer avatars user upload" ON storage.objects;
CREATE POLICY "customer avatars user upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'customer-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "customer avatars user update" ON storage.objects;
CREATE POLICY "customer avatars user update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'customer-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "customer avatars user delete" ON storage.objects;
CREATE POLICY "customer avatars user delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'customer-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
