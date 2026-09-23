"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CarFront,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch, CurrentUser } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

type LoginResponse = { message: string; user: CurrentUser };

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginResult = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      // The login response already carries the same AuthUser shape /auth/me
      // returns (both built by auth_service._serialize_user on the backend)
      // — seed it directly instead of letting DashboardShell's
      // useCurrentUser() fire a second, fully redundant round-trip. This
      // request measured 1.3-2.8s on its own; skipping it outright (not
      // just starting it earlier) is what actually removes that cost.
      // /auth/me still runs normally on every other route/refresh — this
      // only short-circuits the one path where the data was just returned.
      queryClient.setQueryData(queryKeys.auth.me(), loginResult.user);

      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div style={{ position: "fixed", right: 22, top: 22 }}>
        <ThemeToggle />
      </div>

      <div className="card login-card">
        <Link
          href="/"
          className="muted"
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={15} /> Back to home
        </Link>

        <div className="login-logo">
          <CarFront size={22} />
        </div>

        <div className="eyebrow">Secure access</div>
        <h1
          style={{
            fontSize: 32,
            letterSpacing: "-.04em",
            margin: "8px 0 8px",
          }}
        >
          Welcome back.
        </h1>

        <p
          className="muted"
          style={{ margin: "0 0 24px", lineHeight: 1.6 }}
        >
          Sign in with your real Lal Motors account.
        </p>

        <form onSubmit={submit}>
          <label className="form-label">Email</label>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Mail
              size={16}
              style={{
                position: "absolute",
                left: 13,
                top: 13,
                color: "var(--muted)",
              }}
            />
            <input
              className="input"
              style={{ paddingLeft: 40 }}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@lalmotors.com"
              autoComplete="email"
              required
            />
          </div>

          <label className="form-label">Password</label>
          <div style={{ position: "relative" }}>
            <LockKeyhole
              size={16}
              style={{
                position: "absolute",
                left: 13,
                top: 13,
                color: "var(--muted)",
              }}
            />
            <input
              className="input"
              style={{ paddingLeft: 40, paddingRight: 44 }}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="icon-btn"
              style={{
                position: "absolute",
                right: 4,
                top: 4,
                border: "0",
                background: "transparent",
              }}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" /> Signing in...
              </>
            ) : (
              "Login to Dashboard"
            )}
          </button>
        </form>

        <div
          style={{ textAlign: "center", marginTop: 18, fontSize: 13 }}
          className="muted"
        >
          Lal Motors BOS is an internal system. Contact your administrator for access.
        </div>
      </div>
    </main>
  );
}
