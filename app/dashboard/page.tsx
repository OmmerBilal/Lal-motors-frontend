"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Container,
  DollarSign,
  Factory,
  FileText,
  PackagePlus,
  PackageSearch,
  ShoppingCart,
  Sparkles,
  Truck,
  UserRoundCog,
  UserRoundPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/Shared";
import { money } from "@/components/RealUi";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { queryKeys } from "@/lib/queryKeys";

type CountKey =
  | "vehicles" | "parts" | "newItems" | "inventory" | "customers" | "sales"
  | "suppliers" | "purchases" | "shipments" | "containers" | "payments"
  | "tasks" | "documents" | "employees" | "approvals";

type CountResponse = { total: number };

type SalesOrderRow = {
  order_number: string; customer_name: string | null; order_date: string;
  order_total: number | string; order_status: string; created_at: string;
};
type SalesOrderList = { total: number; items: SalesOrderRow[] };
type PaymentRow = {
  transaction_number: string; direction: string; amount: number | string;
  customer_name: string | null; supplier_name: string | null; counterparty_name: string | null;
  status: string; created_at: string;
};
type PaymentList = { total: number; items: PaymentRow[] };
type PurchaseOrderRow = {
  po_number: string; supplier_name: string; status: string; updated_at: string;
};
type PurchaseOrderList = { total: number; items: PurchaseOrderRow[] };
type ValuationRow = { item_type: string; total_inventory_value: number | string };
type CustomerRow = { outstanding_balance: number | string };
type CustomerListResp = { total: number; items: CustomerRow[] };
type SupplierRow = { outstanding_balance: number | string };
type SupplierListResp = { total: number; items: SupplierRow[] };
type InventoryRow = { quantity_available: number | string };
type InventoryListResp = { total: number; items: InventoryRow[] };

type ActivityItem = { id: string; text: string; time: string; href: string };

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const today = () => new Date().toISOString().slice(0, 10);

type DashboardOverview = {
  todaySales: number | null; inventoryValue: number | null; receivables: number | null;
  payables: number | null; lowStock: number | null; pendingPayments: number | null;
};

// Every count/overview widget maps to exactly one backend permission key —
// this is what "dashboard must be permission-aware" (Phase 11, marked
// CRITICAL) actually means: an employee without a key never even triggers
// the network request behind the widget it would have populated, not just
// a visually-hidden card.
const PERMISSION_BY_COUNT_KEY: Record<CountKey, string> = {
  vehicles: "vehicles.view", parts: "used_parts.view", newItems: "new_items.view",
  inventory: "inventory.view", customers: "customers.view", sales: "sales.view",
  suppliers: "suppliers.view", purchases: "purchase_orders.view", shipments: "shipments.view",
  containers: "containers.view", payments: "payments.view", tasks: "tasks.view",
  documents: "documents.view", employees: "employees.view", approvals: "approvals.view",
};

const COUNT_ENDPOINTS: Partial<Record<CountKey, string>> = {
  vehicles: "/vehicles?limit=1", parts: "/used-parts?limit=1", newItems: "/new-items?limit=1",
  inventory: "/inventory?limit=1", customers: "/customers?limit=1", sales: "/sales-orders?limit=1",
  suppliers: "/suppliers?limit=1", purchases: "/purchase-orders?limit=1", shipments: "/shipments?limit=1",
  containers: "/containers?limit=1", payments: "/payments?limit=1", tasks: "/tasks?limit=1",
  documents: "/documents?limit=1", employees: "/hr/employees?limit=1",
};

const emptyCounts: Record<CountKey, number | null> = {
  vehicles: null, parts: null, newItems: null, inventory: null, customers: null,
  sales: null, suppliers: null, purchases: null, shipments: null, containers: null,
  payments: null, tasks: null, documents: null, employees: null, approvals: null,
};

const emptyOverview: DashboardOverview = {
  todaySales: null, inventoryValue: null, receivables: null, payables: null, lowStock: null, pendingPayments: null,
};

