import { createContext, useContext, useMemo, useState } from "react";
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
