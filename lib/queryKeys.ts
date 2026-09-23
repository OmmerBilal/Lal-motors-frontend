// Central registry of query keys so pages and mutations invalidate the same
// cache entries by construction, not by remembering a matching string by hand.
// Keep params in the key (React Query treats each distinct params object as a
// separate cache entry) but pass `undefined`/{} for the "no filter" case so
// a page's default view is a stable, reusable key.

export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },

  dashboard: {
    summary: () => ["dashboard", "summary"] as const,
  },

  customers: {
    list: (params?: Record<string, unknown>) => ["customers", "list", params ?? {}] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
    orders: (id: string) => ["customers", "detail", id, "orders"] as const,
    lookup: () => ["customers", "lookup"] as const,
  },

  inventory: {
    list: (params?: Record<string, unknown>) => ["inventory", "list", params ?? {}] as const,
    valuation: () => ["inventory", "valuation"] as const,
    locations: () => ["inventory", "locations"] as const,
    movements: (params?: Record<string, unknown>) => ["inventory", "movements", params ?? {}] as const,
    itemLookup: (search?: string) => ["inventory", "itemLookup", search ?? ""] as const,
  },

  sales: {
    list: (params?: Record<string, unknown>) => ["salesOrders", "list", params ?? {}] as const,
    detail: (id: string) => ["salesOrder", id] as const,
    inventoryStatus: (id: string) => ["salesOrder", id, "inventoryStatus"] as const,
    customerLookup: () => ["salesOrders", "customerLookup"] as const,
    itemLookup: () => ["salesOrders", "itemLookup"] as const,
    channelLookup: () => ["salesOrders", "channelLookup"] as const,
  },

  suppliers: {
    list: (params?: Record<string, unknown>) => ["suppliers", "list", params ?? {}] as const,
    detail: (id: string) => ["suppliers", "detail", id] as const,
    purchaseOrders: (id: string) => ["suppliers", "detail", id, "purchaseOrders"] as const,
    quotes: (id: string) => ["suppliers", "detail", id, "quotes"] as const,
    lookup: () => ["suppliers", "lookup"] as const,
  },

  purchaseOrders: {
    list: (params?: Record<string, unknown>) => ["purchaseOrders", "list", params ?? {}] as const,
    detail: (id: string) => ["purchaseOrders", "detail", id] as const,
    supplierLookup: () => ["purchaseOrders", "supplierLookup"] as const,
    itemLookup: () => ["purchaseOrders", "itemLookup"] as const,
    locationLookup: () => ["purchaseOrders", "locationLookup"] as const,
  },

  payments: {
    list: (params?: Record<string, unknown>) => ["payments", "list", params ?? {}] as const,
    detail: (id: string) => ["payments", "detail", id] as const,
    lookup: (kind: string) => ["payments", "lookup", kind] as const,
  },

  vehicles: {
    list: (params?: Record<string, unknown>) => ["vehicles", "list", params ?? {}] as const,
    detail: (id: string) => ["vehicles", "detail", id] as const,
    makes: () => ["vehicles", "makes"] as const,
    models: (makeId: string) => ["vehicles", "models", makeId] as const,
    locations: () => ["vehicles", "locations"] as const,
    incoming: (params?: Record<string, unknown>) => ["vehicles", "incoming", params ?? {}] as const,
    workEntries: (vehicleId: string) => ["vehicles", "detail", vehicleId, "workEntries"] as const,
    costSummary: (vehicleId: string) => ["vehicles", "detail", vehicleId, "costSummary"] as const,
  },

  newItems: {
    list: (params?: Record<string, unknown>) => ["newItems", "list", params ?? {}] as const,
    detail: (id: string) => ["newItems", "detail", id] as const,
    categories: () => ["newItems", "categories"] as const,
    locations: () => ["newItems", "locations"] as const,
  },

  contentStudio: {
    sessions: () => ["contentStudio", "sessions"] as const,
    session: (id: string) => ["contentStudio", "session", id] as const,
    drafts: (params?: Record<string, unknown>) => ["contentStudio", "drafts", params ?? {}] as const,
    draft: (id: string) => ["contentStudio", "draft", id] as const,
  },

  shopify: {
    connection: () => ["shopify", "connection"] as const,
    stores: () => ["shopify", "stores"] as const,
    overview: (params?: Record<string, unknown>) => ["shopify", "overview", params ?? {}] as const,
    products: (params?: Record<string, unknown>) => ["shopify", "products", params ?? {}] as const,
    orders: (params?: Record<string, unknown>) => ["shopify", "orders", params ?? {}] as const,
    inventory: (params?: Record<string, unknown>) => ["shopify", "inventory", params ?? {}] as const,
    customers: (params?: Record<string, unknown>) => ["shopify", "customers", params ?? {}] as const,
    syncRuns: (params?: Record<string, unknown>) => ["shopify", "syncRuns", params ?? {}] as const,
  },

  ebay: {
    connection: () => ["ebay", "connection"] as const,
    overview: (params?: Record<string, unknown>) => ["ebay", "overview", params ?? {}] as const,
    listings: (params?: Record<string, unknown>) => ["ebay", "listings", params ?? {}] as const,
    orders: (params?: Record<string, unknown>) => ["ebay", "orders", params ?? {}] as const,
    inventory: (params?: Record<string, unknown>) => ["ebay", "inventory", params ?? {}] as const,
    syncRuns: (params?: Record<string, unknown>) => ["ebay", "syncRuns", params ?? {}] as const,
  },

  meta: {
    connection: () => ["meta", "connection"] as const,
    destinations: () => ["meta", "destinations"] as const,
    overview: (params?: Record<string, unknown>) => ["meta", "overview", params ?? {}] as const,
    history: (params?: Record<string, unknown>) => ["meta", "history", params ?? {}] as const,
  },
};

// Groups of top-level keys that should be invalidated together after a
// mutation, per the Phase 8 mutation-synchronization map. Passing just the
// first element of a key array to invalidateQueries matches every query
// under that key (e.g. "customers" matches list AND detail AND orders).
export const invalidationGroups = {
  customers: ["customers"] as const,
  inventory: ["inventory"] as const,
  sales: ["salesOrders", "salesOrder"] as const,
  suppliers: ["suppliers"] as const,
  purchaseOrders: ["purchaseOrders"] as const,
  payments: ["payments"] as const,
  vehicles: ["vehicles"] as const,
  newItems: ["newItems"] as const,
  dashboard: ["dashboard"] as const,
  contentStudio: ["contentStudio"] as const,
  shopify: ["shopify"] as const,
  ebay: ["ebay"] as const,
  meta: ["meta"] as const,
};
