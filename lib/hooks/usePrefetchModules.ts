import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

// Prefetch the default (unfiltered) view of the modules a user visits most
// right after the dashboard has loaded, so navigating to them feels instant.
// Staggered on requestIdleCallback rather than fired as one Promise.all so a
// slow backend under load doesn't get 6 concurrent list scans on top of the
// dashboard's own requests.
// Keys here must be byte-for-byte identical to the query key each page builds
// for its default (no filter typed yet) view — React Query hashes the key by
// serializing it, so a prefetch under a slightly different params shape (e.g.
// omitting a filter the page always includes, even as `true`) populates a
// cache entry the page will never read, silently defeating the prefetch.
const modules: Array<{ key: readonly unknown[]; path: string; staleTime: number; perm: string }> = [
  // Highest priority: Vehicles is now a core workflow (auction intake,
  // incoming/received, work & costs), fetched before every other module.
  { key: queryKeys.vehicles.list({ search: undefined, inventory_status: undefined, include_archived: false }), path: "/vehicles?include_archived=false&limit=200", staleTime: 2 * 60 * 1000, perm: "vehicles.view" },
  { key: queryKeys.inventory.list({ search: undefined, item_type: undefined, location_id: undefined }), path: "/inventory?limit=300", staleTime: 2 * 60 * 1000, perm: "inventory.view" },
  { key: queryKeys.customers.list({ search: undefined, customer_type: undefined, active_only: true }), path: "/customers?active_only=true&limit=300", staleTime: 5 * 60 * 1000, perm: "customers.view" },
  { key: queryKeys.sales.list({ search: undefined, order_status: undefined }), path: "/sales-orders?limit=300", staleTime: 90 * 1000, perm: "sales.view" },
  { key: queryKeys.suppliers.list({ search: undefined, active_only: true }), path: "/suppliers?active_only=true&limit=300", staleTime: 5 * 60 * 1000, perm: "suppliers.view" },
  { key: queryKeys.purchaseOrders.list({ search: undefined, po_status: undefined, supplier_id: undefined }), path: "/purchase-orders?limit=300", staleTime: 2 * 60 * 1000, perm: "purchase_orders.view" },
  { key: queryKeys.payments.list({ search: undefined, direction: undefined, tx_status: undefined }), path: "/payments?limit=300", staleTime: 90 * 1000, perm: "payments.view" },
];

function idle(fn: () => void, timeoutMs: number) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (w.requestIdleCallback) {
    w.requestIdleCallback(fn, { timeout: timeoutMs });
  } else {
    window.setTimeout(fn, timeoutMs);
  }
}

export function usePrefetchModules(enabled: boolean, hasPermission: (perm: string) => boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Only prefetch modules this employee is actually authorized to view —
    // prefetching is still a real network request, and firing one for a
    // module the sidebar itself hides would silently violate "no
    // unauthorized data fetched just to be hidden visually" (Phase 11).
    const allowedModules = modules.filter((module) => hasPermission(module.perm));

    let cancelled = false;
    allowedModules.forEach((module, index) => {
      idle(() => {
        if (cancelled) return;
        queryClient.prefetchQuery({
          queryKey: module.key,
          queryFn: () => apiFetch(module.path),
          staleTime: module.staleTime,
        });
      }, 400 + index * 350);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, queryClient, hasPermission]);
}
