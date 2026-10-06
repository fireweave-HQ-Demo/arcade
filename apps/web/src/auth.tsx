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
import { clearFireweaveUser, syncFireweaveUser } from "./fireweave/fw-providers";
import { emitClientAction } from "./observability/openobserve";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
};

const AuthContext = createContext<AuthState | null>(null);

async function bindFireweaveUser(user: User) {
  // Always-on cohort bind (INIT-S8) — never gate behind a control point.
  const reg = await syncFireweaveUser(String(user.id), {
    role: user.role,
    username: user.username,
  });
  if (!reg.ok) {
    console.warn("[fireweave] syncFireweaveUser failed", reg);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { user: next } = await api.me();
    setUser(next);
    if (next) await bindFireweaveUser(next);
    return next;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      void clearFireweaveUser();
    });
    void api
      .me()
      .then(async ({ user: next }) => {
        setUser(next);
        if (next) await bindFireweaveUser(next);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: next } = await api.login(username, password);
    setUser(next);
    await bindFireweaveUser(next);
    void emitClientAction({
      event: "web.auth.login",
      user: next.username,
      metrics: [
        {
          name: "arcade_web_events",
          value: 1,
          labels: { event: "login", result: "ok", role: next.role },
        },
      ],
    });
    return next;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user: next } = await api.register(username, password);
    setUser(next);
    await bindFireweaveUser(next);
    void emitClientAction({
      event: "web.auth.register",
      user: next.username,
      metrics: [
        {
          name: "arcade_web_events",
          value: 1,
          labels: { event: "register", result: "ok", role: next.role },
        },
      ],
    });
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      await clearFireweaveUser();
      void emitClientAction({
        event: "web.auth.logout",
        metrics: [{ name: "arcade_web_events", value: 1, labels: { event: "logout", result: "ok" } }],
      });
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
