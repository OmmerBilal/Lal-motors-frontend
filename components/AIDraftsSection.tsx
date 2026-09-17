"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Search, ThumbsUp, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyRow, LoadingRow, Message, Modal, SelectField, StatusBadge, labelize } from "@/components/RealUi";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type ChannelName = "shopify" | "ebay" | "meta" | "tiktok";

type ChannelDraft = {
  id: string; session_id: string; master_draft_id: string; channel: ChannelName; platform: string | null;
  status: string; current_version: number; payload: Record<string, any>; missing_information: string[];
  product_name?: string; created_at: string; updated_at: string;
};

const STATUS_OPTIONS = ["draft", "needs_information", "ready_for_review", "approved", "published", "publish_failed"];

function draftTitle(d: ChannelDraft): string {
  return d.payload?.title || d.payload?.hook || d.payload?.primary_caption || d.payload?.caption || "(untitled)";
}

function downloadDraft(id: string, format: "json" | "csv" | "txt") {
  const a = document.createElement("a");
  a.href = `${API_BASE_URL}/ai/studio/drafts/${id}/export?format=${format}`;
  a.download = "";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Shared "AI Content Drafts" library, embedded in each channel module
// (Shopify/eBay's own tabbed modules, and Meta/TikTok's ChannelListingsPage).
// One component change here lights up every channel's draft library at once.
export function AIDraftsSection({ provider, title }: { provider: ChannelName; title: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<ChannelDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const params = useMemo(() => ({ provider, status: statusFilter || undefined, search: search.trim() || undefined }), [provider, statusFilter, search]);

  const draftsQuery = useQuery({
    queryKey: queryKeys.contentStudio.drafts(params),
    queryFn: () => apiFetch<ChannelDraft[]>(`/ai/studio/drafts?${new URLSearchParams({
      provider, ...(statusFilter ? { status: statusFilter } : {}), ...(search.trim() ? { search: search.trim() } : {}),
    })}`),
    staleTime: 60 * 1000,
  });
  const drafts = draftsQuery.data ?? [];

  async function askAI(draft: ChannelDraft) {
    const instruction = prompt(`What should change on this ${title} draft?`, "");
    if (!instruction) return;
    setBusy(true); setError("");
    try {
      const res = await apiFetch<{ draft: ChannelDraft }>(`/ai/studio/sessions/${draft.session_id}/revise`, {
        method: "POST", body: JSON.stringify({ instruction, channel: draft.channel, scope: "channel" }),
      });
      setSelected(res.draft); setSuccess("Draft revised.");
      invalidate(queryClient, ["contentStudio"]);
    } catch (e: any) { setError(e?.message || "Unable to revise draft."); }
    finally { setBusy(false); }
  }

  async function regenerate(draft: ChannelDraft) {
    setBusy(true); setError("");
    try {
      const updated = await apiFetch<ChannelDraft>(`/ai/studio/drafts/${draft.id}/regenerate`, { method: "POST" });
      setSelected(updated); setSuccess("Draft regenerated.");
      invalidate(queryClient, ["contentStudio"]);
    } catch (e: any) { setError(e?.message || "Unable to regenerate draft."); }
    finally { setBusy(false); }
  }

  async function approve(draft: ChannelDraft) {
    setBusy(true); setError("");
    try {
      const updated = await apiFetch<ChannelDraft>(`/ai/studio/drafts/${draft.id}/approve`, { method: "POST" });
      setSelected(updated); setSuccess("Draft approved.");
      invalidate(queryClient, ["contentStudio"]);
    } catch (e: any) { setError(e?.message || "Unable to approve draft."); }
    finally { setBusy(false); }
  }

  async function saveEdit(draft: ChannelDraft, patch: Record<string, any>) {
    setBusy(true); setError("");
    try {
      const updated = await apiFetch<ChannelDraft>(`/ai/studio/drafts/${draft.id}`, {
        method: "PUT", body: JSON.stringify({ payload: patch }),
      });
      setSelected(updated); setSuccess("Draft updated.");
      invalidate(queryClient, ["contentStudio"]);
    } catch (e: any) { setError(e?.message || "Unable to save edit."); }
    finally { setBusy(false); }
  }

  return <section style={{ marginBottom: 22 }}>
    <div className="panel-head">
      <div><h3 style={{ margin: 0 }}>AI Content Drafts</h3>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Generated from the AI Command Center's Content Studio — automatically saved here.</div></div>
      <button className="btn btn-secondary" onClick={() => draftsQuery.refetch()}><RefreshCw size={14} />Refresh</button>
    </div>

    <Message error={error} success={success} />

    <div className="records-toolbar card">
      <div><strong>Draft Library</strong><div className="muted" style={{ fontSize: 12 }}>{drafts.length} visible</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="records-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by product..." /></div>
        <select className="select" style={{ width: 170 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{labelize(s)}</option>)}
        </select>
      </div>
    </div>

    <div className="table-wrap"><table><thead><tr><th>Product</th><th>Status</th><th>Version</th><th>Updated</th><th>Actions</th></tr></thead>
      <tbody>{draftsQuery.isLoading ? <LoadingRow columns={5} /> : drafts.length === 0 ? <EmptyRow columns={5} text="No AI drafts yet — generate one from the AI Command Center." /> : drafts.map(d =>
        <tr key={d.id}>
          <td><strong>{d.product_name || draftTitle(d)}</strong><div className="muted" style={{ fontSize: 11 }}>{draftTitle(d)}</div></td>
          <td><StatusBadge value={d.status} /></td><td>v{d.current_version}</td>
          <td>{new Date(d.updated_at).toLocaleString()}</td>
          <td><div className="record-actions">
            <button className="record-action view" onClick={() => setSelected(d)}>View</button>
          </div></td>
        </tr>)}</tbody></table></div>

    {selected && <Modal title={draftTitle(selected)} eyebrow={`${title} Draft`} onClose={() => setSelected(null)} width={800}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <StatusBadge value={selected.status} /><span className="muted" style={{ fontSize: 12 }}>version {selected.current_version}</span>
      </div>
      <div className="card" style={{ padding: 14, background: "var(--bg-elev)" }}>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>{JSON.stringify(selected.payload, null, 2)}</pre>
      </div>
      {selected.missing_information?.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Missing information: {selected.missing_information.join(", ")}
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <button className="btn btn-secondary" disabled={busy} onClick={() => {
          const key = prompt("Field name to edit (e.g. title, description, price)", "title");
          if (!key) return;
          const value = prompt(`New value for "${key}"`, String(selected.payload?.[key] ?? ""));
          if (value === null) return;
          saveEdit(selected, { [key]: value });
        }}>Edit</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => askAI(selected)}><Wand2 size={14} />Ask AI</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => regenerate(selected)}><RefreshCw size={14} />Regenerate</button>
        {selected.status !== "approved" && <button className="btn btn-primary" disabled={busy} onClick={() => approve(selected)}><ThumbsUp size={14} />Approve</button>}
        <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(JSON.stringify(selected.payload, null, 2))}>Copy</button>
        <button className="btn btn-ghost" onClick={() => downloadDraft(selected.id, "json")}><Download size={14} />JSON</button>
        {(provider === "shopify" || provider === "ebay") && <button className="btn btn-ghost" onClick={() => downloadDraft(selected.id, "csv")}><Download size={14} />CSV</button>}
        {(provider === "meta" || provider === "tiktok") && <button className="btn btn-ghost" onClick={() => downloadDraft(selected.id, "txt")}><Download size={14} />TXT</button>}
      </div>
      <div className="card" style={{ padding: 10, marginTop: 14, fontSize: 12 }}>
        {provider === "shopify" && "Publish is disabled until Shopify is connected — connect it in the Sync/Connection tab."}
        {provider === "ebay" && "Publish is disabled until eBay is connected — connect it in the Sync/Connection tab."}
        {provider === "meta" && "Connect Meta to publish."}
        {provider === "tiktok" && "Connect TikTok to publish."}
      </div>
    </Modal>}
  </section>;
}
