import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearUserData, readUserData, type UserData } from './userData';

interface AuthContextValue {
  user: UserData | null;
  refresh: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(() => readUserData());

  useEffect(() => {
    const onFocus = () => setUser(readUserData());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    refresh: () => setUser(readUserData()),
    logout: () => {
      clearUserData();
      setUser(null);
      window.location.href = '/Login';
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
