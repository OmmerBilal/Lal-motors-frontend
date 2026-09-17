"use client";

import { Loader2, ShieldAlert } from "lucide-react";

import { usePermissions } from "@/lib/hooks/usePermissions";

// Direct-URL protection for permission-gated pages: wraps a page's whole
// return value. An unauthorized employee sees this panel instead of the
// page content — the page's own data-fetching hooks should ALSO gate their
// queries with `enabled: has("...")` (belt-and-suspenders) so the network
// request itself never fires, not just the rendered result. This is a UX
// convenience only — the backend enforces the same permission key
// independently on every request regardless of what this renders.
export function RequirePermission({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { has, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
          <Loader2 size={18} className="spin" /> Loading...
        </div>
      </div>
    );
  }

  if (!has(perm)) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card" style={{ padding: 32, textAlign: "center", maxWidth: 420 }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: 12, background: "var(--panel-2, rgba(0,0,0,0.04))", marginBottom: 12 }}>
            <ShieldAlert size={26} color="var(--danger, #d33)" />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>You don't have access to this</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Ask an administrator to grant you access if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
