import { AppError, type PublicUser } from "@arcade/shared";
import type { ObservabilityPort, SessionRepository, TraceCtx, UserRepository } from "../domain/ports";
import { makePasswordHash, makeToken, verifyPassword } from "../infrastructure/auth/password";

const SESSION_DAYS = 30;

function traceFields(trace?: TraceCtx) {
  return { traceId: trace?.traceId, parentSpanId: trace?.parentSpanId };
}

export function createAuthUseCases(deps: {
  users: UserRepository;
  sessions: SessionRepository;
  obs: ObservabilityPort;
}) {
  return {
    async register(username: string, password: string, trace?: TraceCtx) {
      const name = username.trim().toLowerCase();
      if (name.length < 3 || name.length > 32) {
        await deps.obs.emitAction({
          event: "auth.failure",
          ...traceFields(trace),
          logLevel: "warn",
          logFields: { reason: "invalid_username", event_attempt: "register" },
          metrics: [
            { name: "arcade_auth_failures_total", value: 1, labels: { reason: "invalid_username" } },
            { name: "arcade_events", value: 1, labels: { event: "register", result: "fail" } },
          ],
          statusCode: 2,
          statusMessage: "invalid username",
        });
        throw new AppError("Username must be 3–32 characters");
      }
      if (name === "admin") {
        await deps.obs.emitAction({
          event: "auth.failure",
          ...traceFields(trace),
          logLevel: "warn",
          logFields: { reason: "reserved", event_attempt: "register" },
          metrics: [
            { name: "arcade_auth_failures_total", value: 1, labels: { reason: "reserved" } },
            { name: "arcade_events", value: 1, labels: { event: "register", result: "fail" } },
          ],
          statusCode: 2,
        });
        throw new AppError("Username reserved");
      }
      if (password.length < 4) {
        await deps.obs.emitAction({
          event: "auth.failure",
          ...traceFields(trace),
          logLevel: "warn",
          logFields: { reason: "weak_password", event_attempt: "register" },
          metrics: [
            { name: "arcade_auth_failures_total", value: 1, labels: { reason: "weak_password" } },
            { name: "arcade_events", value: 1, labels: { event: "register", result: "fail" } },
          ],
          statusCode: 2,
        });
        throw new AppError("Password must be at least 4 characters");
      }

      try {
        const user = await deps.users.create(name, makePasswordHash(password), "user");
        await deps.obs.emitAction({
          event: "auth.register",
          ...traceFields(trace),
          user: user.username,
          metrics: [
            { name: "arcade_events", value: 1, labels: { event: "register", result: "ok" } },
          ],
        });
        return this.login(name, password, trace);
      } catch (e: unknown) {
        if (String(e).includes("unique") || String(e).includes("duplicate")) {
          await deps.obs.emitAction({
            event: "auth.failure",
            ...traceFields(trace),
            user: name,
            logLevel: "warn",
            logFields: { reason: "username_taken", event_attempt: "register" },
            metrics: [
              { name: "arcade_auth_failures_total", value: 1, labels: { reason: "username_taken" } },
              { name: "arcade_events", value: 1, labels: { event: "register", result: "fail" } },
            ],
            statusCode: 2,
          });
          throw new AppError("Username already taken");
        }
        throw e;
      }
    },

    async login(username: string, password: string, trace?: TraceCtx) {
      const name = username.trim().toLowerCase();
      const user = await deps.users.findByUsername(name);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        await deps.obs.emitAction({
          event: "auth.failure",
          ...traceFields(trace),
          user: name || undefined,
          logLevel: "warn",
          logFields: {
            reason: user ? "bad_password" : "unknown_user",
            event_attempt: "login",
          },
          metrics: [
            {
              name: "arcade_auth_failures_total",
              value: 1,
              labels: { reason: user ? "bad_password" : "unknown_user" },
            },
            { name: "arcade_events", value: 1, labels: { event: "login", result: "fail" } },
          ],
          statusCode: 2,
          statusMessage: "invalid credentials",
        });
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
      await deps.obs.emitAction({
        event: "auth.login",
        ...traceFields(trace),
        user: publicUser.username,
        metrics: [
          {
            name: "arcade_events",
            value: 1,
            labels: { event: "login", result: "ok", role: publicUser.role },
          },
        ],
        spanAttributes: { "user.role": publicUser.role },
      });
      return { user: publicUser, token, maxAge: SESSION_DAYS * 86400 };
    },

    async logout(token: string | undefined, trace?: TraceCtx) {
      if (token) await deps.sessions.delete(token);
      await deps.obs.emitAction({
        event: "auth.logout",
        ...traceFields(trace),
        metrics: [
          { name: "arcade_events", value: 1, labels: { event: "logout", result: "ok" } },
        ],
      });
    },

    async me(token: string | undefined) {
      if (!token) return null;
      return deps.sessions.findUserByToken(token);
    },

    /** Explicit /api/auth/me instrumentation (not used on every protected route). */
    async trackSessionRestore(hit: boolean, username: string | undefined, trace?: TraceCtx) {
      await deps.obs.emitAction({
        event: "auth.session_restore",
        ...traceFields(trace),
        user: username,
        logLevel: "debug",
        metrics: [
          {
            name: "arcade_events",
            value: 1,
            labels: { event: "session_restore", result: hit ? "hit" : "miss" },
          },
        ],
      });
    },
  };
}

export type AuthUseCases = ReturnType<typeof createAuthUseCases>;
