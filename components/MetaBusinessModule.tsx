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
  has_instagram?: boolean; destination_kind?: string | null;
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
  ai_draft_count: number;
  recent_posts: { title?: string; listing_status?: string; destination_key?: string; published_at?: string; external_listing_id?: string }[];
  live_posts?: { id?: string; message?: string; platform?: string; created_time?: string }[];
  live_posts_error?: string | null;
  last_successful_publish?: { external_listing_id?: string; published_at?: string } | null;
  last_error?: string | null;
};
type HistoryRow = {
  id: string; caption_preview?: string; platform: string; facebook_page_name?: string | null;
  instagram_username?: string | null; status?: string; published_at?: string;
  external_listing_id?: string | null; listing_url?: string | null;
};
type ConnectionResponse = {
  provider: string; status: string; account: Account | null; accounts?: Account[];
};

const TABS = ["Overview", "Drafts", "Publish History", "Destinations"];

function fmtWhen(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function destinationLabel(account: Account) {
  const page = account.facebook_page_name || account.display_name || account.account_name || "Facebook Page";
  if (account.instagram_username) return `${page} · Instagram @${account.instagram_username}`;
  return `${page} · Facebook only`;
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
    queryFn: () => apiFetch<{ destinations: Account[] }>("/integrations/meta/destinations"),
    enabled: canConnect,
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
      setSuccess("Meta authorized. Choose the Facebook Page (and Instagram, if linked) to connect.");
    } else if (status === "connected" && accountId) {
      setSelectedAccountId(accountId);
      setSuccess("Meta connected.");
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
    queryFn: () => apiFetch<{ destinations: Discovered[]; auto_select: boolean; instagram_unavailable_note?: string | null }>(
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

  async function startConnect(reconnectId?: string) {
    setError(""); setSuccess("");
    try {
      const res = await apiFetch<{ authorization_url: string }>("/integrations/meta/connect/start", {
        method: "POST",
        body: JSON.stringify({ reconnect_account_id: reconnectId || null }),
      });
      if (res.authorization_url) window.location.href = res.authorization_url;
    } catch (e: any) {
      setError(e?.message || "Unable to start Meta authorization.");
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

  async function testConnection() {
    if (!effectiveAccountId) return;
    setTesting(true); setError("");
    try {
      const res = await apiFetch<{ status: string }>(`/integrations/connection/test?provider=meta&integration_account_id=${effectiveAccountId}`, { method: "POST" });
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

  return (
    <div>
      <GlobalSpinStyle />
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Meta</h1>
          <div className="muted" style={{ marginTop: 4 }}>Facebook Pages and Instagram Professional accounts. Publishing uses saved AI drafts only.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ProviderAccountSelector
            accounts={accounts.map(a => ({ ...a, display_name: destinationLabel(a), account_name: a.account_name }))}
            value={effectiveAccountId}
            onChange={setSelectedAccountId}
            requireSelection={accounts.length > 1}
            label="Facebook / Instagram destination"
          />
          {canConnect && <button className="btn btn-primary" onClick={() => startConnect()}><Plus size={15} /> Connect Meta</button>}
        </div>
      </div>

      <Message error={error || (overviewQuery.error instanceof Error ? overviewQuery.error.message : "")} success={success} />

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map(name => (
          <button key={name} className={tab === name ? "tab active" : "tab"} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <>
          {needsChoice && <div className="card" style={{ padding: 14, marginBottom: 12 }}>Select a Facebook Page / Instagram destination to view its overview.</div>}
          {!accounts.length && <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <Plug size={16} /> Meta is not connected. Click Connect Meta, sign in with Facebook, then choose the Page (and Instagram if linked).
          </div>}
          {selectedAccount && <>
            <div className="card" style={{ padding: 16, marginBottom: 12, display: "grid", gap: 8 }}>
              <div><strong>Connection:</strong> <StatusBadge value={overview?.connection_status || selectedAccount.connection_status || selectedAccount.status} /></div>
              <div><strong>Facebook Page:</strong> {overview?.facebook_page_name || selectedAccount.facebook_page_name || "—"}</div>
              <div><strong>Instagram:</strong> {overview?.has_instagram || selectedAccount.has_instagram
                ? `@${overview?.instagram_username || selectedAccount.instagram_username}`
                : "Not linked to this Page. Facebook publishing is still available."}</div>
              <div><strong>AI Meta drafts:</strong> {overview?.ai_draft_count ?? "—"}</div>
              <div><strong>Last successful publish:</strong> {overview?.last_successful_publish?.published_at ? fmtWhen(overview.last_successful_publish.published_at) : "Never"}</div>
              {overview?.last_error && <div className="muted"><AlertTriangle size={14} /> {overview.last_error}</div>}
              {(canPublish || canConnect) && <button className="btn btn-secondary" disabled={testing} onClick={testConnection}><RefreshCw size={14} />{testing ? "Testing..." : "Test Connection"}</button>}
            </div>
            <div className="records-toolbar card"><div><strong>Recent published posts</strong>
              <div className="muted" style={{ fontSize: 12 }}>From Lal Motors publish history. Live Graph posts appear only when the Page token allows reading them — engagement metrics are not invented.</div></div></div>
            <div className="table-wrap"><table><thead><tr><th>Caption</th><th>Destination</th><th>Status</th><th>Published</th><th>External ID</th></tr></thead>
              <tbody>{overviewQuery.isLoading ? <LoadingRow columns={5} /> : (overview?.recent_posts || []).length === 0 ? <EmptyRow columns={5} text="No published Meta posts yet." /> : overview!.recent_posts.map((post, i) =>
                <tr key={post.external_listing_id || i}><td>{post.title || "—"}</td>
                  <td>{String(post.destination_key || "").startsWith("instagram:") ? "Instagram" : "Facebook"}</td>
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
              <td>{row.platform === "instagram" ? "Instagram" : "Facebook"}</td>
              <td>{row.platform === "instagram" ? (row.instagram_username ? `@${row.instagram_username}` : "Instagram") : (row.facebook_page_name || "Facebook Page")}</td>
              <td><StatusBadge value={row.status || "published"} /></td>
              <td>{fmtWhen(row.published_at)}</td>
              <td>{row.listing_url ? <a href={row.listing_url} target="_blank" rel="noreferrer">{row.external_listing_id}</a> : (row.external_listing_id || "—")}</td>
            </tr>)}
          </tbody></table></div>
      )}

      {tab === "Destinations" && (
        <div className="table-wrap"><table><thead><tr><th>Destination</th><th>Page ID</th><th>Instagram</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{destinationsQuery.isLoading ? <LoadingRow columns={5} /> : managed.length === 0 ? <EmptyRow columns={5} text="No Meta destinations yet. Use Connect Meta." /> : managed.map(dest => (
            <tr key={dest.id}><td><strong>{destinationLabel(dest)}</strong></td>
              <td>{dest.facebook_page_id || "—"}</td>
              <td>{dest.instagram_username ? `@${dest.instagram_username}` : "Facebook only"}</td>
              <td><StatusBadge value={dest.connection_status || dest.status} /></td>
              <td>{canConnect && <>
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px", marginRight: 4 }} disabled={Boolean(storeAction)} onClick={async () => {
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
                  ? <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px", marginRight: 4 }} disabled={Boolean(storeAction)} onClick={() => runAction(`/integrations/meta/destinations/${dest.id}/disable`, "Disable")}>Disable</button>
                  : <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px", marginRight: 4 }} disabled={Boolean(storeAction)} onClick={() => runAction(`/integrations/meta/destinations/${dest.id}/enable`, "Enable")}>Enable</button>}
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 8px" }} disabled={Boolean(storeAction)} onClick={() => startConnect(dest.id)}>Reconnect</button>
              </>}</td></tr>
          ))}</tbody></table></div>
      )}

      {selectOpen && <Modal title="Select Meta destinations" eyebrow="Connect Meta" onClose={() => setSelectOpen(false)} width={720}>
        <div className="muted" style={{ marginBottom: 12 }}>Choose Facebook Pages from this authorization. Instagram is optional and only offered when a Professional account is linked to the Page.</div>
        {discoveredQuery.data?.instagram_unavailable_note && <div className="card" style={{ padding: 10, marginBottom: 12 }}>{discoveredQuery.data.instagram_unavailable_note}</div>}
        {discoveredQuery.isLoading ? <div className="muted">Loading Pages…</div> : discovered.length === 0 ? <div>No Facebook Pages were returned for this user.</div> : discovered.map(page => {
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
                <span className="muted">{page.has_instagram ? `Instagram @${page.instagram_username}` : "Facebook only"}</span>
              </label>
              {selected && page.has_instagram && (
                <label style={{ display: "flex", gap: 8, marginTop: 8, marginLeft: 24 }}>
                  <input type="checkbox" checked={picked[page.facebook_page_id]?.include_instagram} onChange={e => {
                    setPicked(curr => ({ ...curr, [page.facebook_page_id]: { include_instagram: e.target.checked } }));
                  }} />
                  Also connect Instagram @{page.instagram_username}
                </label>
              )}
              {selected && !page.has_instagram && <div className="muted" style={{ marginLeft: 24, marginTop: 6 }}>No Instagram Professional account is linked to this Page.</div>}
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setSelectOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={storeAction === "complete"} onClick={completeSelection}>
            {storeAction === "complete" ? "Saving..." : "Connect selected"}
          </button>
        </div>
      </Modal>}
    </div>
  );
}