// Split into two independent queries (below) instead of one combined
// Promise.all of ~23 requests: that single burst was the real contributor
// to the ~30s login->usable delay, not any one slow call — measured
// directly, each request only costs ~0.2-4.5s, but a real browser caps
// concurrent requests per origin at ~6 on HTTP/1.1 (what `next dev` serves
// locally), so ~23+ simultaneous requests queue in waves behind that cap.
// Splitting lets the Business Overview cards (what a user looks at first)
// render as soon as THEIR ~8 requests resolve, instead of waiting on the 14
// separate count badges below them too.
async function fetchDashboardCounts(permissions: Set<string>): Promise<{ counts: Record<CountKey, number | null>; errors: number }> {
  const counts: Record<CountKey, number | null> = { ...emptyCounts };
  let errors = 0;

  const allowedCountKeys = (Object.keys(COUNT_ENDPOINTS) as CountKey[]).filter((key) =>
    permissions.has(PERMISSION_BY_COUNT_KEY[key]),
  );

  const countResults = await Promise.all(
    allowedCountKeys.map((key) =>
      apiFetch<CountResponse>(COUNT_ENDPOINTS[key] as string)
        .then((response) => ({ key, total: response.total }))
        .catch(() => ({ key, total: null })),
    ),
  );
  for (const result of countResults) {
    counts[result.key] = result.total ?? 0;
    if (result.total === null) errors += 1;
  }

  if (permissions.has("approvals.view")) {
    await apiFetch<any[]>("/ai-admin/approvals?approval_status=pending&limit=100")
      .then((rows) => { counts.approvals = rows.length; })
      .catch(() => { counts.approvals = 0; errors += 1; });
  }

  return { counts, errors };
}

