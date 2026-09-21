"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CarFront,
  Loader2,
  LogOut,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { allNavigationItems, navGroups } from "@/lib/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { changePassword, logout } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { usePrefetchModules } from "@/lib/hooks/usePrefetchModules";
import { queryKeys } from "@/lib/queryKeys";

type NavItem = (typeof allNavigationItems)[number];

function ModuleSearch({
  items,
  value,
  onChange,
  onNavigate,
  compact = false,
}: {
  items: NavItem[];
  value: string;
  onChange: (value: string) => void;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    // `items` is already filtered to what the current employee is
    // authorized to see (see DashboardShell) — search can never surface,
    // or navigate to, an unauthorized module.
    return items
      .filter((item) =>
        `${item.label} ${item.keywords} ${item.group}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [value, items]);

  return (
    <div ref={wrap} style={{ position: "relative", width: "100%" }}>
      <div
        className={compact ? "searchbox" : "records-search"}
        style={{
          width: "100%",
          minWidth: 0,
          background: compact ? undefined : "var(--panel)",
        }}
      >
        <Search size={15} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search modules..."
          aria-label="Search dashboard modules"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear module search"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--muted)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {focused && value.trim() && (
        <div
          className="card"
          style={{
            position: "absolute",
            zIndex: 80,
            top: "calc(100% + 7px)",
            left: 0,
            right: 0,
            padding: 6,
            boxShadow: "var(--shadow)",
            maxHeight: 330,
            overflowY: "auto",
          }}
        >
          {results.length === 0 ? (
            <div className="muted" style={{ padding: 11, fontSize: 12 }}>
              No module found.
            </div>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setFocused(false);
                    onChange("");
                    onNavigate();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 9px",
                    borderRadius: 10,
                    color: "var(--text)",
                  }}
                >
                  <span className="metric-icon" style={{ width: 31, height: 31, borderRadius: 9 }}>
                    <Icon size={14} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 12 }}>{item.label}</strong>
                    <span className="muted" style={{ fontSize: 10 }}>{item.group}</span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ForcePasswordChangeModal({ onDone }: { onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      onDone();
    } catch (err: any) {
      setError(err?.message || "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <form onSubmit={submit} className="card" style={{ width: "min(420px, 100%)", padding: 24 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Set your password</h2>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
          You're using a temporary password. Choose your own before continuing.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password" placeholder="Temporary password" value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)} required
            className="input"
          />
          <input
            type="password" placeholder="New password (min 8 characters)" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
            className="input"
          />
          <input
            type="password" placeholder="Confirm new password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} required
            className="input"
          />
        </div>
        {error && <div style={{ color: "var(--danger, #d33)", fontSize: 12, marginTop: 10 }}>{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 16, width: "100%" }}>
          {saving ? "Saving..." : "Set password"}
        </button>
      </form>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");

  const { data: user, isPending, isError: sessionInvalid, fetchStatus } = useCurrentUser();
  const { has } = usePermissions();
  const [sessionTimedOut, setSessionTimedOut] = useState(false);

  // /auth/me used to hang indefinitely when the Next rewrite proxy waited on
  // a dead backend (proxyTimeout is 300s). Bound the splash so a failed or
  // stalled session check always falls through to login — never the dashboard.
  useEffect(() => {
    if (user) {
      setSessionTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setSessionTimedOut(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [user]);

  const checking = Boolean(
    !user && !sessionInvalid && !sessionTimedOut && (isPending || fetchStatus === "fetching"),
  );
  const unauthenticated = Boolean(
    !user && (sessionInvalid || sessionTimedOut || (!isPending && fetchStatus !== "fetching")),
  );

  useEffect(() => {
    if (unauthenticated) router.replace("/login");
  }, [unauthenticated, router]);

  usePrefetchModules(!!user, has);

  // Sidebar and the module search share one filtered source — a module the
  // employee isn't authorized for never appears in either, and is never
  // navigated to from search results.
  const visibleNavGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => has(item.requiredPermission)),
        }))
        .filter((group) => group.items.length > 0),
    [has],
  );
  const visibleNavigationItems = useMemo(
    () => allNavigationItems.filter((item) => has(item.requiredPermission)),
    [has],
  );

  const initials = useMemo(() => {
    const source = user?.display_name || user?.email || "User";
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [user]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // Clear every cached query so the next signed-in user (or a re-login
      // by the same user) never renders a stale screen of someone else's
      // business data for even a frame.
      queryClient.clear();
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
          <Loader2 size={20} className="spin" /> Checking session...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dashboard-shell">
      {user.must_change_password && (
        <ForcePasswordChangeModal onDone={() => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })} />
      )}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand" title="Overall Dashboard">
            <span className="brand-mark"><CarFront size={18} /></span>
            <span className="sidebar-brand-copy">LAL MOTORS</span>
          </Link>
        </div>

        <div className="sidebar-module-search" style={{ padding: "0 4px 8px" }}>
          <ModuleSearch items={visibleNavigationItems} value={moduleQuery} onChange={setModuleQuery} onNavigate={() => {}} />
        </div>

        {visibleNavGroups.map((group) => (
          <div key={group.title}>
            <div className="nav-section-title">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`side-link ${active ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                  title={item.label}
                >
                  <Icon size={17} />
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        <div className="side-footer">
          <div className="user-chip">
            <div className="avatar">{initials || "U"}</div>
            <div className="user-copy" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.display_name || "Lal Motors User"}
              </div>
              <div className="muted" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </div>
              <div style={{ fontSize: 10, marginTop: 3, color: "var(--accent)", fontWeight: 700 }}>
                {user.roles.join(", ") || "User"}
              </div>
            </div>
            <button className="icon-btn" onClick={handleLogout} disabled={loggingOut} title="Logout" aria-label="Logout"
              style={{ width: 34, height: 34, marginLeft: "auto", flex: "0 0 auto" }}>
              {loggingOut ? <Loader2 size={15} className="spin" /> : <LogOut size={15} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <button className="icon-btn mobile-menu"><Menu size={17} /></button>

          <div style={{ width: "min(520px, 100%)" }}>
            <ModuleSearch compact items={visibleNavigationItems} value={moduleQuery} onChange={setModuleQuery} onNavigate={() => {}} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/dashboard/ai" className="btn btn-ghost"><Sparkles size={15} /> AI</Link>
            <button className="icon-btn"><Bell size={17} /></button>
            <ThemeToggle />
          </div>
        </div>

        <main className="dashboard-content">{children}</main>
      </div>

      <style jsx global>{`
        .sidebar-module-search .records-search { min-width: 0; padding: 9px 10px; }
        @media (max-width: 1050px) {
          .sidebar-module-search { display: none; }
        }
      `}</style>
    </div>
  );
}
