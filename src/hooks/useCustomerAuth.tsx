import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface CustomerAccount {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

interface CustomerAuthContextType {
  customer: User | null;
  session: Session | null;
  account: CustomerAccount | null;
  loading: boolean;
  isCustomer: boolean;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType>({
  customer: null,
  session: null,
  account: null,
  loading: true,
  isCustomer: false,
  signOut: async () => {},
  refreshAccount: async () => {},
});

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);
  const lastFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAccount = async (userId: string, force = false) => {
    if (!force && lastFetchedRef.current === userId && account !== null) return;

    // Safety timeout
    const timeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 8000);

    try {
      const { data } = await supabase
        .from("customer_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (mountedRef.current) {
        setAccount(data as CustomerAccount | null);
        lastFetchedRef.current = userId;
      }
    } catch (err) {
      console.error("useCustomerAuth fetchAccount error:", err);
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current) setLoading(false);
    }
  };

  const refreshAccount = async () => {
    if (customer) await fetchAccount(customer.id, true);
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;

      const user = session?.user ?? null;
      const isCustomerUser = user?.user_metadata?.role === "customer";

      setSession(session);
      setCustomer(isCustomerUser ? user : null);

      if (isCustomerUser && user) {
        await fetchAccount(user.id);
      } else {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;

        // TOKEN_REFRESHED — tab switch, never re-fetch or set loading
        if (event === "TOKEN_REFRESHED") {
          setSession(session);
          const user = session?.user ?? null;
          const isCustomerUser = user?.user_metadata?.role === "customer";
          setCustomer(isCustomerUser ? user : null);
          return;
        }

        // PASSWORD_RECOVERY — ignore for customer context
        if (event === "PASSWORD_RECOVERY") return;

        // SIGNED_OUT
        if (event === "SIGNED_OUT" || !session) {
          setSession(null);
          setCustomer(null);
          setAccount(null);
          lastFetchedRef.current = null;
          setLoading(false);
          return;
        }

        const user = session.user;
        const isCustomerUser = user?.user_metadata?.role === "customer";

        setSession(session);
        setCustomer(isCustomerUser ? user : null);

        if (isCustomerUser) {
          const isNewUser = lastFetchedRef.current !== user.id;
          if (isNewUser) {
            setLoading(true);
            await fetchAccount(user.id);
          }
        } else {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    lastFetchedRef.current = null;
    await supabase.auth.signOut();
    setCustomer(null);
    setAccount(null);
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        session,
        account,
        loading,
        isCustomer: !!customer,
        signOut,
        refreshAccount,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => useContext(CustomerAuthContext);
