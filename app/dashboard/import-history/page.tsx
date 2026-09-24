"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { type Batch, type BatchItem, dupLabel, type EntityType } from "@/components/BatchReviewTable";
import { EmptyRow, LoadingRow, Message, Modal, SelectField } from "@/components/RealUi";
import { RequirePermission } from "@/components/RequirePermission";
import { API_BASE_URL, apiFetch } from "@/lib/api";

type HistoryRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  lifecycle: "extracting" | "review" | "creating" | "partial" | "completed" | "failed";
  entity_type: EntityType;
  method_label: string;
  requested_by_name: string | null;
  source_label: string | null;
  extract_ms: number | null;
  create_ms: number | null;
  found: number;
  created: number;
  existing: number;
  skipped: number;
  needs_review: number;
  failed: number;
};

type Detail = Batch & {
  source_files: { file_id: string; filename: string | null; mime_type: string | null }[];
  source_text: string | null;
};

const MODULE_LABEL: Record<string, string> = {
  vehicle: "Vehicles", new_item: "New Items", used_part: "Used Parts", inventory: "Inventory",
};
const LIFECYCLE_LABEL: Record<string, string> = {
  extracting: "Extracting", review: "Awaiting review", creating: "Creating", partial: "Partially done",
  completed: "Completed", failed: "Failed",
};
const LIFECYCLE_TONE: Record<string, string> = {
  extracting: "orange", review: "orange", creating: "orange", partial: "orange", completed: "green", failed: "red",
};

function seconds(ms: number | null | undefined) {
  return ms == null ? "—" : `${(ms / 1000).toFixed(1)} sec`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function itemTitle(it: BatchItem) {
  const d = it.extracted_data;
  return [d.year, d.make, d.model].filter(Boolean).join(" ") || d.name || d.identifier || d.vin || d.sku || "Record";
}

function outcome(it: BatchItem, entity: EntityType) {
  if (it.review_status === "created") return "Created";
  if (it.result_status === "error") return `Failed${it.result_message ? `: ${it.result_message}` : ""}`;
  if (it.review_status === "skipped") return it.duplicate_status === "existing" ? "Existing — skipped" : "Skipped";
  if (it.duplicate_status === "existing" && entity !== "inventory") return "Existing";
  if (it.duplicate_status === "invalid") return "Not enough information";
  return it.review_reason || dupLabel(it.duplicate_status, entity);
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    apiFetch<Detail>(`/smart-intake/batches/${id}/detail`)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load this import."));
  }, [id]);

  return (
    <Modal title="Import details" eyebrow="Smart Intake" onClose={onClose} width={980}>
      <Message error={error} />
      {!detail && !error && <div className="muted">Loading…</div>}
      {detail && (
        <>
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            {MODULE_LABEL[detail.entity_type]} ·{" "}
            {detail.intake_method === "image" ? (detail.is_acquisition ? "Auction Slip" : "Image Scan") : "Raw / Bulk Data"}
            {" · "}{detail.requested_by_name || "Unknown user"} · {detail.created_at ? when(detail.created_at) : ""}
            {" · "}extract {seconds(detail.extract_ms)} · create {seconds(detail.create_ms)}
          </div>

          {detail.source_files.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 13 }}>
              <strong>Source files:</strong>{" "}
              {detail.source_files.map((f) => (
                <a key={f.file_id} href={`${API_BASE_URL}/ai/studio/media/${f.file_id}`} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>
                  {f.filename || "file"} <ExternalLink size={11} />
                </a>
              ))}
            </div>
          )}
          {detail.source_text && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowSource((v) => !v)}>
                {showSource ? "Hide source data" : "View source data"}
              </button>
              {showSource && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 220, overflow: "auto" }}>{detail.source_text}</pre>}
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Record</th><th>Source row</th><th>Result</th><th>Created record</th></tr>
              </thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.candidate_number}</td>
                    <td>
                      <strong>{itemTitle(it)}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{dupLabel(it.duplicate_status, detail.entity_type)}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {it.extracted_data.source_row || "—"}
                      {it.source_file_ids[0] && (
                        <div>
                          <a href={`${API_BASE_URL}/ai/studio/media/${it.source_file_ids[0]}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                            <ExternalLink size={11} /> Image
                          </a>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{outcome(it, detail.entity_type)}</td>
                    <td style={{ fontSize: 12 }}>
                      {it.created_item
                        ? (detail.entity_type === "vehicle" && it.created_item_id
                          ? <a href={`/dashboard/vehicles/${it.created_item_id}`}>{it.created_item.item_code}</a>
                          : <span>{it.created_item.item_code}</span>)
                        : "—"}
                      {it.created_item && <div className="muted" style={{ fontSize: 11 }}>{it.created_item.name}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function ImportHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("module");
    if (m) setModuleFilter(m);
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const q = moduleFilter ? `?entity_type=${moduleFilter}` : "";
      setRows(await apiFetch<HistoryRow[]>(`/smart-intake/history${q}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load import history.");
      setRows([]);
    }
  }, [moduleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Smart Intake</div>
          <h1 className="page-title">Import History</h1>
          <p className="page-copy">What was imported, by whom, from where, and what it created.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ width: 180 }}>
            <SelectField
              label="Module"
              value={moduleFilter}
              onChange={setModuleFilter}
              options={[{ value: "", label: "All modules" }, ...Object.entries(MODULE_LABEL).map(([value, label]) => ({ value, label }))]}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>
      <Message error={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date / time</th><th>User</th><th>Module</th><th>Method</th><th>Found</th><th>Created</th>
              <th>Existing</th><th>Skipped</th><th>Review</th><th>Failed</th><th>Duration</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? <LoadingRow columns={12} /> : rows.length === 0 ? <EmptyRow columns={12} text="No imports yet." /> : rows.map((r) => (
              <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(r.id)}>
                <td>{when(r.created_at)}</td>
                <td>{r.requested_by_name || "—"}</td>
                <td>{MODULE_LABEL[r.entity_type] || r.entity_type}</td>
                <td>{r.method_label}</td>
                <td>{r.found}</td>
                <td>{r.created}</td>
                <td>{r.existing}</td>
                <td>{r.skipped}</td>
                <td>{r.needs_review}</td>
                <td>{r.failed}</td>
                <td style={{ fontSize: 12 }}>{seconds(((r.extract_ms ?? 0) + (r.create_ms ?? 0)) || null)}</td>
                <td><span className={`badge ${LIFECYCLE_TONE[r.lifecycle] || ""}`}>{LIFECYCLE_LABEL[r.lifecycle] || r.lifecycle}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && <DetailModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

export default function Page() {
  return (
    <RequirePermission perm="ai.use">
      <ImportHistoryPage />
    </RequirePermission>
  );
}
