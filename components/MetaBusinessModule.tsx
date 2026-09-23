"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plug, Plus, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AIDraftsSection } from "@/components/AIDraftsSection";
import { ProviderAccountSelector } from "@/components/ProviderAccountSelector";
import {
  EmptyRow, GlobalSpinStyle, LoadingRow, Message,
  Modal, StatusBadge,
} from "@/components/RealUi";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type Account = {
  id: string; provider: string; account_name: string; display_name?: string | null;
  facebook_page_id?: string | null; facebook_page_name?: string | null;
  instagram_user_id?: string | null; instagram_username?: string | null;
  has_instagram?: boolean; has_facebook?: boolean;
  destination_kind?: string | null; destination_type?: string | null; auth_path?: string | null;
  status: string; connection_status?: string; last_error?: string | null;
  last_sync_at?: string | null; token_expires_at?: string | null;
};
type Discovered = {
  facebook_page_id: string; facebook_page_name: string;
  instagram_user_id?: string | null; instagram_username?: string | null; has_instagram: boolean;
};
type Overview = {
  connection_status: string;
  facebook_page_name?: string | null;
  facebook_page_id?: string | null;
  instagram_username?: string | null;
  has_instagram?: boolean;
  destination_kind?: string | null;
  ai_draft_count: number;
  recent_posts: { title?: string; listing_status?: string; destination_key?: string; published_at?: string; external_listing_id?: string }[];
  live_posts?: { id?: string; message?: string; platform?: string; created_time?: string }[];
  live_posts_error?: string | null;
  last_successful_publish?: { external_listing_id?: string; published_at?: string } | null;
  last_error?: string | null;
  last_sync_at?: string | null;
};
type HistoryRow = {
  id: string; caption_preview?: string; platform: string; facebook_page_name?: string | null;
  instagram_username?: string | null; status?: string; published_at?: string;
  external_listing_id?: string | null; listing_url?: string | null;
};
type ConnectionResponse = {
  provider: string; status: string; account: Account | null; accounts?: Account[];
};
type DestinationsResponse = {
  destinations: Account[];
  instagram_configured?: boolean;
};

const TABS = ["Overview", "Drafts", "Publish History", "Destinations"];
const NO_PAGE_COPY = "No Facebook Page available for publishing. Create or get access to a Facebook Page, then reconnect Meta.";

