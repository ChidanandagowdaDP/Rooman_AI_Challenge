import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  storeSession,
} from "./api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null));

  // Validate any stored token once at boot — a revoked/expired token logs
  // the user out instead of failing on their first API call.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((fresh) => {
        if (!fresh) {
          clearSession();
          setUser(null);
        } else {
          storeSession(getToken(), fresh);
          setUser(fresh);
        }
      })
      .catch((err) => {
        // Server unreachable — keep the optimistic session rather than
        // logging someone out just because the API was down for a moment.
        if (!err || err.status !== 0) setUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && getToken()),

      async login(email, password) {
        const result = await api.login({ email, password });
        storeSession(result.token, result.user);
        setUser(result.user);
        return result.user;
      },

      async register(email, password) {
        const result = await api.register({ email, password });
        storeSession(result.token, result.user);
        setUser(result.user);
        return result.user;
      },

      logout() {
        clearSession();
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
