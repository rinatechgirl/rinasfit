import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTenantSlugFromHostname } from "@/hooks/useTenantSlug";
import type { User, Session } from "@supabase/supabase-js";

// ─── Role types ───────────────────────────────────────────────────────────────

export type AppRole = "admin" | "staff";

// Permission keys that can be toggled per staff member by org admin
export type PermissionKey =
  | "customers"
  | "measurements"
  | "designs"
  | "categories"
  | "orders"
  | "inbox"
  | "catalogue";

// Feature keys that can be toggled per tenant by platform admin
export type FeatureKey =
  | "customers"
  | "measurements"
  | "designs"
  | "categories"
  | "orders"
  | "inbox"
  | "reports"
  | "staff"
  | "catalogue";

export type StaffPermissions = Partial<Record<PermissionKey, boolean>>;
export type TenantFeatures   = Partial<Record<FeatureKey, boolean>>;

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface TenantInfo {
  id: string;
  business_name: string;
  slug: string;
  status: string;
  logo_url?: string | null;
  business_email?: string;
  owner_name?: string;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  description?: string | null;
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  tenant: TenantInfo | null;
  /** Null for admins / platform admins (all permissions granted). For staff,
   *  an object where any key set to false is blocked. Missing keys = allowed. */
  permissions: StaffPermissions | null;
  /** Feature flags set by the platform admin per organisation.
   *  Missing keys or true = feature is on. False = disabled for this org. */
  tenantFeatures: TenantFeatures | null;
  /**
   * Returns true if the current user may access the given module.
   * Always true for org-admins and platform-admins.
   * For staff: checks their personal permission object.
   */
  hasPermission: (key: PermissionKey) => boolean;
  /**
   * Returns true if the platform admin has enabled the given feature
   * for the current organisation. Always true for platform-admins.
   */
  isFeatureEnabled: (key: FeatureKey) => boolean;
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

// ─── Context defaults ─────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  isPlatformAdmin: false,
  tenantId: null,
  tenant: null,
  permissions: null,
  tenantFeatures: null,
  hasPermission: () => true,
  isFeatureEnabled: () => true,
  signOut: async () => {},
  refreshTenant: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]                       = useState<User | null>(null);
  const [session, setSession]                 = useState<Session | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [role, setRole]                       = useState<AppRole | null>(null);
  const [tenantId, setTenantId]               = useState<string | null>(null);
  const [tenant, setTenant]                   = useState<TenantInfo | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [permissions, setPermissions]         = useState<StaffPermissions | null>(null);
  const [tenantFeatures, setTenantFeatures]   = useState<TenantFeatures | null>(null);

  const mountedRef              = useRef(true);
  const fetchingRef             = useRef(false);
  const lastFetchedUserIdRef    = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── hasPermission ────────────────────────────────────────────────────────────
  // Admins and platform admins always have all permissions.
  // For staff: permission is granted unless explicitly set to false.
  const hasPermission = useCallback(
    (key: PermissionKey): boolean => {
      if (isPlatformAdmin || role === "admin") return true;
      if (!permissions) return true;
      return permissions[key] !== false;
    },
    [isPlatformAdmin, role, permissions]
  );

  // ── isFeatureEnabled ─────────────────────────────────────────────────────────
  // Platform admins can always see everything.
  // Otherwise: feature is on unless explicitly set to false by platform admin.
  const isFeatureEnabled = useCallback(
    (key: FeatureKey): boolean => {
      if (isPlatformAdmin) return true;
      if (!tenantFeatures) return true;
      return tenantFeatures[key] !== false;
    },
    [isPlatformAdmin, tenantFeatures]
  );

  // ── fetchUserContext ─────────────────────────────────────────────────────────
  const fetchUserContext = useCallback(
    async (userId: string, force = false) => {
      if (fetchingRef.current) return;
      if (!force && lastFetchedUserIdRef.current === userId && tenant !== null) return;

      fetchingRef.current = true;

      const timeout = setTimeout(() => {
        if (mountedRef.current) setLoading(false);
        fetchingRef.current = false;
      }, 8000);

      try {
        try { await supabase.rpc("accept_pending_invitation"); } catch { /* ignore */ }

        const { data: isPlatAdmin } = await supabase.rpc("is_platform_admin");
        const platformAdmin = isPlatAdmin === true;

        if (!mountedRef.current) return;
        setIsPlatformAdmin(platformAdmin);

        // ── Platform admin: skip tenant resolution ───────────────────────────
        if (platformAdmin) {
          setRole("admin");
          setTenantId(null);
          setTenant(null);
          setPermissions(null);
          setTenantFeatures(null);
          lastFetchedUserIdRef.current = userId;
          return;
        }

        // ── Load role + permissions from user_roles ──────────────────────────
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, tenant_id, permissions")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        const userRole: AppRole = (roleData?.role as AppRole) ?? "staff";
        const userPermissions: StaffPermissions | null =
          userRole === "staff" ? ((roleData as any)?.permissions ?? null) : null;

        if (!mountedRef.current) return;
        setRole(userRole);
        setPermissions(userPermissions);

        // ── Resolve tenant ID ────────────────────────────────────────────────
        const subdomainSlug = getTenantSlugFromHostname();

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        const tid = profile?.tenant_id ?? null;

        if (!tid && subdomainSlug) {
          const { data: subdomainTenant } = await supabase
            .from("tenants")
            .select(
              "id, business_name, slug, status, logo_url, business_email, owner_name, phone, address, country, description"
            )
            .eq("slug", subdomainSlug)
            .maybeSingle();

          if (subdomainTenant && mountedRef.current) {
            setTenant(subdomainTenant as TenantInfo);
            setTenantId(subdomainTenant.id);
            lastFetchedUserIdRef.current = userId;
            return;
          }
        }

        if (!mountedRef.current) return;
        setTenantId(tid);

        if (tid) {
          // ── Load tenant info ─────────────────────────────────────────────
          const { data: tenantData } = await supabase
            .from("tenants")
            .select(
              "id, business_name, slug, status, logo_url, business_email, owner_name, phone, address, country, description"
            )
            .eq("id", tid)
            .maybeSingle();

          if (mountedRef.current) {
            setTenant(tenantData as TenantInfo | null);
          }

          // ── Load tenant feature flags ────────────────────────────────────
          const { data: featuresRow } = await supabase
            .from("tenant_features")
            .select("features")
            .eq("tenant_id", tid)
            .maybeSingle();

          if (mountedRef.current) {
            setTenantFeatures((featuresRow as any)?.features ?? null);
          }
        } else {
          setTenant(null);
          setTenantFeatures(null);
        }

        lastFetchedUserIdRef.current = userId;
      } catch (err) {
        console.error("useAuth fetchUserContext error:", err);
      } finally {
        clearTimeout(timeout);
        fetchingRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const refreshTenant = useCallback(async () => {
    if (user) await fetchUserContext(user.id, true);
  }, [user, fetchUserContext]);

  // ── Bootstrap + auth listener ────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserContext(session.user.id);
      } else {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        if (event === "TOKEN_REFRESHED") {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        if (event === "PASSWORD_RECOVERY") {
          sessionStorage.setItem("rf-password-recovery", "true");
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        if (event === "SIGNED_OUT" || !session) {
          setSession(null);
          setUser(null);
          setRole(null);
          setTenantId(null);
          setTenant(null);
          setIsPlatformAdmin(false);
          setPermissions(null);
          setTenantFeatures(null);
          lastFetchedUserIdRef.current = null;
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session.user);

        const isNewUser = lastFetchedUserIdRef.current !== session.user.id;
        if (isNewUser) {
          setLoading(true);
          await fetchUserContext(session.user.id);
        } else if (event === "USER_UPDATED") {
          await fetchUserContext(session.user.id, true);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserContext]);

  const signOut = async () => {
    lastFetchedUserIdRef.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        isAdmin: role === "admin",
        isPlatformAdmin,
        tenantId,
        tenant,
        permissions,
        tenantFeatures,
        hasPermission,
        isFeatureEnabled,
        signOut,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
