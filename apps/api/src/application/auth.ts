import { AppError, type PublicUser } from "@arcade/shared";
import type { ObservabilityPort, SessionRepository, UserRepository } from "../domain/ports";
import { makePasswordHash, makeToken, verifyPassword } from "../infrastructure/auth/password";

const SESSION_DAYS = 30;

export function createAuthUseCases(deps: {
  users: UserRepository;
  sessions: SessionRepository;
  obs: ObservabilityPort;
}) {
  return {
    async register(username: string, password: string) {
      const name = username.trim().toLowerCase();
      if (name.length < 3 || name.length > 32) {
        throw new AppError("Username must be 3–32 characters");
      }
      if (name === "admin") throw new AppError("Username reserved");
      if (password.length < 4) throw new AppError("Password must be at least 4 characters");

      try {
        const user = await deps.users.create(name, makePasswordHash(password), "user");
        void deps.obs.log("info", "auth.register", { user: user.username });
        void deps.obs.metric("arcade_events", 1, { event: "register" });
        return this.login(name, password);
      } catch (e: unknown) {
        if (String(e).includes("unique") || String(e).includes("duplicate")) {
          throw new AppError("Username already taken");
        }
        throw e;
      }
    },

    async login(username: string, password: string) {
      const name = username.trim().toLowerCase();
      const user = await deps.users.findByUsername(name);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw new AppError("Invalid credentials", 401, "unauthorized");
      }
      const token = makeToken();
      const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
      await deps.sessions.create(token, user.id, expires);
      const publicUser: PublicUser = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
      void deps.obs.log("info", "auth.login", { user: publicUser.username, role: publicUser.role });
      void deps.obs.metric("arcade_events", 1, { event: "login" });
      void deps.obs.span({
        name: "auth.login",
        attributes: { "user.name": publicUser.username, "user.role": publicUser.role },
      });
      return { user: publicUser, token, maxAge: SESSION_DAYS * 86400 };
    },

    async logout(token: string | undefined) {
      if (token) await deps.sessions.delete(token);
      void deps.obs.log("info", "auth.logout", {});
    },

    async me(token: string | undefined) {
      if (!token) return null;
      return deps.sessions.findUserByToken(token);
    },
  };
}

export type AuthUseCases = ReturnType<typeof createAuthUseCases>;
