import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, setUnauthorizedHandler, type User } from "./api";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { user: next } = await api.me();
    setUser(next);
    return next;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    void api
      .me()
      .then(({ user: next }) => setUser(next))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: next } = await api.login(username, password);
    setUser(next);
    return next;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user: next } = await api.register(username, password);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Require cookie session; keep deep-link path for post-login redirect. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <section className="panel">
        <p className="hint">checking session…</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
