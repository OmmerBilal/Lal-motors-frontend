"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Plug, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AIDraftsSection } from "@/components/AIDraftsSection";
import {
  EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, labelize, money,
} from "@/components/RealUi";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type Provider = "shopify" | "ebay";

type Account = {
  id: string; provider: string; account_name: string; external_account_id: string | null;
  credentials_reference: string | null; settings: any; status: string; last_error?: string | null;
  last_sync_at: string | null; created_at: string; updated_at: string;
};
type Listing = {
  id: string; integration_account_id: string; provider: string; account_name: string; item_id: string;
  item_code: string; item_name: string; external_listing_id: string | null; listing_url: string | null;
  title: string | null; listing_status: string; listing_price: number | string | null; currency_code: string | null;
  inventory_link_status?: string; last_synced_at: string | null; created_at: string; updated_at: string;
};
type ExternalOrder = {
  id: string; provider: string; external_order_id: string; customer_summary: any; item_summary: any[];
  totals: any; order_status: string | null; fulfillment_state: string | null; mapping_status: string;
  linked_sales_order_id: string | null; created_at: string; last_synced_at: string;
};

const TABS_BY_PROVIDER: Record<Provider, string[]> = {
  shopify: ["Overview", "Products", "Orders", "Inventory", "Customers", "Drafts", "Sync"],
  ebay: ["Overview", "Listings", "Orders", "Inventory", "Drafts", "Sync"],
};

