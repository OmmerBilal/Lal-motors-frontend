"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Plug, Plus, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AIDraftsSection } from "@/components/AIDraftsSection";
import { ProviderAccountSelector, accountLabel } from "@/components/ProviderAccountSelector";
import {
  EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, StatusBadge, labelize, money,
} from "@/components/RealUi";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type Provider = "shopify" | "ebay";

type Account = {
  id: string; provider: string; account_name: string; display_name?: string | null;
  external_account_id: string | null; shop_domain?: string | null;
  credentials_reference?: string | null; settings: any; status: string; last_error?: string | null;
  last_sync_at: string | null; created_at: string; updated_at: string; connection_status?: string;
  webhooks_status?: string | null; webhooks_note?: string | null;
};
type Listing = {
  id: string; integration_account_id: string; provider: string; account_name: string; item_id: string;
  item_code: string; item_name: string; external_listing_id: string | null; listing_url: string | null;
  title: string | null; listing_status: string; listing_price: number | string | null; currency_code: string | null;
  inventory_link_status?: string; last_synced_at: string | null; created_at: string; updated_at: string;
};
type ExternalOrder = {
  id: string; provider: string; external_order_id: string; order_number?: string | null;
  customer_summary: any; item_summary: any[];
  totals: any; order_status: string | null; fulfillment_state: string | null; mapping_status: string;
  linked_sales_order_id: string | null; created_at: string; last_synced_at: string; currency_code?: string | null;
};
type LiveProduct = {
  external_listing_id: string; title: string; price: number | null; sku: string | null;
  quantity: number | null; status: string; variants?: { title?: string | null; sku?: string | null; quantity?: number | null }[];
  variant_count?: number; updated_at?: string | null; listing_url?: string | null;
  linkage_state?: string; item_id?: string | null; item_name?: string | null; item_code?: string | null;
};
type LiveOrder = {
  external_order_id: string; order_number?: string | null; order_status: string; fulfillment_state: string | null;
  customer: { name?: string | null; email?: string | null }; totals: any; items: any[];
  created_at?: string | null; currency?: string | null; import_state?: string | null;
};
type LiveCustomer = {
  external_customer_id: string; name: string | null; email: string | null; phone: string | null;
  order_count: number | null; total_spent: number | null; match_state?: string | null;
  matched_customer_name?: string | null;
};
type LiveInventory = {
  inventory_item_id: string; location_id: string; location_name?: string | null; available: number | null;
};
type LiveLocation = {
  id: string; name: string | null; active?: boolean; city?: string | null; country?: string | null;
};
type InventoryCompareRow = {
  product: string; sku?: string | null; external_listing_id?: string | null;
  lal_motors_available: number | null; shopify_available: number | null; status: string;
};
type SyncRun = {
  id: string; sync_type: string; status: string; items_processed: number | null; items_failed: number | null;
  error_message: string | null; started_at: string; completed_at: string | null;
};
type Overview = {
  integration_account_id: string; display_name: string; shop_domain?: string | null;
  connection_status: string; product_count: number; order_count: number; customer_count: number;
  ai_draft_count: number; last_successful_sync: SyncRun | null; last_failed_sync: SyncRun | null;
  last_error?: string | null; last_sync_at?: string | null;
};
type CatalogItem = { id: string; item_code: string; sku?: string | null; name: string };
type ConnectionResponse = {
  provider: string; status: string; account: Account | null;
  accounts?: Account[]; requires_account_selection?: boolean;
};

const TABS_BY_PROVIDER: Record<Provider, string[]> = {
  shopify: ["Overview", "Products", "Orders", "Inventory", "Customers", "Drafts", "Sync"],
  ebay: ["Overview", "Listings", "Orders", "Inventory", "Drafts", "Sync"],
};

function queryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load Shopify data.";
}

