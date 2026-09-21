import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

// Nearly every dashboard page fetches the current user just to check roles
// (isManager, etc). Sharing one query means one /auth/me request per session
// instead of one per page visit, and every page that reads roles agrees on
// the same cached identity.
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: getCurrentUser,
    // Short on purpose: this is what lets a permission/role change made by
    // an Admin reach an already-open session quickly (Phase 11) — a cheap
    // single-row lookup, not worth a 5-minute-stale window anymore.
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    // Default "online" mode can leave the auth query pending forever when
    // the browser reports offline, which froze the dashboard on
    // "Checking session...". Always attempt /auth/me; the fetch timeout
    // and DashboardShell wall-clock bound still apply.
    networkMode: "always",
  });
}