export function ChannelBusinessModule({ provider, title }: { provider: Provider; title: string }) {
  const queryClient = useQueryClient();
  const tabs = TABS_BY_PROVIDER[provider];
  const [tab, setTab] = useState(tabs[0]);
  const [search, setSearch] = useState("");
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [connectForm, setConnectForm] = useState({ account_name: "", shop_domain_or_marketplace: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: user } = useQuery({ queryKey: queryKeys.auth.me(), queryFn: getCurrentUser, staleTime: 5 * 60 * 1000 });
  const canManage = useMemo(() => {
    const r = new Set((user?.roles || []).map((x: string) => x.toLowerCase()));
    return r.has("administrator") || r.has("manager");
  }, [user]);

  const connectionQuery = useQuery({
    queryKey: queryKeys[provider].connection(),
    queryFn: () => apiFetch<{ provider: string; status: string; account: Account | null }>(`/integrations/connection?provider=${provider}`),
    staleTime: 30 * 1000,
  });
  const isConnected = connectionQuery.data?.status === "connected";
  const account: Account | null = connectionQuery.data?.account ?? null;

  const listingsKey = provider === "shopify" ? queryKeys.shopify.products({}) : queryKeys.ebay.listings({});
  const listingsQuery = useQuery({
    queryKey: listingsKey,
    queryFn: () => apiFetch<Listing[]>(`/integrations/listings?provider=${provider}`),
    staleTime: 2 * 60 * 1000,
  });
  const listings = listingsQuery.data ?? [];
  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter(l => `${l.item_name} ${l.item_code} ${l.title || ""}`.toLowerCase().includes(q));
  }, [listings, search]);

  const ordersQuery = useQuery({
    queryKey: queryKeys[provider].orders({}),
    queryFn: () => apiFetch<ExternalOrder[]>(`/integrations/orders?provider=${provider}`),
    staleTime: 60 * 1000,
  });
  const orders = ordersQuery.data ?? [];

  async function createAccount() {
    setSavingAccount(true); setError("");
    try {
      const settingsKey = provider === "shopify" ? "shop_domain" : "marketplace_id";
      await apiFetch("/integrations/accounts", {
        method: "POST", body: JSON.stringify({
          provider, account_name: connectForm.account_name || `${title} Account`,
          settings: { [settingsKey]: connectForm.shop_domain_or_marketplace || undefined }, status: "active",
        }),
      });
      setSuccess(`${title} account record created. Add real credentials via environment variables to finish connecting.`);
      invalidate(queryClient, [provider]);
      setConnectModalOpen(false);
    } catch (e: any) { setError(e?.message || "Unable to create account."); }
    finally { setSavingAccount(false); }
  }

  async function testConnection() {
    setTesting(true); setError("");
    try {
      const res = await apiFetch<{ status: string }>(`/integrations/connection/test?provider=${provider}`, { method: "POST" });
      setSuccess(`Connection test: ${labelize(res.status)}.`);
      invalidate(queryClient, [provider]);
    } catch (e: any) { setError(e?.message || "Unable to test connection."); }
    finally { setTesting(false); }
  }

  async function syncNow() {
    setSyncing(true); setError("");
    try {
      const res = await apiFetch<{ processed: number; failed: number }>(`/integrations/${provider}/sync?sync_type=orders`, { method: "POST" });
      setSuccess(`Sync complete: ${res.processed} processed, ${res.failed} failed.`);
      invalidate(queryClient, [provider]);
    } catch (e: any) { setError(e?.message || "Unable to sync — is this account connected?"); }
    finally { setSyncing(false); }
  }

  const notConnectedBanner = <div className="card" style={{ padding: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
    <AlertTriangle size={16} />
    <div><strong>Connection: Not Connected</strong>
      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
        Drafts and local records still work. Connect {title} in the Sync tab to enable live sync and publishing.
      </div>
    </div>
  </div>;

  return <>
    <div className="page-header">
      <div><div className="eyebrow">Channel</div><h1 className="page-title">{title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <StatusBadge value={connectionQuery.data?.status || "not_connected"} />
          <span className="muted" style={{ fontSize: 12 }}>Connection status</span>
        </div>
      </div>
      <button className="btn btn-secondary" onClick={() => connectionQuery.refetch()}><RefreshCw size={15} />Refresh</button>
    </div>

    <Message error={error} success={success} />

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {tabs.map(t => <button key={t} className={`btn ${tab === t ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t)}>{t}</button>)}
    </div>

    {!isConnected && tab !== "Sync" && tab !== "Drafts" && notConnectedBanner}

    {tab === "Overview" && <div className="metric-grid">
      <div className="metric-card"><div className="metric-top"><span>Active Listings</span></div><div className="metric-value">{listings.filter(l => l.listing_status === "published").length}</div></div>
      <div className="metric-card"><div className="metric-top"><span>Draft/Local Listings</span></div><div className="metric-value">{listings.filter(l => l.listing_status !== "published").length}</div></div>
      <div className="metric-card"><div className="metric-top"><span>Recent Orders</span></div><div className="metric-value">{orders.length}</div></div>
      <div className="metric-card"><div className="metric-top"><span>Last Sync</span></div><div className="metric-value" style={{ fontSize: 15 }}>{account?.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : "Never"}</div></div>
      {account?.last_error && <div className="metric-card" style={{ gridColumn: "1 / -1" }}><div className="metric-top"><span>Last Sync Error</span></div><div style={{ color: "var(--danger)", fontSize: 13 }}>{account.last_error}</div></div>}
    </div>}

    {(tab === "Products" || tab === "Listings") && <>
      <div className="records-toolbar card">
        <div><strong>{title} {tab}</strong><div className="muted" style={{ fontSize: 12 }}>{filteredListings.length} visible — local records; live sync requires connection.</div></div>
        <div className="records-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." /></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Title</th><th>Price</th><th>SKU</th><th>Status</th><th>Sync Status</th><th>Last Sync</th></tr></thead>
        <tbody>{listingsQuery.isLoading ? <LoadingRow columns={7} /> : filteredListings.length === 0 ? <EmptyRow columns={7} text="No listing records yet." /> : filteredListings.map(l =>
          <tr key={l.id}><td><strong>{l.item_name}</strong><div className="muted" style={{ fontSize: 11 }}>{l.item_code}</div></td>
            <td>{l.title || "—"}</td><td>{l.listing_price != null ? money(l.listing_price, l.currency_code || "USD") : "—"}</td>
            <td>{l.item_code}</td><td><StatusBadge value={l.listing_status} /></td>
            <td><StatusBadge value={l.inventory_link_status || "unlinked"} /></td>
            <td>{l.last_synced_at ? new Date(l.last_synced_at).toLocaleString() : "Not synced"}</td></tr>)}
        </tbody></table></div>
    </>}

    {tab === "Orders" && <>
      <div className="records-toolbar card"><div><strong>{title} Orders</strong><div className="muted" style={{ fontSize: 12 }}>{orders.length} visible</div></div>
        {canManage && isConnected && <button className="btn btn-primary" disabled={syncing} onClick={syncNow}><RefreshCw size={14} />{syncing ? "Syncing..." : "Sync Orders"}</button>}
      </div>
      {!isConnected && <div className="card" style={{ padding: 13, marginBottom: 12 }}>Connect {title} to sync orders.</div>}
      <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Fulfillment</th><th>Mapping</th><th>Last Synced</th></tr></thead>
        <tbody>{ordersQuery.isLoading ? <LoadingRow columns={7} /> : orders.length === 0 ? <EmptyRow columns={7} text="No orders synced yet." /> : orders.map(o =>
          <tr key={o.id}><td><strong>{o.external_order_id}</strong></td><td>{o.customer_summary?.name || o.customer_summary?.email || "—"}</td>
            <td>{o.totals?.total ? money(o.totals.total, o.totals.currency || "USD") : "—"}</td>
            <td><StatusBadge value={o.order_status || "unknown"} /></td><td>{o.fulfillment_state ? <StatusBadge value={o.fulfillment_state} /> : "—"}</td>
            <td><StatusBadge value={o.mapping_status} /></td><td>{new Date(o.last_synced_at).toLocaleString()}</td></tr>)}
        </tbody></table></div>
    </>}

    {tab === "Inventory" && <>
      <div className="records-toolbar card"><div><strong>Inventory Linkage</strong><div className="muted" style={{ fontSize: 12 }}>
        Lal Motors inventory stays the source of truth — {title} updates are sent FROM Lal Motors after approved changes, never the other way.</div></div></div>
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>{title} SKU</th><th>Link Status</th></tr></thead>
        <tbody>{listings.length === 0 ? <EmptyRow columns={3} text="No linked items yet." /> : listings.map(l =>
          <tr key={l.id}><td><strong>{l.item_name}</strong></td><td>{l.item_code}</td><td><StatusBadge value={l.inventory_link_status || "unlinked"} /></td></tr>)}
        </tbody></table></div>
    </>}

    {tab === "Customers" && <div className="card" style={{ padding: 20, textAlign: "center" }}>
      {isConnected ? "Customer sync runs alongside order sync." : `Connect ${title} to sync customers.`}
    </div>}

    {tab === "Drafts" && <AIDraftsSection provider={provider} title={title} />}

    {tab === "Sync" && <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <strong>Connection</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 12 }}>
          {account ? `Account "${account.account_name}" exists. ` : "No account record yet. "}
          Real credentials are added via environment variables ({provider === "shopify" ? "SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP_DOMAIN" : "EBAY_ACCESS_TOKEN"}) — never entered here.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canManage && !account && <button className="btn btn-primary" onClick={() => setConnectModalOpen(true)}><Plug size={14} />Connect / Configure</button>}
          {canManage && account && <button className="btn btn-secondary" disabled={testing} onClick={testConnection}><CheckCircle2 size={14} />{testing ? "Testing..." : "Test Connection"}</button>}
          {canManage && account && <button className="btn btn-secondary" disabled={syncing} onClick={syncNow}><RefreshCw size={14} />{syncing ? "Syncing..." : "Sync Now"}</button>}
        </div>
      </div>
      <div className="card" style={{ padding: 13 }}>
        <strong>Publishing</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {isConnected ? "Approved drafts can be published from the Drafts tab." : `Connect ${title} to publish — Approve a draft first in the Drafts tab either way.`}
        </div>
      </div>
    </>}

    {connectModalOpen && <Modal title={`Connect ${title}`} eyebrow="Sync / Connection" onClose={() => setConnectModalOpen(false)}>
      <div className="form-grid">
        <Field label="Account Name" value={connectForm.account_name} onChange={v => setConnectForm({ ...connectForm, account_name: v })} placeholder={`${title} Account`} />
        <Field label={provider === "shopify" ? "Shop Domain" : "Marketplace ID"} value={connectForm.shop_domain_or_marketplace}
          onChange={v => setConnectForm({ ...connectForm, shop_domain_or_marketplace: v })}
          placeholder={provider === "shopify" ? "my-shop.myshopify.com" : "EBAY_US"} />
      </div>
      <div className="card" style={{ padding: 10, marginTop: 12, fontSize: 12 }}>
        This creates the account record only. The real access token is added later via an environment
        variable on the server — never typed into this form.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setConnectModalOpen(false)}>Cancel</button>
        <button className="btn btn-primary" disabled={savingAccount} onClick={createAccount}>Save Account</button>
      </div>
    </Modal>}
    <GlobalSpinStyle />
  </>;
}