async function fetchDashboardOverview(queryClient: QueryClient, permissions: Set<string>): Promise<{ overview: DashboardOverview; activity: ActivityItem[]; errors: number }> {
  let errors = 0;
  const canSales = permissions.has("sales.view");
  const canPayments = permissions.has("payments.view");
  const canPurchaseOrders = permissions.has("purchase_orders.view");
  const canInventory = permissions.has("inventory.view");
  const canCustomers = permissions.has("customers.view");
  const canSuppliers = permissions.has("suppliers.view");

  let overview = emptyOverview;
  let activity: ActivityItem[] = [];

  try {
    // Sales, payments, purchase-orders and inventory are fetched through the
    // same query keys their own module pages (and the post-login prefetcher)
    // use, so whichever one runs first populates a cache entry the others
    // reuse instead of issuing a second identical request. Every one of
    // these only runs at all if the employee holds the matching permission
    // — an employee without sales.view never fires a /sales-orders request
    // just to compute a card that will be hidden.
    const salesListParams = { search: undefined, order_status: undefined };
    const paymentsListParams = { search: undefined, direction: undefined, tx_status: undefined };
    const purchaseOrdersListParams = { search: undefined, po_status: undefined, supplier_id: undefined };
    const inventoryListParams = { search: undefined, item_type: undefined, location_id: undefined };

    const [sales, payments, purchases, valuation, customers, suppliers, inventory, pendingPayments] = await Promise.all([
      canSales
        ? queryClient.fetchQuery({
            queryKey: queryKeys.sales.list(salesListParams),
            queryFn: () => apiFetch<SalesOrderList>("/sales-orders?limit=300"),
            staleTime: 90 * 1000,
          })
        : Promise.resolve(null),
      canPayments
        ? queryClient.fetchQuery({
            queryKey: queryKeys.payments.list(paymentsListParams),
            queryFn: () => apiFetch<PaymentList>("/payments?limit=300"),
            staleTime: 90 * 1000,
          })
        : Promise.resolve(null),
      canPurchaseOrders
        ? queryClient.fetchQuery({
            queryKey: queryKeys.purchaseOrders.list(purchaseOrdersListParams),
            queryFn: () => apiFetch<PurchaseOrderList>("/purchase-orders?limit=300"),
            staleTime: 2 * 60 * 1000,
          })
        : Promise.resolve(null),
      canInventory
        ? queryClient.fetchQuery({
            queryKey: queryKeys.inventory.valuation(),
            queryFn: () => apiFetch<ValuationRow[]>("/inventory/valuation"),
            staleTime: 2 * 60 * 1000,
          })
        : Promise.resolve(null),
      canCustomers ? apiFetch<CustomerListResp>("/customers?limit=300") : Promise.resolve(null),
      canSuppliers ? apiFetch<SupplierListResp>("/suppliers?limit=300") : Promise.resolve(null),
      canInventory
        ? queryClient.fetchQuery({
            queryKey: queryKeys.inventory.list(inventoryListParams),
            queryFn: () => apiFetch<InventoryListResp>("/inventory?limit=300"),
            staleTime: 2 * 60 * 1000,
          })
        : Promise.resolve(null),
      canPayments ? apiFetch<CountResponse>("/payments?tx_status=pending&limit=1") : Promise.resolve(null),
    ]);

    const todaysDate = today();
    const todaySales = sales
      ? sales.items.filter((o) => o.order_date?.slice(0, 10) === todaysDate).reduce((sum, o) => sum + Number(o.order_total), 0)
      : null;
    const inventoryValue = valuation ? valuation.reduce((sum, v) => sum + Number(v.total_inventory_value), 0) : null;
    const receivables = customers ? customers.items.reduce((sum, c) => sum + Number(c.outstanding_balance), 0) : null;
    const payables = suppliers ? suppliers.items.reduce((sum, s) => sum + Number(s.outstanding_balance), 0) : null;
    const lowStock = inventory ? inventory.items.filter((r) => Number(r.quantity_available) <= 2).length : null;

    overview = {
      todaySales, inventoryValue, receivables, payables, lowStock,
      pendingPayments: pendingPayments ? pendingPayments.total : null,
    };

    const saleEvents: ActivityItem[] = sales
      ? sales.items.slice(0, 6).map((o) => ({
          id: `sale-${o.order_number}`,
          text: `${o.customer_name || "Walk-in customer"} purchased order ${o.order_number} — ${money(o.order_total)}`,
          time: o.created_at,
          href: "/dashboard/sales",
        }))
      : [];
    const paymentEvents: ActivityItem[] = payments
      ? payments.items.slice(0, 6).map((p) => ({
          id: `pay-${p.transaction_number}`,
          text: p.direction === "incoming"
            ? `Payment ${money(p.amount)} received from ${p.customer_name || p.counterparty_name || "customer"}`
            : `Payment ${money(p.amount)} sent to ${p.supplier_name || p.counterparty_name || "supplier"}`,
          time: p.created_at,
          href: "/dashboard/payments",
        }))
      : [];
    const stockEvents: ActivityItem[] = purchases
      ? purchases.items
          .filter((p) => p.status === "fully_received" || p.status === "partially_received")
          .slice(0, 6)
          .map((p) => ({
            id: `po-${p.po_number}`,
            text: `Stock received from ${p.supplier_name} (${p.po_number})`,
            time: p.updated_at,
            href: "/dashboard/purchases",
          }))
      : [];

    activity = [...saleEvents, ...paymentEvents, ...stockEvents]
      .filter((e) => e.time)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);
  } catch {
    errors += 1;
  }

  return { overview, activity, errors };
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { permissions, has, isLoading: permissionsLoading } = usePermissions();
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const sortedPermissions = useMemo(() => [...permissions].sort(), [permissions]);

  // Permissions are part of both keys: if an Admin changes what this
  // employee can see, these are genuinely different queries, not a stale
  // reuse of a summary computed under the old permission set.
  const overviewQuery = useQuery({
    queryKey: [...queryKeys.dashboard.summary(), "overview", sortedPermissions],
    queryFn: () => fetchDashboardOverview(queryClient, permissionSet),
    enabled: !permissionsLoading,
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Counts are individually cheap (?limit=1 each) but there are 14+ of
  // them — a short fixed delay (not gated on the overview query finishing,
  // just started slightly later) gives the overview requests above first
  // claim on the browser's connection pool instead of ~22 requests hitting
  // it in the same instant.
  const [countsEnabled, setCountsEnabled] = useState(false);
  useEffect(() => {
    if (permissionsLoading) return;
    const timer = window.setTimeout(() => setCountsEnabled(true), 150);
    return () => window.clearTimeout(timer);
  }, [permissionsLoading]);

  const countsQuery = useQuery({
    queryKey: [...queryKeys.dashboard.summary(), "counts", sortedPermissions],
    queryFn: () => fetchDashboardCounts(permissionSet),
    enabled: countsEnabled,
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const counts = countsQuery.data?.counts ?? emptyCounts;
  const overview = overviewQuery.data?.overview ?? emptyOverview;
  const activity = overviewQuery.data?.activity ?? [];
  const errors = (overviewQuery.data?.errors ?? 0) + (countsQuery.data?.errors ?? 0);

  const display = (value: number | null) => value === null ? "—" : String(value);
  const displayMoney = (value: number | null) => value === null ? "—" : money(value);

  const liveModules = useMemo(
    () => Object.values(counts).filter((value) => value !== null).length,
    [counts],
  );

  const quickLinks: Array<[string, string, string]> = [
    ["Vehicles", "/dashboard/vehicles", "vehicles.view"],
    ["Used Parts", "/dashboard/parts", "used_parts.view"],
    ["New Items", "/dashboard/new-items", "new_items.view"],
    ["Inventory", "/dashboard/inventory", "inventory.view"],
    ["Customers", "/dashboard/customers", "customers.view"],
    ["Sales", "/dashboard/sales", "sales.view"],
    ["Suppliers", "/dashboard/suppliers", "suppliers.view"],
    ["Purchase Orders", "/dashboard/purchases", "purchase_orders.view"],
    ["Procurement Ops", "/dashboard/procurement", "procurement_ops.view"],
    ["Shipments", "/dashboard/shipments", "shipments.view"],
    ["Containers", "/dashboard/containers", "containers.view"],
    ["Payments", "/dashboard/payments", "payments.view"],
    ["Tasks", "/dashboard/tasks", "tasks.view"],
    ["Documents", "/dashboard/documents", "documents.view"],
    ["Employees & HR", "/dashboard/employees", "employees.view"],
    ["System Admin", "/dashboard/settings", "settings.view"],
  ].filter(([, , perm]) => has(perm)) as Array<[string, string, string]>;

  const quickActions = [
    { label: "New Sale", href: "/dashboard/sales?action=new-sale", icon: ShoppingCart, perm: "sales.create" },
    { label: "Receive Stock", href: "/dashboard/purchases", icon: PackagePlus, perm: "purchase_orders.receive" },
    { label: "Add Product", href: "/dashboard/new-items?action=add", icon: Boxes, perm: "new_items.edit" },
    { label: "Add Customer", href: "/dashboard/customers?action=add", icon: UserRoundPlus, perm: "customers.create" },
    { label: "Receive Payment", href: "/dashboard/payments?action=receive-payment", icon: WalletCards, perm: "payments.receive_customer" },
  ].filter((action) => has(action.perm));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Lal Motors Business OS</div>
          <h1 className="page-title">Overall Dashboard</h1>
          <p className="page-copy">
            Business-wide live data across inventory, CRM, sales, procurement,
            logistics, finance, tasks, documents and HR.
          </p>
        </div>
        {has("ai.use") && (
          <Link href="/dashboard/ai" className="btn btn-primary">
            <Sparkles size={15}/> AI & Approvals
          </Link>
        )}
      </div>

      <div
        className="card"
        style={{
          padding: 13,
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {errors === 0 ? <CheckCircle2 size={17}/> : <AlertTriangle size={17}/>}
          <div>
            <strong>{errors === 0 ? "Backend connected" : "Some dashboard widgets could not load"}</strong>
            <div className="muted" style={{ fontSize: 11 }}>
              {liveModules} live dashboard data sources loaded.
            </div>
          </div>
        </div>
        <span className="badge green"><Activity size={12}/> PostgreSQL / FastAPI</span>
      </div>

      <div className="panel-head" style={{ marginBottom: 10 }}>
        <div><h3 style={{ margin: 0 }}>Business Overview</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Today's activity and where money is tied up right now.</div></div>
      </div>
      <div className="metric-grid" style={{ marginBottom: 24 }}>
        {has("sales.view") && <MetricCard label="Today's Sales" value={displayMoney(overview.todaySales)} trend="Orders placed today" icon={DollarSign} href="/dashboard/sales"/>}
        {has("inventory.view") && <MetricCard label="Inventory Value" value={displayMoney(overview.inventoryValue)} trend="On-hand stock" icon={Boxes} href="/dashboard/inventory"/>}
        {has("customers.view") && <MetricCard label="Customer Receivables" value={displayMoney(overview.receivables)} trend="Owed by customers" icon={Users} href="/dashboard/customers"/>}
        {has("suppliers.view") && <MetricCard label="Supplier Payables" value={displayMoney(overview.payables)} trend="Owed to suppliers" icon={Factory} href="/dashboard/suppliers"/>}
        {has("inventory.view") && <MetricCard label="Low Stock Items" value={display(overview.lowStock)} trend="≤2 units available" icon={AlertTriangle} href="/dashboard/inventory"/>}
        {has("payments.view") && <MetricCard label="Pending Payments" value={display(overview.pendingPayments)} trend="Awaiting manager posting" icon={WalletCards} href="/dashboard/payments"/>}
      </div>

      {quickActions.length > 0 && (
        <>
          <div className="panel-head" style={{ marginBottom: 10 }}>
            <div><h3 style={{ margin: 0 }}>Quick Actions</h3>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Jump straight into the simple action — the system handles the rest.</div></div>
          </div>
          <div className="quick-grid" style={{ gridTemplateColumns: `repeat(${quickActions.length},1fr)`, marginBottom: 24 }}>
            {quickActions.map((a) => (
              <Link href={a.href} className="quick-action" key={a.href}>
                <a.icon size={15}/> {a.label}
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="metric-grid">
        {has("vehicles.view") && <MetricCard label="Vehicles" value={display(counts.vehicles)} trend="Live catalog" icon={CarFront} href="/dashboard/vehicles"/>}
        {has("used_parts.view") && <MetricCard label="Used Parts" value={display(counts.parts)} trend="Live catalog" icon={PackageSearch} href="/dashboard/parts"/>}
        {has("new_items.view") && <MetricCard label="New Items" value={display(counts.newItems)} trend="Live catalog" icon={Boxes} href="/dashboard/new-items"/>}
        {has("inventory.view") && <MetricCard label="Inventory Rows" value={display(counts.inventory)} trend="Live stock balances" icon={Boxes} href="/dashboard/inventory"/>}
        {has("customers.view") && <MetricCard label="Customers" value={display(counts.customers)} trend="CRM" icon={Users} href="/dashboard/customers"/>}
        {has("sales.view") && <MetricCard label="Sales Orders" value={display(counts.sales)} trend="Sales" icon={ShoppingCart} href="/dashboard/sales"/>}
        {has("suppliers.view") && <MetricCard label="Suppliers" value={display(counts.suppliers)} trend="Procurement" icon={Factory} href="/dashboard/suppliers"/>}
        {has("purchase_orders.view") && <MetricCard label="Purchase Orders" value={display(counts.purchases)} trend="Procurement" icon={ClipboardList} href="/dashboard/purchases"/>}
        {has("shipments.view") && <MetricCard label="Shipments" value={display(counts.shipments)} trend="Logistics" icon={Truck} href="/dashboard/shipments"/>}
        {has("containers.view") && <MetricCard label="Containers" value={display(counts.containers)} trend="Logistics" icon={Container} href="/dashboard/containers"/>}
        {has("payments.view") && <MetricCard label="Payments" value={display(counts.payments)} trend="Finance" icon={WalletCards} href="/dashboard/payments"/>}
        {has("tasks.view") && <MetricCard label="Open Tasks" value={display(counts.tasks)} trend="Operations" icon={ClipboardList} href="/dashboard/tasks"/>}
        {has("documents.view") && <MetricCard label="Documents" value={display(counts.documents)} trend="Records" icon={FileText} href="/dashboard/documents"/>}
        {has("employees.view") && <MetricCard label="Employees" value={display(counts.employees)} trend="HR" icon={UserRoundCog} href="/dashboard/employees"/>}
        {has("approvals.view") && <MetricCard label="Pending Approvals" value={display(counts.approvals)} trend="AI / controls" icon={Sparkles} href="/dashboard/ai"/>}
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h3 style={{ margin: 0 }}>Recent Activity</h3>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                The latest sales, payments and stock receipts across the business.
              </div>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="muted" style={{ padding: "18px 0" }}>No recent activity yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {activity.map((item) => (
                <Link
                  href={item.href}
                  key={item.id}
                  className="card"
                  style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}
                >
                  <span style={{ fontSize: 13 }}>{item.text}</span>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(item.time)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {has("ai.use") && (
          <section className="ai-box">
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 850 }}>
              <Sparkles size={18}/> Automation readiness
            </div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
              The AI Command Center understands plain-language requests with a real
              language model, executes them through controlled backend functions, and
              routes larger actions through Manager approval before anything happens.
            </p>
            <Link href="/dashboard/ai" className="btn btn-primary">
              Open AI Command Center
            </Link>
          </section>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="card panel" style={{ gridColumn: "1 / -1" }}>
          <div className="panel-head">
            <div>
              <h3 style={{ margin: 0 }}>All business modules</h3>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                These links always open their own module. Dashboard always remains `/dashboard`.
              </div>
            </div>
          </div>

          <div className="quick-grid">
            {quickLinks.map(([label, href]) => (
              <Link href={href} className="quick-action" key={href}>
                {label}
                <ArrowUpRight size={14} style={{ marginLeft: "auto" }}/>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
