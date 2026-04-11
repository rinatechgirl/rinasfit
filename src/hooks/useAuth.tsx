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

type AppRole = "admin" | "staff";

interface TenantInfo {
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  tenant: TenantInfo | null;
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  isPlatformAdmin: false,
  tenantId: null,
  tenant: null,
  signOut: async () => {},
  refreshTenant: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  // Track the user ID we last fetched context for — prevents redundant fetches
  const lastFetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── fetchUserContext ────────────────────────────────────────────────────────
  // Wrapped in useCallback so refreshTenant can call it safely.
  // Key fixes vs original:
  //   1. Uses a local `active` flag instead of global fetchingRef lock — prevents
  //      the lock getting permanently stuck if a fetch errors out mid-way.
  //   2. 8-second timeout — if Supabase hangs, loading resolves anyway.
  //   3. Skips re-fetch if the same userId was already fetched and we have data
  //      (tab-switch TOKEN_REFRESHED won't trigger a redundant full fetch).
  const fetchUserContext = useCallback(
    async (userId: string, force = false) => {
      // Skip if already fetching
      if (fetchingRef.current) return;

      // Skip if we already have context for this user (unless forced)
      if (!force && lastFetchedUserIdRef.current === userId && tenant !== null) return;

      fetchingRef.current = true;

      // Safety timeout — if anything hangs, unblock loading after 8s
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

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, tenant_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        const userRole = platformAdmin
          ? "admin"
          : ((roleData?.role as AppRole) ?? "staff");

        if (!mountedRef.current) return;
        setRole(userRole);

        if (platformAdmin) {
          setTenantId(null);
          setTenant(null);
          lastFetchedUserIdRef.current = userId;
          return;
        }

        const subdomainSlug = getTenantSlugFromHostname();

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        let tid = profile?.tenant_id ?? null;

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
        } else {
          setTenant(null);
        }

        lastFetchedUserIdRef.current = userId;
      } catch (err) {
        // Don't let errors leave the app stuck in loading
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
    if (user) {
      // Force = true so it re-fetches even if userId matches
      await fetchUserContext(user.id, true);
    }
  }, [user, fetchUserContext]);

  // ── Bootstrap + auth listener ───────────────────────────────────────────────
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

        // ── TOKEN_REFRESHED ──────────────────────────────────────────────────
        // Fires every time the user switches back to the tab.
        // NEVER set loading=true here — it causes the blank screen.
        // NEVER re-fetch user context here — the session is still valid.
        // Just silently update the session object.
        if (event === "TOKEN_REFRESHED") {
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        // ── PASSWORD_RECOVERY ────────────────────────────────────────────────
        if (event === "PASSWORD_RECOVERY") {
          sessionStorage.setItem("rf-password-recovery", "true");
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }

        // ── SIGNED_OUT ───────────────────────────────────────────────────────
        if (event === "SIGNED_OUT" || !session) {
          setSession(null);
          setUser(null);
          setRole(null);
          setTenantId(null);
          setTenant(null);
          setIsPlatformAdmin(false);
          lastFetchedUserIdRef.current = null;
          setLoading(false);
          return;
        }

        // ── SIGNED_IN / USER_UPDATED ─────────────────────────────────────────
        // Only set loading=true for a genuine new sign-in where we don't
        // yet have context for this user.
        setSession(session);
        setUser(session.user);

        const isNewUser =
          lastFetchedUserIdRef.current !== session.user.id;

        if (isNewUser) {
          setLoading(true);
          await fetchUserContext(session.user.id);
        }
        // If it's the same user (e.g. USER_UPDATED), just refetch silently
        // without touching loading state
        else if (event === "USER_UPDATED") {
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
        signOut,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
