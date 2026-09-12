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
import { useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/Shared";
import { money } from "@/components/RealUi";
import { apiFetch } from "@/lib/api";

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

export default function DashboardPage() {
  const [counts, setCounts] = useState<Record<CountKey, number | null>>({
    vehicles: null,
    parts: null,
    newItems: null,
    inventory: null,
    customers: null,
    sales: null,
    suppliers: null,
    purchases: null,
    shipments: null,
    containers: null,
    payments: null,
    tasks: null,
    documents: null,
    employees: null,
    approvals: null,
  });
  const [errors, setErrors] = useState(0);

  const [overview, setOverview] = useState<{
    todaySales: number | null; inventoryValue: number | null; receivables: number | null;
    payables: number | null; lowStock: number | null; pendingPayments: number | null;
  }>({ todaySales: null, inventoryValue: null, receivables: null, payables: null, lowStock: null, pendingPayments: null });

  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const totalEndpoints: Array<[CountKey, string]> = [
      ["vehicles", "/vehicles?limit=1"],
      ["parts", "/used-parts?limit=1"],
      ["newItems", "/new-items?limit=1"],
      ["inventory", "/inventory?limit=1"],
      ["customers", "/customers?limit=1"],
      ["sales", "/sales-orders?limit=1"],
      ["suppliers", "/suppliers?limit=1"],
      ["purchases", "/purchase-orders?limit=1"],
      ["shipments", "/shipments?limit=1"],
      ["containers", "/containers?limit=1"],
      ["payments", "/payments?limit=1"],
      ["tasks", "/tasks?limit=1"],
      ["documents", "/documents?limit=1"],
      ["employees", "/hr/employees?limit=1"],
    ];

    totalEndpoints.forEach(([key, path]) => {
      apiFetch<CountResponse>(path)
        .then((response) => {
          if (!cancelled) {
            setCounts((current) => ({ ...current, [key]: response.total }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCounts((current) => ({ ...current, [key]: 0 }));
            setErrors((current) => current + 1);
          }
        });
    });

    apiFetch<any[]>("/ai-admin/approvals?approval_status=pending&limit=100")
      .then((rows) => {
        if (!cancelled) setCounts((current) => ({ ...current, approvals: rows.length }));
      })
      .catch(() => {
        if (!cancelled) {
          setCounts((current) => ({ ...current, approvals: 0 }));
          setErrors((current) => current + 1);
        }
      });

    Promise.all([
      apiFetch<SalesOrderList>("/sales-orders?limit=300"),
      apiFetch<PaymentList>("/payments?limit=300"),
      apiFetch<PurchaseOrderList>("/purchase-orders?limit=300"),
      apiFetch<ValuationRow[]>("/inventory/valuation"),
      apiFetch<CustomerListResp>("/customers?limit=300"),
      apiFetch<SupplierListResp>("/suppliers?limit=300"),
      apiFetch<InventoryListResp>("/inventory?limit=300"),
      apiFetch<CountResponse>("/payments?tx_status=pending&limit=1"),
    ])
      .then(([sales, payments, purchases, valuation, customers, suppliers, inventory, pendingPayments]) => {
        if (cancelled) return;

        const todaysDate = today();
        const todaySales = sales.items
          .filter((o) => o.order_date?.slice(0, 10) === todaysDate)
          .reduce((sum, o) => sum + Number(o.order_total), 0);
        const inventoryValue = valuation.reduce((sum, v) => sum + Number(v.total_inventory_value), 0);
        const receivables = customers.items.reduce((sum, c) => sum + Number(c.outstanding_balance), 0);
        const payables = suppliers.items.reduce((sum, s) => sum + Number(s.outstanding_balance), 0);
        const lowStock = inventory.items.filter((r) => Number(r.quantity_available) <= 2).length;

        setOverview({
          todaySales, inventoryValue, receivables, payables, lowStock,
          pendingPayments: pendingPayments.total,
        });

        const saleEvents: ActivityItem[] = sales.items.slice(0, 6).map((o) => ({
          id: `sale-${o.order_number}`,
          text: `${o.customer_name || "Walk-in customer"} purchased order ${o.order_number} — ${money(o.order_total)}`,
          time: o.created_at,
          href: "/dashboard/sales",
        }));
        const paymentEvents: ActivityItem[] = payments.items.slice(0, 6).map((p) => ({
          id: `pay-${p.transaction_number}`,
          text: p.direction === "incoming"
            ? `Payment ${money(p.amount)} received from ${p.customer_name || p.counterparty_name || "customer"}`
            : `Payment ${money(p.amount)} sent to ${p.supplier_name || p.counterparty_name || "supplier"}`,
          time: p.created_at,
          href: "/dashboard/payments",
        }));
        const stockEvents: ActivityItem[] = purchases.items
          .filter((p) => p.status === "fully_received" || p.status === "partially_received")
          .slice(0, 6)
          .map((p) => ({
            id: `po-${p.po_number}`,
            text: `Stock received from ${p.supplier_name} (${p.po_number})`,
            time: p.updated_at,
            href: "/dashboard/purchases",
          }));

        const merged = [...saleEvents, ...paymentEvents, ...stockEvents]
          .filter((e) => e.time)
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 8);
        setActivity(merged);
      })
      .catch(() => { if (!cancelled) setErrors((current) => current + 1); });

    return () => { cancelled = true; };
  }, []);

  const display = (value: number | null) => value === null ? "—" : String(value);
  const displayMoney = (value: number | null) => value === null ? "—" : money(value);

  const liveModules = useMemo(
    () => Object.values(counts).filter((value) => value !== null).length,
    [counts],
  );

  const quickLinks: Array<[string, string]> = [
    ["Vehicles", "/dashboard/vehicles"],
    ["Used Parts", "/dashboard/parts"],
    ["New Items", "/dashboard/new-items"],
    ["Inventory", "/dashboard/inventory"],
    ["Customers", "/dashboard/customers"],
    ["Sales", "/dashboard/sales"],
    ["Suppliers", "/dashboard/suppliers"],
    ["Purchase Orders", "/dashboard/purchases"],
    ["Procurement Ops", "/dashboard/procurement"],
    ["Shipments", "/dashboard/shipments"],
    ["Containers", "/dashboard/containers"],
    ["Payments", "/dashboard/payments"],
    ["Tasks", "/dashboard/tasks"],
    ["Documents", "/dashboard/documents"],
    ["Employees & HR", "/dashboard/employees"],
    ["System Admin", "/dashboard/settings"],
  ];

  const quickActions = [
    { label: "New Sale", href: "/dashboard/sales?action=new-sale", icon: ShoppingCart },
    { label: "Receive Stock", href: "/dashboard/purchases", icon: PackagePlus },
    { label: "Add Product", href: "/dashboard/new-items?action=add", icon: Boxes },
    { label: "Add Customer", href: "/dashboard/customers?action=add", icon: UserRoundPlus },
    { label: "Receive Payment", href: "/dashboard/payments?action=receive-payment", icon: WalletCards },
  ];

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
        <Link href="/dashboard/ai" className="btn btn-primary">
          <Sparkles size={15}/> AI & Approvals
        </Link>
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
        <MetricCard label="Today's Sales" value={displayMoney(overview.todaySales)} trend="Orders placed today" icon={DollarSign} href="/dashboard/sales"/>
        <MetricCard label="Inventory Value" value={displayMoney(overview.inventoryValue)} trend="On-hand stock" icon={Boxes} href="/dashboard/inventory"/>
        <MetricCard label="Customer Receivables" value={displayMoney(overview.receivables)} trend="Owed by customers" icon={Users} href="/dashboard/customers"/>
        <MetricCard label="Supplier Payables" value={displayMoney(overview.payables)} trend="Owed to suppliers" icon={Factory} href="/dashboard/suppliers"/>
        <MetricCard label="Low Stock Items" value={display(overview.lowStock)} trend="≤2 units available" icon={AlertTriangle} href="/dashboard/inventory"/>
        <MetricCard label="Pending Payments" value={display(overview.pendingPayments)} trend="Awaiting manager posting" icon={WalletCards} href="/dashboard/payments"/>
      </div>

      <div className="panel-head" style={{ marginBottom: 10 }}>
        <div><h3 style={{ margin: 0 }}>Quick Actions</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Jump straight into the simple action — the system handles the rest.</div></div>
      </div>
      <div className="quick-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 24 }}>
        {quickActions.map((a) => (
          <Link href={a.href} className="quick-action" key={a.href}>
            <a.icon size={15}/> {a.label}
          </Link>
        ))}
      </div>

      <div className="metric-grid">
        <MetricCard label="Vehicles" value={display(counts.vehicles)} trend="Live catalog" icon={CarFront} href="/dashboard/vehicles"/>
        <MetricCard label="Used Parts" value={display(counts.parts)} trend="Live catalog" icon={PackageSearch} href="/dashboard/parts"/>
        <MetricCard label="New Items" value={display(counts.newItems)} trend="Live catalog" icon={Boxes} href="/dashboard/new-items"/>
        <MetricCard label="Inventory Rows" value={display(counts.inventory)} trend="Live stock balances" icon={Boxes} href="/dashboard/inventory"/>
        <MetricCard label="Customers" value={display(counts.customers)} trend="CRM" icon={Users} href="/dashboard/customers"/>
        <MetricCard label="Sales Orders" value={display(counts.sales)} trend="Sales" icon={ShoppingCart} href="/dashboard/sales"/>
        <MetricCard label="Suppliers" value={display(counts.suppliers)} trend="Procurement" icon={Factory} href="/dashboard/suppliers"/>
        <MetricCard label="Purchase Orders" value={display(counts.purchases)} trend="Procurement" icon={ClipboardList} href="/dashboard/purchases"/>
        <MetricCard label="Shipments" value={display(counts.shipments)} trend="Logistics" icon={Truck} href="/dashboard/shipments"/>
        <MetricCard label="Containers" value={display(counts.containers)} trend="Logistics" icon={Container} href="/dashboard/containers"/>
        <MetricCard label="Payments" value={display(counts.payments)} trend="Finance" icon={WalletCards} href="/dashboard/payments"/>
        <MetricCard label="Open Tasks" value={display(counts.tasks)} trend="Operations" icon={ClipboardList} href="/dashboard/tasks"/>
        <MetricCard label="Documents" value={display(counts.documents)} trend="Records" icon={FileText} href="/dashboard/documents"/>
        <MetricCard label="Employees" value={display(counts.employees)} trend="HR" icon={UserRoundCog} href="/dashboard/employees"/>
        <MetricCard label="Pending Approvals" value={display(counts.approvals)} trend="AI / controls" icon={Sparkles} href="/dashboard/ai"/>
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
