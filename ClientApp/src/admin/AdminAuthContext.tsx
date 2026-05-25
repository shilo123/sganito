import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ajax } from '../api/client';
import { clearAdminData, readAdminData, type AdminData } from './adminData';

interface AdminAuthContextValue {
  admin: AdminData | null;
  loading: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminData | null>(() => readAdminData());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onFocus = () => setAdmin(readAdminData());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    admin,
    loading,
    refresh: () => setAdmin(readAdminData()),
    logout: async () => {
      setLoading(true);
      try {
        await ajax('Admin_Logout');
      } catch { /* ignore */ }
      clearAdminData();
      setAdmin(null);
      setLoading(false);
      window.location.href = '/admin/login';
    },
  }), [admin, loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