function withAccount(path: string, accountId: string) {
  if (!accountId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}integration_account_id=${accountId}`;
}

function fmtWhen(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function webhooksLabel(store: Account) {
  if (store.status !== "active") return "—";
  if (store.webhooks_status === "active") return "Active";
  return "Attention required";
}

function ViewOnShopify({ href }: { href?: string | null }) {
  if (!href) return <span className="muted">—</span>;
  return (
    <a className="btn btn-secondary" href={href} target="_blank" rel="noreferrer" style={{ padding: "4px 8px", fontSize: 12 }}>
      <ExternalLink size={12} /> View on Shopify
    </a>
  );
}

export function ChannelBusinessModule({ provider, title }: { provider: Provider; title: string }) {
  const queryClient = useQueryClient();
  const tabs = TABS_BY_PROVIDER[provider];
  const [tab, setTab] = useState(tabs[0]);
  const [search, setSearch] = useState("");
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [connectForm, setConnectForm] = useState({ account_name: "", shop_domain_or_marketplace: "" });
  const [pendingConnectId, setPendingConnectId] = useState("");
  const [installUrl, setInstallUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [syncing, setSyncing] = useState("");
  const [testing, setTesting] = useState(false);
  const [storeAction, setStoreAction] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [linkProduct, setLinkProduct] = useState<LiveProduct | null>(null);
  const [catalogQ, setCatalogQ] = useState("");
  const searchParams = useSearchParams();

  const { data: user } = useQuery({ queryKey: queryKeys.auth.me(), queryFn: getCurrentUser, staleTime: 5 * 60 * 1000 });
  const perms = useMemo(() => new Set(user?.permissions || []), [user]);
  const canManage = useMemo(() => {
    const r = new Set((user?.roles || []).map((x: string) => x.toLowerCase()));
    return r.has("administrator") || r.has("manager");
  }, [user]);
  const canConnectStore = perms.has("settings.manage");
  const canSync = perms.has(`${provider}.inventory.sync`);
  const canLink = perms.has("shopify.products.edit");

  const connectionQuery = useQuery({
    queryKey: queryKeys[provider].connection(),
    queryFn: () => apiFetch<ConnectionResponse>(`/integrations/connection?provider=${provider}`),
    staleTime: 30 * 1000,
  });
  const accounts = connectionQuery.data?.accounts ?? [];
  const effectiveAccountId = selectedAccountId || (accounts.length === 1 ? String(accounts[0].id) : "");
  const selectedAccount = accounts.find(a => String(a.id) === effectiveAccountId) ?? null;
  const isConnected = connectionQuery.data?.status === "connected";
  const needsStoreChoice = accounts.length > 1 && !effectiveAccountId;
  const scoped = Boolean(effectiveAccountId);
  const accountKey = { integration_account_id: effectiveAccountId || "" };
  const storesQuery = useQuery({
    queryKey: queryKeys.shopify.stores(),
    queryFn: () => apiFetch<{ stores: Account[] }>("/integrations/shopify/stores"),
    enabled: provider === "shopify" && canConnectStore,
    staleTime: 15 * 1000,
  });
  const managedStores = storesQuery.data?.stores ?? [];

  useEffect(() => {
    if (provider !== "shopify") return;
    const status = searchParams.get("shopify_status");
    const err = searchParams.get("shopify_error");
    const accountId = searchParams.get("account_id");
    if (status === "connected") {
      setSuccess("Shopify store connected.");
      if (accountId) setSelectedAccountId(accountId);
      invalidate(queryClient, ["shopify"]);
    } else if (status === "error") {
      setError(err || "Shopify authorization did not complete.");
    }
  }, [provider, searchParams, queryClient]);

  useEffect(() => {
    if (accounts.length === 1) {
      const only = String(accounts[0].id);
      if (selectedAccountId !== only) setSelectedAccountId(only);
      return;
    }
    if (accounts.length > 1 && !selectedAccountId) {
      const saved = sessionStorage.getItem(`lal.channelAccount.${provider}`);
      if (saved && accounts.some(a => String(a.id) === saved)) setSelectedAccountId(saved);
    }
  }, [accounts, provider, selectedAccountId]);

  function selectAccount(id: string) {
    setSelectedAccountId(id);
    if (id) sessionStorage.setItem(`lal.channelAccount.${provider}`, id);
  }

  const listingsKey = provider === "shopify"
    ? queryKeys.shopify.products({ integration_account_id: effectiveAccountId || "" })
    : queryKeys.ebay.listings({ integration_account_id: effectiveAccountId || "" });
  const listingsQuery = useQuery({
    queryKey: listingsKey,
    queryFn: () => apiFetch<Listing[]>(
      withAccount(
        provider === "shopify" ? "/integrations/shopify/listings" : `/integrations/listings?provider=${provider}`,
        effectiveAccountId,
      ),
    ),
    enabled: scoped || accounts.length <= 1,
    staleTime: 2 * 60 * 1000,
  });
  const listings = listingsQuery.data ?? [];
  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter(l => `${l.item_name} ${l.item_code} ${l.title || ""} ${l.external_listing_id || ""}`.toLowerCase().includes(q));
  }, [listings, search]);

  const ordersQuery = useQuery({
    queryKey: queryKeys[provider].orders({ integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<ExternalOrder[]>(withAccount(`/integrations/orders?provider=${provider}`, effectiveAccountId)),
    enabled: scoped || accounts.length <= 1,
    staleTime: 60 * 1000,
  });
  const orders = ordersQuery.data ?? [];

  const liveEnabled = provider === "shopify" && isConnected && scoped;
  const overviewQuery = useQuery({
    queryKey: queryKeys.shopify.overview(accountKey),
    queryFn: () => apiFetch<Overview>(withAccount("/integrations/shopify/overview", effectiveAccountId)),
    enabled: liveEnabled && tab === "Overview",
    staleTime: 30 * 1000,
  });
  const liveProductsQuery = useQuery({
    queryKey: queryKeys.shopify.products({ live: true, integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<{ count: number; products: LiveProduct[] }>(
      withAccount("/integrations/shopify/live/products", effectiveAccountId),
    ),
    enabled: liveEnabled && (tab === "Overview" || tab === "Products"),
    staleTime: 60 * 1000,
  });
  const liveOrdersQuery = useQuery({
    queryKey: queryKeys.shopify.orders({ live: true, integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<{ count: number; orders: LiveOrder[] }>(
      withAccount("/integrations/shopify/live/orders", effectiveAccountId),
    ),
    enabled: liveEnabled && (tab === "Overview" || tab === "Orders"),
    staleTime: 60 * 1000,
  });
  const liveInventoryQuery = useQuery({
    queryKey: queryKeys.shopify.inventory({ live: true, integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<{ count: number; inventory: LiveInventory[]; locations: LiveLocation[] }>(
      withAccount("/integrations/shopify/live/inventory", effectiveAccountId),
    ),
    enabled: liveEnabled && tab === "Inventory",
    staleTime: 60 * 1000,
  });
  const comparisonQuery = useQuery({
    queryKey: queryKeys.shopify.inventory({ comparison: true, integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<{ count: number; rows: InventoryCompareRow[] }>(
      withAccount("/integrations/shopify/inventory-comparison", effectiveAccountId),
    ),
    enabled: liveEnabled && (tab === "Inventory" || tab === "Overview"),
    staleTime: 60 * 1000,
  });
  const liveCustomersQuery = useQuery({
    queryKey: queryKeys.shopify.customers({ live: true, integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<{ count: number; customers: LiveCustomer[] }>(
      withAccount("/integrations/shopify/live/customers", effectiveAccountId),
    ),
    enabled: liveEnabled && tab === "Customers",
    staleTime: 60 * 1000,
  });
  const syncRunsQuery = useQuery({
    queryKey: queryKeys.shopify.syncRuns(accountKey),
    queryFn: () => apiFetch<{ runs: SyncRun[]; last_successful_sync: SyncRun | null; last_failed_sync: SyncRun | null; store?: string }>(
      withAccount("/integrations/shopify/sync-runs", effectiveAccountId),
    ),
    enabled: provider === "shopify" && scoped && (tab === "Sync" || tab === "Overview"),
    staleTime: 15 * 1000,
  });
  const catalogQuery = useQuery({
    queryKey: ["shopify", "catalogLookup", catalogQ, effectiveAccountId],
    queryFn: () => apiFetch<CatalogItem[]>(`/integrations/shopify/catalog-lookup?q=${encodeURIComponent(catalogQ)}`),
    enabled: Boolean(linkProduct) && catalogQ.trim().length >= 2,
    staleTime: 15 * 1000,
  });

  const liveProducts = liveProductsQuery.data?.products ?? [];
  const liveOrders = liveOrdersQuery.data?.orders ?? [];
  const liveInventory = liveInventoryQuery.data?.inventory ?? [];
  const liveLocations = liveInventoryQuery.data?.locations ?? [];
  const liveCustomers = liveCustomersQuery.data?.customers ?? [];
  const comparisonRows = comparisonQuery.data?.rows ?? [];
  const overview = overviewQuery.data;
  const liveError = [liveProductsQuery.error, liveOrdersQuery.error, liveInventoryQuery.error, liveCustomersQuery.error, overviewQuery.error, comparisonQuery.error]
    .find(Boolean);

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

  async function startShopifyConnect() {
    setSavingAccount(true); setError(""); setSuccess("");
    try {
      const res = await apiFetch<{
        account?: Account; connection_state?: string; status?: string;
        install_required?: boolean; message?: string; install_guidance?: string;
      }>(
        "/integrations/shopify/connect/start",
        {
          method: "POST",
          body: JSON.stringify({
            account_name: connectForm.account_name,
            shop_domain: connectForm.shop_domain_or_marketplace,
          }),
        },
      );
      setPendingConnectId(res.account?.id || "");
      setInstallUrl("");
      invalidate(queryClient, ["shopify"]);
      if (res.connection_state === "connected" || res.status === "connected") {
        setSuccess(`${res.account ? accountLabel(res.account) : "Store"} is connected.`);
        if (res.account?.id) setSelectedAccountId(String(res.account.id));
        setConnectModalOpen(false);
        setPendingConnectId("");
        return;
      }
      setError(res.message || "The Lal Motors Shopify app must first be installed/approved on this store.");
      setSuccess(res.install_guidance || "Install the app on this shop in the Shopify Dev Dashboard, then click Verify Connection.");
    } catch (e: any) { setError(e?.message || "Unable to start Shopify connect."); }
    finally { setSavingAccount(false); }
  }

  async function verifyShopifyConnect(accountId?: string) {
    const id = accountId || pendingConnectId;
    if (!id) { setError("Enter the shop domain and click Connect Store first."); return; }
    setSavingAccount(true); setError("");
    try {
      const res = await apiFetch<{ account?: Account; connection_state?: string }>(
        "/integrations/shopify/connect/verify",
        { method: "POST", body: JSON.stringify({ account_id: id }) },
      );
      setSuccess(`${res.account ? accountLabel(res.account) : "Store"} is connected.`);
      if (res.account?.id) setSelectedAccountId(String(res.account.id));
      setConnectModalOpen(false);
      setPendingConnectId("");
      setInstallUrl("");
      invalidate(queryClient, ["shopify"]);
    } catch (e: any) { setError(e?.message || "Shopify did not confirm access to this shop."); }
    finally { setSavingAccount(false); }
  }

  async function renameStore(store: Account) {
    const next = window.prompt("Display name", store.display_name || store.account_name);
    if (!next || !next.trim()) return;
    setStoreAction(store.id);
    setError("");
    try {
      await apiFetch(`/integrations/shopify/stores/${store.id}/rename`, {
        method: "POST", body: JSON.stringify({ display_name: next.trim() }),
      });
      setSuccess("Store name updated.");
      invalidate(queryClient, ["shopify"]);
    } catch (e: any) { setError(e?.message || "Unable to rename store."); }
    finally { setStoreAction(""); }
  }

  async function disableStore(store: Account) {
    if (!window.confirm(`Disable ${accountLabel(store)}? Historical Shopify orders and listings stay on this account.`)) return;
    setStoreAction(store.id);
    setError("");
    try {
      await apiFetch(`/integrations/shopify/stores/${store.id}/disable`, { method: "POST" });
      setSuccess(`${accountLabel(store)} disabled.`);
      if (selectedAccountId === store.id) setSelectedAccountId("");
      invalidate(queryClient, ["shopify"]);
    } catch (e: any) { setError(e?.message || "Unable to disable store."); }
    finally { setStoreAction(""); }
  }

  async function enableStore(store: Account) {
    setStoreAction(store.id);
    setError("");
    try {
      const res = await apiFetch<Account>(`/integrations/shopify/stores/${store.id}/enable`, { method: "POST" });
      setSuccess(`${accountLabel(store)} enabled.`);
      if (res.id) setSelectedAccountId(String(res.id));
      invalidate(queryClient, ["shopify"]);
    } catch (e: any) { setError(e?.message || "Unable to enable this store. Shopify must still confirm access."); }
    finally { setStoreAction(""); }
  }

  async function reconnectStore(store: Account) {
    setStoreAction(store.id);
    setError("");
    try {
      const res = await apiFetch<{
        install_url?: string; account?: Account; connection_state?: string; status?: string;
        install_required?: boolean; message?: string; install_guidance?: string;
      }>(
        `/integrations/shopify/stores/${store.id}/reconnect`,
        { method: "POST" },
      );
      setPendingConnectId(store.id);
      setInstallUrl("");
      setConnectForm({
        account_name: store.display_name || store.account_name,
        shop_domain_or_marketplace: store.shop_domain || "",
      });
      invalidate(queryClient, ["shopify"]);
      if (res.connection_state === "connected" || res.status === "connected") {
        setSuccess(`${res.account ? accountLabel(res.account) : accountLabel(store)} is connected.`);
        if (res.account?.id) setSelectedAccountId(String(res.account.id));
        return;
      }
      setConnectModalOpen(true);
      setError(res.message || "The Lal Motors Shopify app must first be installed/approved on this store.");
      setSuccess(res.install_guidance || "Install the app on this shop in the Shopify Dev Dashboard, then click Verify Connection.");
    } catch (e: any) { setError(e?.message || "Unable to start reconnect."); }
    finally { setStoreAction(""); }
  }

  async function testConnection(accountId?: string) {
    const id = accountId || effectiveAccountId;
    if (!id) { setError("Select a store first."); return; }
    setTesting(true); setError("");
    try {
      const res = await apiFetch<{ status: string; webhooks_status?: string }>(
        withAccount(`/integrations/connection/test?provider=${provider}`, id),
        { method: "POST" },
      );
      const webhookBit = res.webhooks_status === "active"
        ? " Webhooks: Active."
        : res.webhooks_status === "attention_required"
          ? " Webhooks: Attention required."
          : "";
      setSuccess(`Connection test: ${labelize(res.status)}.${webhookBit}`);
      invalidate(queryClient, [provider]);
    } catch (e: any) { setError(e?.message || "Unable to test connection."); }
    finally { setTesting(false); }
  }

  async function syncNow(syncType = provider === "shopify" ? "all" : "orders") {
    if (needsStoreChoice) { setError("Select a store first."); return; }
    setSyncing(syncType); setError("");
    try {
      const res = await apiFetch<{ processed: number; failed: number; status?: string; store?: string }>(
        withAccount(`/integrations/${provider}/sync?sync_type=${syncType}`, effectiveAccountId),
        { method: "POST" },
      );
      const store = res.store ? ` for ${res.store}` : "";
      setSuccess(`Sync ${syncType}${store}: ${res.processed} processed, ${res.failed} failed${res.status ? ` (${res.status})` : ""}.`);
      invalidate(queryClient, [provider]);
    } catch (e: any) { setError(e?.message || "Unable to sync — is this account connected?"); }
    finally { setSyncing(""); }
  }

  async function linkToCatalog(item: CatalogItem) {
    if (!linkProduct) return;
    setError("");
    try {
      const res = await apiFetch<{ linkage_state?: string }>(
        withAccount(`/integrations/shopify/products/${linkProduct.external_listing_id}/link`, effectiveAccountId),
        { method: "POST", body: JSON.stringify({ item_id: item.id }) },
      );
      setSuccess(`Linked ${linkProduct.title} to ${item.name} (${res.linkage_state || "Linked"}).`);
      setLinkProduct(null);
      setCatalogQ("");
      invalidate(queryClient, [provider]);
    } catch (e: any) { setError(e?.message || "Unable to link this product."); }
  }

  const notConnectedBanner = <div className="card" style={{ padding: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
    <AlertTriangle size={16} />
    <div><strong>Connection: Not Connected</strong>
      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
        Drafts and local records still work. Connect {title} in the Sync tab to enable live sync and publishing.
      </div>
    </div>
  </div>;

  const shopifyLiveError = provider === "shopify" && liveError ? queryErrorMessage(liveError) : "";
  const storeName = selectedAccount ? accountLabel(selectedAccount) : "the selected store";

  return <>
    <div className="page-header">
      <div><div className="eyebrow">Channel</div><h1 className="page-title">{title}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <StatusBadge value={connectionQuery.data?.status || "not_connected"} />
          <span className="muted" style={{ fontSize: 12 }}>
            {isConnected ? (selectedAccount ? `Connected · ${accountLabel(selectedAccount)}` : "Connected") : "Connection status"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <ProviderAccountSelector accounts={accounts} value={effectiveAccountId} onChange={selectAccount} requireSelection={accounts.length > 1} />
        {provider === "shopify" && canConnectStore && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setConnectForm({ account_name: "", shop_domain_or_marketplace: "" });
              setPendingConnectId("");
              setInstallUrl("");
              setConnectModalOpen(true);
            }}
          >
            <Plus size={15} /> Connect Store
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => connectionQuery.refetch()}><RefreshCw size={15} />Refresh</button>
      </div>
    </div>

    <Message error={error || shopifyLiveError} success={success} />

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {tabs.map(t => <button key={t} className={`btn ${tab === t ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(t)}>{t}</button>)}
    </div>

    {!isConnected && tab !== "Sync" && tab !== "Drafts" && notConnectedBanner}
    {needsStoreChoice && tab !== "Drafts" && tab !== "Sync" && (
      <div className="card" style={{ padding: 13, marginBottom: 16 }}>
        Select a {title} store to load Overview, Products, Orders, Inventory, and Customers for that store only.
      </div>
    )}

    {tab === "Overview" && !needsStoreChoice && <div className="metric-grid">
      <div className="metric-card"><div className="metric-top"><span>Connection</span></div>
        <div className="metric-value" style={{ fontSize: 18 }}>{labelize(overview?.connection_status || connectionQuery.data?.status || "not_connected")}</div>
        <div className="muted" style={{ fontSize: 12 }}>{selectedAccount ? accountLabel(selectedAccount) : "No store selected"}</div></div>
      <div className="metric-card"><div className="metric-top"><span>{provider === "shopify" && isConnected ? "Shopify Products" : "Active Listings"}</span></div>
        <div className="metric-value">{provider === "shopify" && isConnected ? (liveProductsQuery.data?.count ?? overview?.product_count ?? "…") : listings.filter(l => l.listing_status === "published").length}</div></div>
      <div className="metric-card"><div className="metric-top"><span>{provider === "shopify" ? "AI Shopify Drafts" : "Draft/Local Listings"}</span></div>
        <div className="metric-value">{provider === "shopify" ? (overview?.ai_draft_count ?? "…") : listings.length}</div></div>
      <div className="metric-card"><div className="metric-top"><span>{provider === "shopify" && isConnected ? "Shopify Orders" : "Recent Orders"}</span></div>
        <div className="metric-value">{provider === "shopify" && isConnected ? (liveOrdersQuery.data?.count ?? overview?.order_count ?? "…") : orders.length}</div></div>
      <div className="metric-card"><div className="metric-top"><span>Last Successful Sync</span></div>
        <div className="metric-value" style={{ fontSize: 15 }}>{fmtWhen(overview?.last_successful_sync?.completed_at || overview?.last_sync_at || selectedAccount?.last_sync_at)}</div>
        {overview?.last_successful_sync?.sync_type && <div className="muted" style={{ fontSize: 12 }}>{overview.last_successful_sync.sync_type}</div>}</div>
      {(overview?.last_failed_sync || selectedAccount?.last_error) && <div className="metric-card" style={{ gridColumn: "1 / -1" }}><div className="metric-top"><span>Last Failed Sync</span></div>
        <div style={{ color: "var(--danger)", fontSize: 13 }}>{overview?.last_failed_sync?.error_message || selectedAccount?.last_error}</div>
        <div className="muted" style={{ fontSize: 12 }}>{fmtWhen(overview?.last_failed_sync?.completed_at || overview?.last_failed_sync?.started_at)}</div></div>}
    </div>}

    {(tab === "Products" || tab === "Listings") && provider === "shopify" && isConnected && !needsStoreChoice && <>
      <div className="records-toolbar card">
        <div><strong>Shopify Products</strong><div className="muted" style={{ fontSize: 12 }}>{liveProducts.length} live products from {storeName}. Linkage is manual — unmatched products are not turned into Lal Motors catalog items.</div></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Title</th><th>Shopify ID</th><th>Status</th><th>Price</th><th>SKU</th><th>Variants</th><th>Inventory</th><th>Updated</th><th>Linkage</th><th></th></tr></thead>
        <tbody>{liveProductsQuery.isLoading ? <LoadingRow columns={10} /> : liveProducts.length === 0 ? <EmptyRow columns={10} text="No Shopify products yet." /> : liveProducts.map(p =>
          <tr key={p.external_listing_id}><td><strong>{p.title}</strong>{p.item_name && <div className="muted" style={{ fontSize: 11 }}>{p.item_name}</div>}</td>
            <td>{p.external_listing_id}</td>
            <td><StatusBadge value={p.status} /></td>
            <td>{p.price != null ? money(p.price, "USD") : "—"}</td>
            <td>{p.sku || "—"}</td>
            <td>{p.variant_count ?? (p.variants?.length || 0)}</td>
            <td>{p.quantity ?? "—"}</td>
            <td>{p.updated_at ? fmtWhen(p.updated_at) : "—"}</td>
            <td><StatusBadge value={p.linkage_state || "Unlinked"} /></td>
            <td style={{ whiteSpace: "nowrap" }}>
              <ViewOnShopify href={p.listing_url} />
              {canLink && (p.linkage_state || "Unlinked") !== "Linked" && (
                <button className="btn btn-secondary" style={{ marginLeft: 6, padding: "4px 8px", fontSize: 12 }} onClick={() => { setLinkProduct(p); setCatalogQ(""); }}>Link</button>
              )}
            </td></tr>)}
        </tbody></table></div>
      <div className="records-toolbar card" style={{ marginTop: 16 }}>
        <div><strong>Published from Lal Motors</strong><div className="muted" style={{ fontSize: 12 }}>{filteredListings.length} local listing records with persisted Shopify IDs.</div></div>
        <div className="records-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." /></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Title</th><th>Price</th><th>Shopify ID</th><th>Status</th><th>Link</th><th></th></tr></thead>
        <tbody>{listingsQuery.isLoading ? <LoadingRow columns={7} /> : filteredListings.length === 0 ? <EmptyRow columns={7} text="No published Lal Motors listings yet." /> : filteredListings.map(l =>
          <tr key={l.id}><td><strong>{l.item_name}</strong><div className="muted" style={{ fontSize: 11 }}>{l.item_code}</div></td>
            <td>{l.title || "—"}</td><td>{l.listing_price != null ? money(l.listing_price, l.currency_code || "USD") : "—"}</td>
            <td>{l.external_listing_id || "—"}</td><td><StatusBadge value={l.listing_status} /></td>
            <td><StatusBadge value={l.inventory_link_status || "unlinked"} /></td>
            <td><ViewOnShopify href={l.listing_url || (selectedAccount?.shop_domain && l.external_listing_id ? `https://${selectedAccount.shop_domain}/admin/products/${l.external_listing_id}` : null)} /></td></tr>)}
        </tbody></table></div>
    </>}

    {(tab === "Products" || tab === "Listings") && !(provider === "shopify" && isConnected) && !needsStoreChoice && <>
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

    {tab === "Orders" && !needsStoreChoice && <>
      <div className="records-toolbar card"><div><strong>{title} Orders</strong>
        <div className="muted" style={{ fontSize: 12 }}>
          {provider === "shopify" && isConnected
            ? `${liveOrders.length} live Shopify orders from ${storeName}. Sync persists them internally without creating duplicate Lal Motors sales.`
            : `${orders.length} synced orders`}
        </div></div>
        {canSync && isConnected && <button className="btn btn-primary" disabled={Boolean(syncing)} onClick={() => syncNow("orders")}><RefreshCw size={14} />{syncing === "orders" ? "Syncing..." : "Sync Orders"}</button>}
      </div>
      {!isConnected && <div className="card" style={{ padding: 13, marginBottom: 12 }}>Connect {title} to sync orders.</div>}
      {provider === "shopify" && isConnected ? (
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Financial</th><th>Fulfillment</th><th>Created</th><th>Import</th></tr></thead>
          <tbody>{liveOrdersQuery.isLoading ? <LoadingRow columns={7} /> : liveOrders.length === 0 ? <EmptyRow columns={7} text="No Shopify orders yet." /> : liveOrders.map(o =>
            <tr key={o.external_order_id}><td><strong>{o.order_number || o.external_order_id}</strong><div className="muted" style={{ fontSize: 11 }}>{o.external_order_id}</div></td>
              <td>{o.customer?.name || o.customer?.email || "—"}</td>
              <td>{o.totals?.total ? money(o.totals.total, o.currency || o.totals.currency || "USD") : "—"}</td>
              <td><StatusBadge value={o.order_status || "unknown"} /></td>
              <td>{o.fulfillment_state ? <StatusBadge value={o.fulfillment_state} /> : "—"}</td>
              <td>{o.created_at ? fmtWhen(o.created_at) : "—"}</td>
              <td>{o.import_state || "Not imported"}</td></tr>)}
          </tbody></table></div>
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Fulfillment</th><th>Mapping</th><th>Last Synced</th></tr></thead>
          <tbody>{ordersQuery.isLoading ? <LoadingRow columns={7} /> : orders.length === 0 ? <EmptyRow columns={7} text="No orders synced yet." /> : orders.map(o =>
            <tr key={o.id}><td><strong>{o.order_number || o.external_order_id}</strong></td><td>{o.customer_summary?.name || o.customer_summary?.email || "—"}</td>
              <td>{o.totals?.total ? money(o.totals.total, o.totals.currency || o.currency_code || "USD") : "—"}</td>
              <td><StatusBadge value={o.order_status || "unknown"} /></td><td>{o.fulfillment_state ? <StatusBadge value={o.fulfillment_state} /> : "—"}</td>
              <td><StatusBadge value={o.mapping_status} /></td><td>{new Date(o.last_synced_at).toLocaleString()}</td></tr>)}
          </tbody></table></div>
      )}
    </>}

    {tab === "Inventory" && !needsStoreChoice && <>
      <div className="records-toolbar card"><div><strong>Inventory comparison</strong><div className="muted" style={{ fontSize: 12 }}>
        Lal Motors PostgreSQL remains the source of truth. Shopify quantities are a remote snapshot and are never written back into Lal Motors stock.
      </div></div>
        {provider === "shopify" && canSync && isConnected && <button className="btn btn-secondary" disabled={Boolean(syncing)} onClick={() => syncNow("inventory")}><RefreshCw size={14} />{syncing === "inventory" ? "Syncing..." : "Sync Inventory"}</button>}
      </div>
      {provider === "shopify" && isConnected && <>
        <div className="table-wrap"><table><thead><tr><th>Product</th><th>Lal Motors Available</th><th>Shopify Available</th><th>Status</th></tr></thead>
          <tbody>{comparisonQuery.isLoading ? <LoadingRow columns={4} /> : comparisonRows.length === 0 ? <EmptyRow columns={4} text="Sync products/inventory to compare quantities. Unlinked Shopify products are not imported as catalog items." /> : comparisonRows.map((row, i) =>
            <tr key={`${row.external_listing_id || row.product}-${i}`}><td><strong>{row.product}</strong><div className="muted" style={{ fontSize: 11 }}>{row.sku || "—"}</div></td>
              <td>{row.lal_motors_available ?? "—"}</td><td>{row.shopify_available ?? "—"}</td>
              <td><StatusBadge value={row.status} /></td></tr>)}
          </tbody></table></div>
        {liveInventory.length > 0 && <div className="muted" style={{ fontSize: 12, margin: "10px 0 16px" }}>
          Shopify locations: {(liveLocations.map(l => l.name || l.id).join(", ") || "none")}. Raw levels: {liveInventory.length}.
        </div>}
      </>}
      {provider !== "shopify" && <div className="table-wrap"><table><thead><tr><th>Item</th><th>{title} SKU</th><th>Link Status</th></tr></thead>
        <tbody>{listings.length === 0 ? <EmptyRow columns={3} text="No linked items yet." /> : listings.map(l =>
          <tr key={l.id}><td><strong>{l.item_name}</strong></td><td>{l.item_code}</td><td><StatusBadge value={l.inventory_link_status || "unlinked"} /></td></tr>)}
        </tbody></table></div>}
    </>}

    {tab === "Customers" && !needsStoreChoice && (provider === "shopify" && isConnected ? (
      <>
        <div className="records-toolbar card"><div><strong>Shopify Customers</strong>
          <div className="muted" style={{ fontSize: 12 }}>From {storeName}. Matching uses exact email only — similar names are not merged.</div></div>
          {canSync && <button className="btn btn-secondary" disabled={Boolean(syncing)} onClick={() => syncNow("customers")}><RefreshCw size={14} />{syncing === "customers" ? "Syncing..." : "Sync Customers"}</button>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th>Linkage</th><th>Shopify ID</th></tr></thead>
          <tbody>{liveCustomersQuery.isLoading ? <LoadingRow columns={7} /> : liveCustomers.length === 0 ? <EmptyRow columns={7} text="No Shopify customers yet." /> : liveCustomers.map(c =>
            <tr key={c.external_customer_id}><td><strong>{c.name || "—"}</strong></td><td>{c.email || "—"}</td>
              <td>{c.phone || "—"}</td><td>{c.order_count ?? "—"}</td>
              <td>{c.total_spent != null ? money(c.total_spent, "USD") : "—"}</td>
              <td><StatusBadge value={c.match_state || "Unlinked"} /></td>
              <td>{c.external_customer_id}</td></tr>)}
          </tbody></table></div>
      </>
    ) : (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        {isConnected ? "Customer sync runs alongside order sync." : `Connect ${title} to sync customers.`}
      </div>
    ))}

    {tab === "Drafts" && <AIDraftsSection provider={provider} title={title} isConnected={isConnected} />}

    {tab === "Sync" && <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <strong>Connection</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 12 }}>
          {selectedAccount ? `Current store: ${accountLabel(selectedAccount)}${selectedAccount.shop_domain ? ` (${selectedAccount.shop_domain})` : ""}. ` : accounts.length > 1 ? "Select a store above. " : "No account record yet. "}
          {provider === "shopify"
            ? "Shopify authenticates with SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET. Tokens are minted on the server and never shown here."
            : "Real credentials are added via environment variables (EBAY_ACCESS_TOKEN) — never entered here."}
          {provider === "shopify" && selectedAccount ? ` Webhooks: ${webhooksLabel(selectedAccount)}.` : ""}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {provider !== "shopify" && canManage && accounts.length === 0 && <button className="btn btn-primary" onClick={() => setConnectModalOpen(true)}><Plug size={14} />Connect / Configure</button>}
          {canManage && accounts.length > 0 && <button className="btn btn-secondary" disabled={testing || needsStoreChoice} onClick={() => testConnection()}><CheckCircle2 size={14} />{testing ? "Testing..." : "Test Connection"}</button>}
        </div>
      </div>
      {provider === "shopify" && canConnectStore && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <strong>Shopify stores</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 12 }}>
          Disable keeps historical orders and listings. Reconnect asks the shop owner to approve the Lal Motors app again. Access tokens are never shown here.
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Store</th><th>Domain</th><th>Status</th><th>Webhooks</th><th>Last successful sync</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {storesQuery.isLoading ? <LoadingRow columns={7} /> : managedStores.length === 0 ? <EmptyRow columns={7} text="No Shopify stores yet. Use Connect Store." /> : managedStores.map(store => (
                <tr key={store.id}>
                  <td><strong>{accountLabel(store)}</strong></td>
                  <td>{store.shop_domain || "—"}</td>
                  <td><StatusBadge value={store.connection_status || store.status} /></td>
                  <td title={store.webhooks_note || ""}><StatusBadge value={webhooksLabel(store)} /></td>
                  <td>{fmtWhen(store.last_sync_at)}</td>
                  <td>{store.status === "active" ? "Active" : "Inactive"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12, marginRight: 4 }} disabled={storeAction === store.id || store.status !== "active"} onClick={() => testConnection(store.id)}>Test</button>
                    <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12, marginRight: 4 }} disabled={Boolean(storeAction)} onClick={() => renameStore(store)}>Rename</button>
                    {store.status === "active" && <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12, marginRight: 4 }} disabled={Boolean(storeAction)} onClick={() => disableStore(store)}>Disable</button>}
                    {store.status !== "active" && (
                      <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12, marginRight: 4 }} disabled={Boolean(storeAction)} onClick={() => verifyShopifyConnect(store.id)}>Verify Connection</button>
                    )}
                    {store.status !== "active" && store.connection_status !== "authorization_required" && store.connection_status !== "connecting" && (
                      <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12, marginRight: 4 }} disabled={Boolean(storeAction)} onClick={() => enableStore(store)}>Enable</button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12 }} disabled={Boolean(storeAction)} onClick={() => reconnectStore(store)}>Reconnect</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
      {provider === "shopify" && <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <strong>Sync {storeName}</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 12 }}>
          Last successful: {fmtWhen(syncRunsQuery.data?.last_successful_sync?.completed_at || overview?.last_successful_sync?.completed_at)}.
          {" "}Last failed: {syncRunsQuery.data?.last_failed_sync ? fmtWhen(syncRunsQuery.data.last_failed_sync.completed_at || syncRunsQuery.data.last_failed_sync.started_at) : "None"}.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canSync && ["products", "orders", "customers", "inventory", "all"].map(kind => (
            <button key={kind} className={`btn ${kind === "all" ? "btn-primary" : "btn-secondary"}`} disabled={Boolean(syncing) || needsStoreChoice} onClick={() => syncNow(kind)}>
              <RefreshCw size={14} />{syncing === kind ? "Syncing..." : `Sync ${kind === "all" ? "All" : labelize(kind)}`}
            </button>
          ))}
        </div>
      </div>}
      {provider !== "shopify" && canSync && accounts.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <button className="btn btn-secondary" disabled={Boolean(syncing) || needsStoreChoice} onClick={() => syncNow("orders")}><RefreshCw size={14} />{syncing ? "Syncing..." : "Sync Now"}</button>
        </div>
      )}
      {provider === "shopify" && <div className="table-wrap"><table><thead><tr><th>Type</th><th>Status</th><th>Started</th><th>Completed</th><th>Processed</th><th>Error</th></tr></thead>
        <tbody>{syncRunsQuery.isLoading ? <LoadingRow columns={6} /> : (syncRunsQuery.data?.runs || []).length === 0 ? <EmptyRow columns={6} text="No sync runs yet." /> : (syncRunsQuery.data?.runs || []).map(run =>
          <tr key={run.id}><td>{labelize(run.sync_type)}</td><td><StatusBadge value={run.status} /></td>
            <td>{fmtWhen(run.started_at)}</td><td>{fmtWhen(run.completed_at)}</td>
            <td>{run.items_processed ?? 0}{run.items_failed ? ` / ${run.items_failed} failed` : ""}</td>
            <td>{run.error_message || "—"}</td></tr>)}
        </tbody></table></div>}
      <div className="card" style={{ padding: 13, marginTop: 16 }}>
        <strong>Publishing</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {isConnected ? "Complete required listing fields in Review & Complete Listing, then create an unpublished Shopify product for the selected store." : `Connect ${title} to publish — complete the listing review in the Drafts tab either way.`}
        </div>
      </div>
    </>}

    {connectModalOpen && <Modal title={provider === "shopify" ? "Connect Shopify Store" : `Connect ${title}`} eyebrow="Sync / Connection" onClose={() => setConnectModalOpen(false)}>
      <div className="form-grid">
        <Field label={provider === "shopify" ? "Store name" : "Account Name"} value={connectForm.account_name} onChange={v => setConnectForm({ ...connectForm, account_name: v })} placeholder={provider === "shopify" ? "Lal Motors UK" : `${title} Account`} />
        <Field label={provider === "shopify" ? "Shop domain" : "Marketplace ID"} value={connectForm.shop_domain_or_marketplace}
          onChange={v => setConnectForm({ ...connectForm, shop_domain_or_marketplace: v })}
          placeholder={provider === "shopify" ? "example-store.myshopify.com" : "EBAY_US"} />
      </div>
      <div className="card" style={{ padding: 10, marginTop: 12, fontSize: 12 }}>
        {provider === "shopify"
          ? "Step 1: In the Shopify Dev Dashboard, install or Test on store for Lal Motors Integration on this shop. Step 2: Return here and click Verify Connection. The store is marked Connected only after Shopify confirms client-credentials access. Do not paste access tokens or the client secret."
          : "This creates the account record only. Real credentials are added via environment variables — never typed into this form."}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={() => setConnectModalOpen(false)}>Cancel</button>
        {provider === "shopify" && pendingConnectId && (
          <button className="btn btn-secondary" disabled={savingAccount} onClick={() => verifyShopifyConnect()}>
            {savingAccount ? "Verifying..." : "Verify Connection"}
          </button>
        )}
        {provider === "shopify" ? (
          <button className="btn btn-primary" disabled={savingAccount} onClick={startShopifyConnect}>
            {savingAccount ? "Connecting..." : "Connect / Verify"}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={savingAccount} onClick={createAccount}>Save Account</button>
        )}
      </div>
    </Modal>}

    {linkProduct && <Modal title="Link Shopify product" eyebrow="Manual catalog link" onClose={() => setLinkProduct(null)}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Link <strong>{linkProduct.title}</strong> to an existing Lal Motors catalog item. This does not create a new catalog item.
      </div>
      <Field label="Search catalog" value={catalogQ} onChange={setCatalogQ} placeholder="Name, SKU, or item code" />
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table><thead><tr><th>Item</th><th>Code</th><th></th></tr></thead>
          <tbody>
            {catalogQ.trim().length < 2 ? <EmptyRow columns={3} text="Type at least 2 characters." /> :
              catalogQuery.isLoading ? <LoadingRow columns={3} /> :
                (catalogQuery.data || []).length === 0 ? <EmptyRow columns={3} text="No matching catalog items." /> :
                  (catalogQuery.data || []).map(item => (
                    <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.item_code}{item.sku ? ` / ${item.sku}` : ""}</td>
                      <td><button className="btn btn-primary" onClick={() => linkToCatalog(item)}>Link</button></td></tr>
                  ))}
          </tbody>
        </table>
      </div>
    </Modal>}
    <GlobalSpinStyle />
  </>;
}
