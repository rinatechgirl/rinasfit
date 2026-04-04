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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAccount = async (userId: string) => {
    const { data } = await supabase
      .from("customer_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (mountedRef.current) {
      setAccount(data as CustomerAccount | null);
    }
  };

  const refreshAccount = async () => {
    if (customer) await fetchAccount(customer.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      const user = session?.user ?? null;

      // Only treat as customer if metadata role is 'customer'
      const isCustomerUser = user?.user_metadata?.role === "customer";

      setSession(session);
      setCustomer(isCustomerUser ? user : null);

      if (isCustomerUser && user) {
        await fetchAccount(user.id);
      }

      if (mountedRef.current) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        const user = session?.user ?? null;
        const isCustomerUser = user?.user_metadata?.role === "customer";

        setSession(session);
        setCustomer(isCustomerUser ? user : null);

        if (event === "SIGNED_IN" && isCustomerUser && user) {
          await fetchAccount(user.id);
        }
        if (event === "SIGNED_OUT") {
          setAccount(null);
        }
        if (mountedRef.current) setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
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
