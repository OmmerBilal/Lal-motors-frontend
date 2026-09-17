import type { QueryClient } from "@tanstack/react-query";
import { invalidationGroups } from "./queryKeys";

export type InvalidationGroup = keyof typeof invalidationGroups;

// Usage: after a mutation succeeds, call invalidate(queryClient, [...]) with
// the groups named in the Phase 8 mutation-synchronization map, e.g.
// invalidate(queryClient, ["sales", "inventory", "customers", "payments", "dashboard"])
// for Create Sale. Invalidating by the group's top-level key matches every
// query nested under it (list, detail, lookups, etc.) in one call.
export function invalidate(queryClient: QueryClient, groups: InvalidationGroup[]) {
  const topLevelKeys = new Set<string>();
  for (const group of groups) {
    for (const key of invalidationGroups[group]) topLevelKeys.add(key);
  }
  return Promise.all(
    Array.from(topLevelKeys).map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}
