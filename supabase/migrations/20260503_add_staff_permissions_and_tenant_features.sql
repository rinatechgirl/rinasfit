-- ============================================================
-- Staff permissions + tenant feature flags
-- ============================================================
-- 1. Adds a nullable `permissions` JSONB column to user_roles.
--    • NULL  → use role defaults (admin = all, staff = all)
--    • Object → explicit per-key overrides set by the org admin
--      e.g. { "customers": true, "designs": false, "inbox": true }
--
-- 2. Creates tenant_features table so platform admins can
--    enable/disable modules per organisation.
-- ============================================================

-- ── 1. user_roles.permissions ─────────────────────────────────
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS permissions jsonb;

-- ── 2. tenant_features ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_features (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  features    jsonb       NOT NULL DEFAULT '{
    "customers":    true,
    "measurements": true,
    "designs":      true,
    "categories":   true,
    "orders":       true,
    "inbox":        true,
    "reports":      true,
    "staff":        true,
    "catalogue":    true
  }'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;

-- Platform admin can read and write all tenant features
CREATE POLICY "platform_admin_full_access_tenant_features" ON tenant_features
  FOR ALL
  USING  (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Org members (any role) can read their own tenant's features
CREATE POLICY "org_member_read_tenant_features" ON tenant_features
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM   user_roles
      WHERE  user_id = auth.uid()
    )
  );

-- ── 3. Helper: upsert default features row on tenant creation ──
-- (optional convenience function — call after INSERT into tenants)
CREATE OR REPLACE FUNCTION ensure_tenant_features(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tenant_features (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
END;
$$;
