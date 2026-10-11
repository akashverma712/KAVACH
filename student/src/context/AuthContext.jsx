import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearApiCache, setUnauthorizedHandler, tokenStore } from '../lib/api';

const AuthCtx = createContext(null);
const USER_KEY = 'kavach-user';

const cachedUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (tokenStore.get() ? cachedUser() : null));
  const [ready, setReady] = useState(!tokenStore.get() || Boolean(cachedUser()));
  const [sessionMessage, setSessionMessage] = useState(null);

  const saveUser = useCallback((u) => {
    setUser(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }, []);

  const logout = useCallback(async (message) => {
    tokenStore.clear();
    saveUser(null);
    ['kavach-contacts', 'kavach-chat'].forEach((k) => localStorage.removeItem(k));
    await clearApiCache();
    if (message) setSessionMessage(message);
  }, [saveUser]);

  useEffect(() => {
    setUnauthorizedHandler((msg) => logout(msg || 'Your session ended. Please sign in again.'));
  }, [logout]);

  // Refresh the profile in the background (works offline thanks to the cached copy)
  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/me')
      .then((d) => saveUser(d.user))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [saveUser]);

  const signIn = useCallback((token, u) => {
    tokenStore.set(token);
    saveUser(u);
    setSessionMessage(null);
  }, [saveUser]);

  const value = useMemo(() => ({
    user, ready, signIn, logout, setUser: saveUser, sessionMessage, clearSessionMessage: () => setSessionMessage(null),
  }), [user, ready, signIn, logout, saveUser, sessionMessage]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
