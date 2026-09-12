"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CarFront,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          display_name: displayName.trim(),
        }),
      });

      setSuccess("Account created. Redirecting to login...");

      window.setTimeout(() => {
        router.push("/login");
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Unable to create account.");
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

        <div className="eyebrow">Create account</div>
        <h1
          style={{
            fontSize: 32,
            letterSpacing: "-.04em",
            margin: "8px 0 8px",
          }}
        >
          Join Lal Motors OS.
        </h1>

        <p
          className="muted"
          style={{ margin: "0 0 24px", lineHeight: 1.6 }}
        >
          New accounts are created in PostgreSQL and receive the Staff role.
        </p>

        <form onSubmit={submit}>
          <label className="form-label">Full Name</label>
          <div className="field-with-icon" style={{ marginBottom: 14 }}>
            <UserRound size={16} />
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              minLength={2}
            />
          </div>

          <label className="form-label">Email</label>
          <div className="field-with-icon" style={{ marginBottom: 14 }}>
            <Mail size={16} />
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@lalmotors.com"
              autoComplete="email"
              required
            />
          </div>

          <label className="form-label">Password</label>
          <div className="field-with-icon" style={{ marginBottom: 14 }}>
            <LockKeyhole size={16} />
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <label className="form-label">Confirm Password</label>
          <div className="field-with-icon">
            <LockKeyhole size={16} />
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              minLength={8}
              required
            />
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

          {success && (
            <div
              style={{
                marginTop: 12,
                color: "var(--success)",
                fontSize: 13,
              }}
            >
              {success}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 20 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" /> Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div
          style={{ textAlign: "center", marginTop: 18, fontSize: 13 }}
          className="muted"
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{ color: "var(--accent)", fontWeight: 800 }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
