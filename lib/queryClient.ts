import { QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

// One QueryClient per browser tab (created lazily in QueryProvider via
// useState so it survives re-renders but not page reloads). Defaults are
// deliberately conservative business-app values: don't refetch just because
// the window regained focus, don't refetch just because a component
// remounted while data is still fresh, and only retry transient failures once.
export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      // A 403 is itself the authoritative signal that this session's
      // authorization may have just narrowed (an Admin revoked a
      // permission/role while the employee was still logged in) — a broad,
      // deliberately coarse invalidation is simpler and safer here than
      // tracking which specific cached data is now stale (Phase 11).
      onError: (error) => {
        if (error instanceof ApiError && error.status === 403) {
          queryClientRef?.invalidateQueries();
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // Long enough that a module visited once early in a shift is still
        // warm 15-20 minutes later (staleTime, unchanged, still governs
        // whether a background refetch happens on next use — this only
        // controls how long unused cache entries survive before eviction).
        gcTime: 45 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// QueryCache's onError callback has no direct reference to the QueryClient
// that owns it (the client is constructed from the cache, not the other way
// around) — this module-local reference, set once by makeQueryClient's
// caller, closes that loop without a React context just for this.
let queryClientRef: QueryClient | null = null;
export function registerQueryClient(client: QueryClient) {
  queryClientRef = client;
}
