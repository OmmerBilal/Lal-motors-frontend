import { useCallback, useMemo } from "react";

import { useCurrentUser } from "@/lib/hooks/useCurrentUser";

// Single source of truth for "can this employee do X" on the frontend —
// mirrors the backend's require_permission(key) check. This is a UX
// convenience only (hide/show, skip a fetch); the backend enforces the
// same keys independently on every request, so this hook being wrong or
// stale never grants access, it only ever affects what's shown.
export function usePermissions() {
  const { data, isLoading } = useCurrentUser();

  const permissionSet = useMemo(() => new Set(data?.permissions ?? []), [data]);

  // Stable identities (useCallback, keyed off the actual permission set) so
  // effects that depend on `has`/`hasAny` (e.g. usePrefetchModules) don't
  // re-run on every render — only when the permission set itself changes.
  const has = useCallback((key?: string | null) => (key ? permissionSet.has(key) : true), [permissionSet]);
  const hasAny = useCallback((keys: string[]) => keys.some((key) => permissionSet.has(key)), [permissionSet]);

  return {
    permissions: data?.permissions ?? [],
    isLoading,
    has,
    hasAny,
  };
}