function fmtWhen(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isInstagramDestination(account: Account) {
  return account.destination_type === "instagram" || account.auth_path === "instagram_login" || (!account.facebook_page_id && Boolean(account.has_instagram || account.instagram_user_id));
}

function destinationLabel(account: Account) {
  if (isInstagramDestination(account)) {
    return account.instagram_username ? `Instagram @${account.instagram_username}` : (account.display_name || account.account_name || "Instagram");
  }
  const page = account.facebook_page_name || account.display_name || account.account_name || "Facebook Page";
  if (account.instagram_username) return `${page} · Instagram @${account.instagram_username}`;
  return `${page} · Facebook Page`;
}

function PlatformBadge({ kind }: { kind: "facebook" | "instagram" }) {
  return <span className="badge">{kind === "instagram" ? "Instagram" : "Facebook"}</span>;
}

export function MetaBusinessModule() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(TABS[0]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testing, setTesting] = useState(false);
  const [storeAction, setStoreAction] = useState("");
  const [selectOpen, setSelectOpen] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [picked, setPicked] = useState<Record<string, { include_instagram: boolean }>>({});

  const { data: user } = useQuery({ queryKey: queryKeys.auth.me(), queryFn: getCurrentUser, staleTime: 5 * 60 * 1000 });
  const perms = useMemo(() => new Set(user?.permissions || []), [user]);
  const canConnect = perms.has("settings.manage");
  const canPublish = perms.has("meta.publish");

  const connectionQuery = useQuery({
    queryKey: queryKeys.meta.connection(),
    queryFn: () => apiFetch<ConnectionResponse>("/integrations/connection?provider=meta"),
    staleTime: 30 * 1000,
  });
  const accounts = (connectionQuery.data?.accounts ?? []).filter(a => a.status === "active" || a.connection_status === "connected");
  const destinationsQuery = useQuery({
    queryKey: queryKeys.meta.destinations(),
    queryFn: () => apiFetch<DestinationsResponse>("/integrations/meta/destinations"),
    enabled: Boolean(canConnect || perms.has("meta.view") || perms.has("meta.drafts.view")),
    staleTime: 15 * 1000,
  });
  const managed = destinationsQuery.data?.destinations ?? [];

  const effectiveAccountId = selectedAccountId || (accounts.length === 1 ? String(accounts[0].id) : "");
  const selectedAccount = accounts.find(a => String(a.id) === effectiveAccountId) ?? null;
  const needsChoice = accounts.length > 1 && !effectiveAccountId;
  const isConnected = Boolean(selectedAccount && (selectedAccount.status === "active" || selectedAccount.connection_status === "connected"));

  useEffect(() => {
    const status = searchParams.get("meta_status");
    const err = searchParams.get("meta_error");
    const accountId = searchParams.get("account_id");
    if (status === "select" && accountId) {
      setPendingId(accountId);
      setSelectOpen(true);
      setSuccess("Facebook authorized. Choose the Facebook Page (and linked Instagram, if available) to connect.");
    } else if (status === "connected" && accountId) {
      setSelectedAccountId(accountId);
      setSuccess("Meta destination connected.");
      invalidate(queryClient, ["meta", "contentStudio"]);
    } else if (status === "error") {
      setError(err || "Meta authorization did not complete.");
    }
  }, [searchParams, queryClient]);

  useEffect(() => {
    if (accounts.length === 1) {
      const only = String(accounts[0].id);
      if (selectedAccountId !== only) setSelectedAccountId(only);
    }
  }, [accounts, selectedAccountId]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.meta.overview({ integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<Overview>(`/integrations/meta/overview?integration_account_id=${effectiveAccountId}`),
    enabled: Boolean(effectiveAccountId),
    staleTime: 30 * 1000,
  });
  const historyQuery = useQuery({
    queryKey: queryKeys.meta.history({ integration_account_id: effectiveAccountId || "" }),
    queryFn: () => apiFetch<{ history: HistoryRow[] }>(`/integrations/meta/history?integration_account_id=${effectiveAccountId}`),
    enabled: Boolean(effectiveAccountId) && tab === "Publish History",
  });
  const discoveredQuery = useQuery({
    queryKey: ["meta", "discovered", pendingId],
    queryFn: () => apiFetch<{ destinations: Discovered[]; auto_select: boolean; instagram_unavailable_note?: string | null; facebook_unavailable_note?: string | null; no_facebook_pages?: boolean }>(
      `/integrations/meta/connect/destinations?account_id=${pendingId}`,
    ),
    enabled: selectOpen && Boolean(pendingId),
  });

  useEffect(() => {
    const pages = discoveredQuery.data?.destinations || [];
    if (!pages.length) return;
    setPicked(prev => {
      if (Object.keys(prev).length) return prev;
      const next: Record<string, { include_instagram: boolean }> = {};
      if (pages.length === 1) {
        next[pages[0].facebook_page_id] = { include_instagram: Boolean(pages[0].has_instagram) };
      }
      return next;
    });
  }, [discoveredQuery.data]);

  async function startConnect(reconnectId?: string, flow: "facebook" | "instagram" = "facebook") {
    setError(""); setSuccess("");
    try {
      const res = await apiFetch<{ authorization_url: string }>("/integrations/meta/connect/start", {
        method: "POST",
        body: JSON.stringify({ reconnect_account_id: reconnectId || null, flow }),
      });
      if (res.authorization_url) window.location.href = res.authorization_url;
    } catch (e: any) {
      setError(e?.message || (flow === "instagram" ? "Unable to start Instagram authorization." : "Unable to start Facebook authorization."));
    }
  }

  async function completeSelection() {
    const destinations = Object.entries(picked).map(([facebook_page_id, value]) => ({
      facebook_page_id, include_instagram: value.include_instagram,
    }));
    if (!destinations.length) { setError("Select at least one Facebook Page."); return; }
    setStoreAction("complete");
    try {
      const res = await apiFetch<{ accounts: Account[] }>("/integrations/meta/connect/complete", {
        method: "POST",
        body: JSON.stringify({ account_id: pendingId, destinations }),
      });
      const first = res.accounts?.[0];
      if (first) setSelectedAccountId(String(first.id));
      setSelectOpen(false);
      setSuccess("Meta destination connected.");
      invalidate(queryClient, ["meta"]);
    } catch (e: any) {
      setError(e?.message || "Unable to save Meta destinations.");
    } finally { setStoreAction(""); }
  }

  async function testConnection(accountId = effectiveAccountId) {
    if (!accountId) return;
    setTesting(true); setError("");
    try {
      const res = await apiFetch<{ status: string }>(`/integrations/connection/test?provider=meta&integration_account_id=${accountId}`, { method: "POST" });
      setSuccess(res.status === "connected" ? "Meta connection is active." : `Meta status: ${res.status}`);
      invalidate(queryClient, ["meta"]);
    } catch (e: any) { setError(e?.message || "Connection test failed."); }
    finally { setTesting(false); }
  }

  async function runAction(path: string, label: string) {
    setStoreAction(label);
    try {
      await apiFetch(path, { method: "POST", body: "{}" });
      setSuccess(`${label} complete.`);
      invalidate(queryClient, ["meta"]);
    } catch (e: any) { setError(e?.message || `Unable to ${label.toLowerCase()}.`); }
    finally { setStoreAction(""); }
  }

  const overview = overviewQuery.data;
  const history = historyQuery.data?.history ?? [];
  const discovered = discoveredQuery.data?.destinations ?? [];
  const facebookCount = managed.filter(a => !isInstagramDestination(a) && a.status === "active").length;
  const instagramCount = managed.filter(a => (isInstagramDestination(a) || a.has_instagram) && a.status === "active").length;
  const publishedCount = (overview?.recent_posts || []).filter(p => (p.listing_status || "") === "published").length;

  return (
    <div>
      <GlobalSpinStyle />
      <div className="page-header">
        <div>
          <div className="eyebrow">Channel</div>
          <h1 className="page-title">Meta</h1>
          <div className="page-copy">Facebook Pages and Instagram Professional accounts. Publishing uses saved AI drafts only.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <StatusBadge value={isConnected ? "connected" : "not_connected"} />
            <span className="muted" style={{ fontSize: 12 }}>
              {isConnected ? `Connected · ${selectedAccount ? destinationLabel(selectedAccount) : "Meta"}` : "Connection status"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ProviderAccountSelector
            accounts={accounts.map(a => ({ ...a, display_name: destinationLabel(a), account_name: a.account_name }))}
            value={effectiveAccountId}
            onChange={setSelectedAccountId}
            requireSelection={accounts.length > 1}
            label="Destination"
          />
          {canConnect && <button className="btn btn-primary" onClick={() => startConnect(undefined, "facebook")}><Plus size={15} /> Connect Facebook Page</button>}
          {canConnect && <button className="btn btn-secondary" onClick={() => startConnect(undefined, "instagram")}><Plus size={15} /> Connect Instagram</button>}
          <button className="btn btn-secondary" onClick={() => { connectionQuery.refetch(); destinationsQuery.refetch(); if (effectiveAccountId) overviewQuery.refetch(); }}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Message error={error || (overviewQuery.error instanceof Error ? overviewQuery.error.message : "")} success={success} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map(name => (
          <button key={name} className={`btn ${tab === name ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          {needsChoice && <div className="card" style={{ padding: 14, marginBottom: 12 }}>Select a destination to view its overview.</div>}
          {!accounts.length && <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <Plug size={16} /> Meta is not connected. Use Connect Facebook Page to authorize Pages, or Connect Instagram for a standalone Professional account.
          </div>}
          <div className="metric-grid">
            <div className="metric-card"><div className="metric-top"><span>Facebook Pages</span></div>
              <div className="metric-value">{facebookCount}</div>
              <div className="muted" style={{ fontSize: 12 }}>{selectedAccount && !isInstagramDestination(selectedAccount) ? (overview?.facebook_page_name || selectedAccount.facebook_page_name || "Selected Page") : "Connected Pages"}</div></div>
            <div className="metric-card"><div className="metric-top"><span>Instagram accounts</span></div>
              <div className="metric-value">{instagramCount}</div>
              <div className="muted" style={{ fontSize: 12 }}>{overview?.instagram_username || selectedAccount?.instagram_username ? `@${overview?.instagram_username || selectedAccount?.instagram_username}` : "Standalone or Page-linked"}</div></div>
            <div className="metric-card"><div className="metric-top"><span>AI Meta drafts</span></div>
              <div className="metric-value">{overview?.ai_draft_count ?? "…"}</div></div>
            <div className="metric-card"><div className="metric-top"><span>Published posts</span></div>
              <div className="metric-value">{overviewQuery.isLoading ? "…" : publishedCount}</div></div>
            <div className="metric-card"><div className="metric-top"><span>Last publish / sync</span></div>
              <div className="metric-value" style={{ fontSize: 15 }}>{fmtWhen(overview?.last_successful_publish?.published_at || overview?.last_sync_at || selectedAccount?.last_sync_at)}</div></div>
            {(overview?.last_error || selectedAccount?.last_error) && <div className="metric-card" style={{ gridColumn: "1 / -1" }}><div className="metric-top"><span>Attention required</span></div>
              <div style={{ color: "var(--danger)", fontSize: 13 }}><AlertTriangle size={14} /> {overview?.last_error || selectedAccount?.last_error}</div></div>}
          </div>
          {selectedAccount && <>
            {(canPublish || canConnect) && <div style={{ marginBottom: 14 }}><button className="btn btn-secondary" disabled={testing} onClick={() => testConnection()}><RefreshCw size={14} />{testing ? "Testing..." : "Test Connection"}</button></div>}
            <div className="records-toolbar card"><div><strong>Recent published posts</strong>
              <div className="muted" style={{ fontSize: 12 }}>From Lal Motors publish history. Live Graph posts appear only when the destination token allows reading them.</div></div></div>
            <div className="table-wrap"><table><thead><tr><th>Caption</th><th>Destination</th><th>Status</th><th>Published</th><th>External ID</th></tr></thead>
              <tbody>{overviewQuery.isLoading ? <LoadingRow columns={5} /> : (overview?.recent_posts || []).length === 0 ? <EmptyRow columns={5} text="No published Meta posts yet." /> : overview!.recent_posts.map((post, i) =>
                <tr key={post.external_listing_id || i}><td>{post.title || "—"}</td>
                  <td><PlatformBadge kind={String(post.destination_key || "").startsWith("instagram:") ? "instagram" : "facebook"} /></td>
                  <td><StatusBadge value={post.listing_status || "published"} /></td>
                  <td>{fmtWhen(post.published_at)}</td><td>{post.external_listing_id || "—"}</td></tr>)}
              </tbody></table></div>
            {overview?.live_posts_error && <div className="muted" style={{ marginTop: 8 }}>Live Graph posts unavailable: {overview.live_posts_error}</div>}
          </>}
        </>
      )}

      {tab === "Drafts" && <AIDraftsSection provider="meta" title="Meta" isConnected={isConnected} />}

      {tab === "Publish History" && (
        <div className="table-wrap"><table><thead><tr><th>Preview</th><th>Platform</th><th>Target</th><th>Status</th><th>Published</th><th>External ID</th></tr></thead>
          <tbody>{historyQuery.isLoading ? <LoadingRow columns={6} /> : history.length === 0 ? <EmptyRow columns={6} text="No Meta publish history yet." /> : history.map(row =>
            <tr key={row.id}><td>{row.caption_preview || "—"}</td>
              <td><PlatformBadge kind={row.platform === "instagram" ? "instagram" : "facebook"} /></td>
              <td>{row.platform === "instagram" ? (row.instagram_username ? `@${row.instagram_username}` : "Instagram") : (row.facebook_page_name || "Facebook Page")}</td>
              <td><StatusBadge value={row.status || "published"} /></td>
              <td>{fmtWhen(row.published_at)}</td>
              <td>{row.listing_url ? <a href={row.listing_url} target="_blank" rel="noreferrer">{row.external_listing_id}</a> : (row.external_listing_id || "—")}</td>
            </tr>)}
          </tbody></table></div>
      )}

      {tab === "Destinations" && (
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Platform</th><th>Username / Page</th><th>Connection</th><th>Instagram linked</th><th>Last activity</th><th>Actions</th></tr></thead>
          <tbody>{destinationsQuery.isLoading ? <LoadingRow columns={7} /> : managed.length === 0 ? <EmptyRow columns={7} text="No Meta destinations yet. Use Connect Facebook Page or Connect Instagram." /> : managed.map(dest => {
            const igOnly = isInstagramDestination(dest);
            const attention = dest.status !== "active" || Boolean(dest.last_error);
            return (
              <tr key={dest.id}>
                <td><strong>{dest.display_name || dest.account_name}</strong></td>
                <td><PlatformBadge kind={igOnly ? "instagram" : "facebook"} /></td>
                <td>{igOnly ? (dest.instagram_username ? `@${dest.instagram_username}` : dest.instagram_user_id || "—") : (dest.facebook_page_name || dest.facebook_page_id || "—")}</td>
                <td>{attention ? <span className="badge">Attention required</span> : <StatusBadge value={dest.connection_status || dest.status} />}</td>
                <td>{dest.has_instagram || dest.instagram_username ? (dest.instagram_username ? `@${dest.instagram_username}` : "Linked") : (igOnly ? "Standalone" : "Not linked")}</td>
                <td>{fmtWhen(dest.last_sync_at || dest.token_expires_at)}</td>
                <td>{canConnect && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px" }} disabled={testing || Boolean(storeAction)} onClick={() => testConnection(dest.id)}>Test</button>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px" }} disabled={Boolean(storeAction)} onClick={async () => {
                    const name = prompt("Rename destination", dest.display_name || dest.account_name || "");
                    if (!name) return;
                    setStoreAction("Rename");
                    try {
                      await apiFetch(`/integrations/meta/destinations/${dest.id}/rename`, { method: "POST", body: JSON.stringify({ display_name: name }) });
                      setSuccess("Renamed.");
                      invalidate(queryClient, ["meta"]);
                    } catch (e: any) { setError(e?.message || "Unable to rename."); }
                    finally { setStoreAction(""); }
                  }}>Rename</button>
                  {dest.status === "active"
                    ? <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px" }} disabled={Boolean(storeAction)} onClick={() => runAction(`/integrations/meta/destinations/${dest.id}/disable`, "Disable")}>Disable</button>
                    : <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px" }} disabled={Boolean(storeAction)} onClick={() => runAction(`/integrations/meta/destinations/${dest.id}/enable`, "Enable")}>Enable</button>}
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px" }} disabled={Boolean(storeAction)} onClick={() => startConnect(dest.id, igOnly ? "instagram" : "facebook")}>Reconnect</button>
                </div>}</td>
              </tr>
            );
          })}</tbody></table></div>
      )}

      {selectOpen && <Modal title="Select Facebook Pages" eyebrow="Connect Facebook Page" onClose={() => setSelectOpen(false)} width={720}>
        <div className="muted" style={{ marginBottom: 12 }}>Lal Motors publishes to Facebook Pages, not personal Facebook profiles. Instagram is optional when a Professional account is linked to the Page.</div>
        {(discoveredQuery.data?.facebook_unavailable_note || discoveredQuery.data?.no_facebook_pages) && (
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>{discoveredQuery.data?.facebook_unavailable_note || NO_PAGE_COPY}</div>
        )}
        {discoveredQuery.data?.instagram_unavailable_note && <div className="card" style={{ padding: 10, marginBottom: 12 }}>{discoveredQuery.data.instagram_unavailable_note}</div>}
        {discoveredQuery.isLoading ? <div className="muted">Loading Pages…</div> : discovered.length === 0 ? <div>{NO_PAGE_COPY}</div> : discovered.map(page => {
          const selected = Boolean(picked[page.facebook_page_id]);
          return (
            <div key={page.facebook_page_id} className="card" style={{ padding: 12, marginBottom: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={selected} onChange={e => {
                  setPicked(curr => {
                    const next = { ...curr };
                    if (e.target.checked) next[page.facebook_page_id] = { include_instagram: Boolean(page.has_instagram) };
                    else delete next[page.facebook_page_id];
                    return next;
                  });
                }} />
                <strong>{page.facebook_page_name}</strong>
                <span className="muted">{page.has_instagram ? `Instagram @${page.instagram_username}` : "Facebook Page only"}</span>
              </label>
              {selected && page.has_instagram && (
                <label style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 24 }}>
                  <input type="checkbox" checked={picked[page.facebook_page_id]?.include_instagram} onChange={e => {
                    setPicked(curr => ({ ...curr, [page.facebook_page_id]: { include_instagram: e.target.checked } }));
                  }} />
                  Also connect Instagram @{page.instagram_username}
                </label>
              )}
              {selected && !page.has_instagram && <div className="muted" style={{ marginLeft: 24, marginTop: 6 }}>No Instagram Professional account is linked to this Page. Use Connect Instagram if this client has a standalone Professional account.</div>}
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setSelectOpen(false)}>Cancel</button>
          {discovered.length > 0 && <button className="btn btn-primary" disabled={storeAction === "complete"} onClick={completeSelection}>
            {storeAction === "complete" ? "Saving..." : "Connect selected"}
          </button>}
        </div>
      </Modal>}
    </div>
  );
}
