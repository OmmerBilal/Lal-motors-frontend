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
import { useEffect, useMemo, useRef, useState } from "react";

import { allNavigationItems, navGroups } from "@/lib/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CurrentUser, getCurrentUser, logout } from "@/lib/api";

function ModuleSearch({
  value,
  onChange,
  onNavigate,
  compact = false,
}: {
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
    return allNavigationItems
      .filter((item) =>
        `${item.label} ${item.keywords} ${item.group}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [value]);

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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) {
          setChecking(false);
          router.replace("/login");
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

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
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand" title="Overall Dashboard">
            <span className="brand-mark"><CarFront size={18} /></span>
            <span className="sidebar-brand-copy">LAL MOTORS</span>
          </Link>
        </div>

        <div className="sidebar-module-search" style={{ padding: "0 4px 8px" }}>
          <ModuleSearch value={moduleQuery} onChange={setModuleQuery} onNavigate={() => {}} />
        </div>

        {navGroups.map((group) => (
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
            <ModuleSearch compact value={moduleQuery} onChange={setModuleQuery} onNavigate={() => {}} />
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
