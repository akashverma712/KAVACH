import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(!tokenStore.get());
  const [notice, setNotice] = useState(null);

  const logout = useCallback((message) => {
    tokenStore.clear();
    setAdmin(null);
    if (message) setNotice(message);
  }, []);

  useEffect(() => { setUnauthorizedHandler((m) => logout(m || 'Your admin session ended. Sign in again.')); }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/admin/auth/me').then((d) => setAdmin(d.admin)).catch(() => tokenStore.clear()).finally(() => setReady(true));
  }, []);

  const signIn = useCallback((token, a) => { tokenStore.set(token); setAdmin(a); setNotice(null); }, []);

  const value = useMemo(() => ({ admin, ready, signIn, logout, notice, clearNotice: () => setNotice(null) }), [admin, ready, signIn, logout, notice]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
