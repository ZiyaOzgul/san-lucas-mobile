import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        getProfile(session.user.id)
          .then(setProfile)
          .catch(() => setProfile(null))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        try {
          const p = await getProfile(session.user.id);
          setProfile(p);
        } catch {
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isWaiter = profile?.role === 'waiter';

  // Admins implicitly have all permissions
  const canTakeOrders = isAdmin || (profile?.can_take_orders ?? true);
  const canCloseTables = isAdmin || (profile?.can_close_tables ?? false);
  const canManageProducts = isAdmin || (profile?.can_manage_products ?? false);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isWaiter, canTakeOrders, canCloseTables, canManageProducts }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
