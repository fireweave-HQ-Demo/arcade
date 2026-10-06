import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ApiError, api } from "./api";
import { fw } from "./fireweave/fw-harness";
import { metric as record } from "./observability/openobserve";

const KNOWN = new Set(["bad_password", "weak_password", "unchanged", "unauthorized", "not_found"]);

function reasonFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (KNOWN.has(err.code)) return err.code;
    if (err.status >= 500) return "query_failed";
    return "request_failed";
  }
  return "request_failed";
}

export function PasswordPage() {
  // @fireweave-controlpoint change-password
  const enabled = fw.controlPoints.getBooleanValue("change-password", false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!enabled) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDone(false);
    if (newPassword !== confirmPassword) {
      setError("new password and confirmation do not match");
      void record("arcade_web_password_change_total", 1, {
        surface: "web",
        result: "error",
      });
      void record("arcade_web_password_change_errors_total", 1, {
        surface: "web",
        reason: "mismatch",
      });
      return;
    }

    setBusy(true);
    const started = performance.now();
    try {
      await api.changePassword(currentPassword, newPassword);
      const elapsed = Math.round(performance.now() - started);
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      void record("arcade_web_password_change_total", 1, {
        surface: "web",
        result: "ok",
      });
      void record(
        "arcade_web_password_change_ms",
        elapsed,
        { surface: "web", result: "ok" },
        "histogram",
      );
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const reason = reasonFor(err);
      setError(err instanceof Error ? err.message : "failed");
      void record("arcade_web_password_change_total", 1, {
        surface: "web",
        result: "error",
      });
      void record("arcade_web_password_change_errors_total", 1, {
        surface: "web",
        reason,
      });
      void record(
        "arcade_web_password_change_ms",
        elapsed,
        { surface: "web", result: "error" },
        "histogram",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <div className="status">change password</div>
      <p className="hint" style={{ marginTop: "0.75rem" }}>
        other signed-in browsers are signed out. this one stays logged in.
      </p>
      <form className="auth-form" style={{ marginTop: "1rem" }} onSubmit={(e) => void submit(e)}>
        <label>
          current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          new password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {done ? <p className="hint">password updated</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "saving…" : "update password"}
        </button>
      </form>
    </section>
  );
}
