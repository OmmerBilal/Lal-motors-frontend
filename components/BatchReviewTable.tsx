"use client";

import { CheckCircle2, ExternalLink, Loader2, Pencil, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Field, Message, Modal, SelectField, StatusBadge } from "@/components/RealUi";
import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";

export type EntityType = "vehicle" | "new_item" | "used_part" | "inventory";
export type DuplicateStatus = "new" | "existing" | "possible_duplicate" | "invalid" | "unlinked";
export type ReviewStatus = "pending" | "included" | "skipped" | "created";

export type BatchItem = {
  id: string;
  candidate_number: number;
  source_file_ids: string[];
  extracted_data: Record<string, any>;
  duplicate_status: DuplicateStatus;
  duplicate_of_item_id: string | null;
  duplicate_of_candidate_number: number | null;
  review_status: ReviewStatus;
  resolve_as: "vehicle" | "new_item" | "used_part" | null;
  created_item_id: string | null;
  review_reason?: string | null;
  result_status?: string | null;
  result_message?: string | null;
  created_item?: { item_code: string; name: string; item_type: string } | null;
};

export type Batch = {
  id: string;
  entity_type: EntityType;
  is_acquisition: boolean;
  status: string;
  summary: Record<string, number>;
  items: BatchItem[];
  lifecycle?: "extracting" | "review" | "creating" | "partial" | "completed" | "failed";
  creating_stale?: boolean;
  intake_method?: string | null;
  extract_ms?: number | null;
  create_ms?: number | null;
  completed_at?: string | null;
  created_at?: string;
  requested_by_name?: string | null;
};

type Location = { id: string; location_code: string; name: string | null };

export type CreateResult = {
  created_count: number;
  skipped_count: number;
  blocked_count: number;
  error_count?: number;
};

// A row the server would actually try to create right now. Existing rows are
// only creatable for Inventory (an existing catalog item is exactly what stock
// is received against); everywhere else "existing" is a final, skipped state.
export function isCreatable(item: BatchItem, entityType: EntityType): boolean {
  if (item.review_status === "created" || item.review_status === "skipped") return false;
  switch (item.duplicate_status) {
    case "new":
      return true;
    case "possible_duplicate":
      return item.review_status === "included";
    case "existing":
      return entityType === "inventory";
    case "unlinked":
      return !!item.resolve_as;
    default:
      return false;
  }
}

// Rows waiting on a human decision (not final, not creatable yet).
export function needsReview(item: BatchItem): boolean {
  if (item.review_status === "created" || item.review_status === "skipped") return false;
  if (item.duplicate_status === "possible_duplicate") return item.review_status !== "included";
  if (item.duplicate_status === "unlinked") return !item.resolve_as;
  return false;
}

function sourceImageUrl(fileId: string) {
  return `${API_BASE_URL}/ai/studio/media/${fileId}`;
}

function label(item: BatchItem): string {
  const d = item.extracted_data;
  if (d.make || d.model || d.year) {
    return [d.year, d.make, d.model].filter(Boolean).join(" ") || d.vin || "Vehicle";
  }
  return d.name || d.identifier || d.sku || "Item";
}

const DUPLICATE_TONE: Record<DuplicateStatus, string> = {
  new: "green",
  existing: "blue",
  possible_duplicate: "orange",
  invalid: "red",
  unlinked: "orange",
};

export function dupLabel(status: DuplicateStatus, entityType: EntityType): string {
  if (status === "possible_duplicate") return "Needs Review";
  // Inventory rows resolve to an EXISTING catalog item and the action is a stock
  // receipt, so "Existing" would read as "nothing to do" — call it Resolved.
  if (status === "existing" && entityType === "inventory") return "Resolved";
  if (status === "new" && entityType === "inventory") return "Ready";
  return status[0].toUpperCase() + status.slice(1);
}

function DupBadge({ status, entityType }: { status: DuplicateStatus; entityType: EntityType }) {
  return <span className={`badge ${DUPLICATE_TONE[status]}`}>{dupLabel(status, entityType)}</span>;
}

export function actionLabel(entityType: EntityType, remaining: boolean): string {
  if (entityType === "inventory") return remaining ? "Receive Remaining" : "Receive Selected";
  const noun = entityType === "vehicle" ? "Vehicles" : "Items";
  return remaining ? `Create Remaining` : `Add New ${noun}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Creating records is a database operation, not an AI call: it gets its own
// generous budget (never the 20s default) and, if the connection drops or
// times out anyway, the outcome is read back from the server instead of being
// reported as a failure — the create may well have finished.
const CREATE_TIMEOUT_MS = 180_000;

function EditItemModal({
  item,
  entityType,
  onClose,
  onSave,
}: {
  item: BatchItem;
  entityType: EntityType;
  onClose: () => void;
  onSave: (fields: Record<string, any>) => Promise<void>;
}) {
  const d = item.extracted_data;
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const keys = entityType === "vehicle"
      ? ["make", "model", "year", "vin", "registration", "stock_number", "lot_number", "purchase_price"]
      : entityType === "inventory"
      ? ["identifier", "quantity", "unit_cost", "location_hint"]
      : ["name", "sku", "brand", "barcode", "default_cost", "default_selling_price"];
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = d[k] != null ? String(d[k]) : "";
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const parsed: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === "") { parsed[k] = null; continue; }
        parsed[k] = ["year", "mileage", "quantity"].includes(k) ? Number(v)
          : ["purchase_price", "auction_fees", "default_cost", "default_selling_price", "unit_cost"].includes(k) ? Number(v)
          : v;
      }
      await onSave(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit Row ${item.candidate_number}`} eyebrow="Batch Review" onClose={onClose} width={520}>
      <Message error={error} />
      <div className="form-grid">
        {Object.entries(fields).map(([k, v]) => (
          <Field
            key={k}
            label={k.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            value={v}
            onChange={(val) => setFields((f) => ({ ...f, [k]: val }))}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><Loader2 size={14} className="spin" /> Saving...</> : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// One reusable review surface for every Smart Intake entity type (Vehicles,
// New Items, Used Parts, Inventory) — column emphasis differs slightly per
// type but the summary/select/edit/skip/resolve/create flow is identical,
// so this is the single implementation instead of three parallel ones.
export function BatchReviewTable({
  batchId,
  initialBatch,
  onCreated,
  onComplete,
}: {
  batchId: string;
  initialBatch: Batch;
  onCreated?: (result: CreateResult) => void;
  // Fired once when nothing actionable is left (every row created, existing,
  // skipped or final-invalid) so the host can close the modal.
  onComplete?: (result: CreateResult) => void;
}) {
  const [batch, setBatch] = useState<Batch>(initialBatch);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialBatch.items.filter((i) => isCreatable(i, initialBatch.entity_type)).map((i) => i.id)),
  );
  const [editingItem, setEditingItem] = useState<BatchItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateResult | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState("");
  const [locations, setLocations] = useState<Location[] | null>(null);

  const needsLocation = batch.entity_type === "inventory";

  useMemo(() => {
    if (needsLocation && locations === null) {
      apiFetch<Location[]>("/inventory/locations").then(setLocations).catch(() => setLocations([]));
    }
  }, [needsLocation, locations]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function patchItem(item: BatchItem, body: Record<string, any>) {
    const updated = await apiFetch<BatchItem>(`/smart-intake/batches/${batchId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setBatch((b) => ({ ...b, items: b.items.map((i) => (i.id === item.id ? updated : i)) }));
    return updated;
  }

  async function skip(item: BatchItem) {
    setBusy(true);
    setError("");
    try {
      await patchItem(item, { review_status: "skipped" });
      setSelected((cur) => { const n = new Set(cur); n.delete(item.id); return n; });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to skip this row.");
    } finally {
      setBusy(false);
    }
  }

  async function includeAnyway(item: BatchItem) {
    setBusy(true);
    setError("");
    try {
      await patchItem(item, { review_status: "included" });
      setSelected((cur) => new Set(cur).add(item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to resolve this duplicate.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveAs(item: BatchItem, resolveAs: string) {
    setBusy(true);
    setError("");
    try {
      await patchItem(item, { resolve_as: resolveAs });
      setSelected((cur) => new Set(cur).add(item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to resolve this row.");
    } finally {
      setBusy(false);
    }
  }

  const [progressText, setProgressText] = useState("");

  function finish(res: CreateResult, fresh: Batch) {
    setResult(res);
    setBatch(fresh);
    setSelected((cur) => new Set(fresh.items.filter((i) => cur.has(i.id) && isCreatable(i, fresh.entity_type)).map((i) => i.id)));
    onCreated?.(res);
    const remaining = fresh.items.some((i) => isCreatable(i, fresh.entity_type) || needsReview(i));
    if (!remaining) onComplete?.(res);
  }

  // Real server-side progress ("Creating 20 of 100…") while the create request runs.
  async function watchProgress(stop: { done: boolean }) {
    while (!stop.done) {
      await sleep(1200);
      if (stop.done) return;
      try {
        const p = await apiFetch<{ message: string | null; current: number | null; total: number | null }>(
          `/ai/requests/${batchId}/progress`, { timeoutMs: 8_000 });
        if (!stop.done && p.message) setProgressText(p.message);
      } catch {
        // a missed poll never affects the create itself
      }
    }
  }

  // After a timeout/disconnect: ask the server what actually happened.
  async function reconcile(sentIds: string[]): Promise<{ res: CreateResult; fresh: Batch } | { failure: string }> {
    const deadline = Date.now() + 120_000;
    let lastError = "";
    while (Date.now() < deadline) {
      try {
        const fresh = await apiFetch<Batch>(`/smart-intake/batches/${batchId}`, { timeoutMs: 30_000 });
        if (fresh.lifecycle === "creating" && !fresh.creating_stale) {
          setProgressText("Still creating records on the server…");
          await sleep(2500);
          continue;
        }
        const sent = fresh.items.filter((i) => sentIds.includes(i.id));
        const res: CreateResult = {
          created_count: sent.filter((i) => i.review_status === "created").length,
          skipped_count: sent.filter((i) => i.review_status === "skipped").length,
          blocked_count: sent.filter((i) => i.result_status === "blocked").length,
          error_count: sent.filter((i) => i.result_status === "error" && i.review_status !== "created").length,
        };
        const notDone = sent.filter((i) => isCreatable(i, fresh.entity_type)).length;
        if (res.created_count === 0 && notDone === sent.length && sent.length > 0) {
          return { failure: "The server did not create these records. Nothing was changed — you can try again." };
        }
        setBatch(fresh);
        return { res, fresh };
      } catch (e) {
        lastError = e instanceof Error ? e.message : "";
        await sleep(2500);
      }
    }
    return { failure: `Couldn't confirm the result${lastError ? ` (${lastError})` : ""}. Refresh the page to see what was created before trying again.` };
  }

  async function createSelected() {
    if (busy) return;
    if (needsLocation && !defaultLocationId) {
      setError("Choose a storage location before receiving this stock.");
      return;
    }
    const sentIds = Array.from(selected).filter((id) => {
      const it = batch.items.find((i) => i.id === id);
      return !!it && isCreatable(it, batch.entity_type);
    });
    setBusy(true);
    setError("");
    setProgressText(`Creating ${sentIds.length} record${sentIds.length === 1 ? "" : "s"}…`);
    const stop = { done: false };
    void watchProgress(stop);
    try {
      let outcome: { res: CreateResult; fresh: Batch } | { failure: string };
      try {
        const res = await apiFetch<CreateResult>(`/smart-intake/batches/${batchId}/create`, {
          method: "POST",
          timeoutMs: CREATE_TIMEOUT_MS,
          body: JSON.stringify({ item_ids: sentIds, default_location_id: needsLocation ? defaultLocationId : undefined }),
        });
        setProgressText("Finalizing…");
        const fresh = await apiFetch<Batch>(`/smart-intake/batches/${batchId}`, { timeoutMs: 30_000 });
        outcome = { res, fresh };
      } catch (e) {
        const ambiguous = !(e instanceof ApiError) || e.status === 408 || e.status >= 502;
        if (!ambiguous) throw e;
        setProgressText("Connection interrupted — checking what was created…");
        outcome = await reconcile(sentIds);
      }
      if ("failure" in outcome) setError(outcome.failure);
      else finish(outcome.res, outcome.fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create these records.");
    } finally {
      stop.done = true;
      setProgressText("");
      setBusy(false);
    }
  }

  const s = batch.summary;
  const creatableIds = batch.items.filter((i) => isCreatable(i, batch.entity_type)).map((i) => i.id);
  const selectedCreatable = creatableIds.filter((id) => selected.has(id));
  const reviewCount = batch.items.filter(needsReview).length;

  return (
    <div>
      <Message error={error} />
      <div style={{ marginBottom: 12 }}>
        <strong>Found {batch.items.length} {batch.entity_type === "vehicle" ? "vehicle(s)" : batch.entity_type === "inventory" ? "row(s)" : "item(s)"}</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          New: {s.new ?? 0} · Existing: {s.existing ?? 0} · Needs Review: {s.possible_duplicate ?? 0}
          {s.invalid ? ` · Invalid: ${s.invalid}` : ""}
          {s.unlinked ? ` · Unlinked: ${s.unlinked}` : ""}
        </div>
      </div>

      {needsLocation && (
        <div style={{ maxWidth: 320, marginBottom: 12 }}>
          <SelectField
            label="Receive into location"
            value={defaultLocationId}
            onChange={setDefaultLocationId}
            options={[{ value: "", label: "Select a location..." }, ...(locations ?? []).map((l) => ({ value: l.id, label: l.name ? `${l.location_code} — ${l.name}` : l.location_code }))]}
          />
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Status</th>
              <th>{batch.entity_type === "inventory" ? "Row" : "Record"}</th>
              <th>Details</th>
              <th>Source</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item) => {
              const d = item.extracted_data;
              const disabled = item.review_status === "created" || item.review_status === "skipped";
              return (
                <tr key={item.id} style={disabled ? { opacity: 0.55 } : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      disabled={disabled}
                      onChange={() => toggle(item.id)}
                    />
                  </td>
                  <td>
                    {item.review_status === "created" ? <StatusBadge value="created" /> : <DupBadge status={item.duplicate_status} entityType={batch.entity_type} />}
                  </td>
                  <td>
                    <strong>{label(item)}</strong>
                    <div className="muted" style={{ fontSize: 11 }}>#{item.candidate_number}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {batch.entity_type === "vehicle" && (
                      <>{d.vin ? `VIN ${d.vin}` : ""} {d.registration ? `· Reg ${d.registration}` : ""} {d.stock_number ? `· Stock ${d.stock_number}` : ""}
                        {d.purchase_price != null ? ` · $${d.purchase_price}` : ""}</>
                    )}
                    {batch.entity_type === "inventory" && (
                      <>{d.identifier || "—"} {d.quantity != null ? `× ${d.quantity}` : ""}</>
                    )}
                    {(batch.entity_type === "new_item" || batch.entity_type === "used_part") && (
                      <>{d.sku ? `SKU ${d.sku}` : ""} {d.brand ? `· ${d.brand}` : ""}
                        {d.default_selling_price != null ? ` · $${d.default_selling_price}` : ""}</>
                    )}
                    {item.review_reason && item.review_status !== "created" && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{item.review_reason}</div>
                    )}
                    {item.result_status === "error" && item.review_status !== "created" && item.result_message && (
                      <div style={{ fontSize: 11, marginTop: 4, color: "var(--danger, #c0392b)" }}>Failed: {item.result_message}</div>
                    )}
                    {item.duplicate_status === "unlinked" && (
                      <div style={{ marginTop: 6 }}>
                        <select
                          className="select"
                          style={{ fontSize: 11, padding: "4px 6px" }}
                          value={item.resolve_as ?? ""}
                          onChange={(e) => resolveAs(item, e.target.value)}
                          disabled={busy}
                        >
                          <option value="">Create as...</option>
                          <option value="vehicle">Vehicle</option>
                          <option value="new_item">New Item</option>
                          <option value="used_part">Used Part</option>
                        </select>
                      </div>
                    )}
                  </td>
                  <td>
                    {item.source_file_ids[0] && (
                      <a href={sourceImageUrl(item.source_file_ids[0])} target="_blank" rel="noreferrer" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ExternalLink size={11} /> Image
                      </a>
                    )}
                  </td>
                  <td>
                    <div className="record-actions">
                      <button className="record-action edit" title="Edit" disabled={disabled} onClick={() => setEditingItem(item)}>
                        <Pencil size={13} />
                      </button>
                      {item.duplicate_status === "possible_duplicate" && item.review_status !== "included" && (
                        <button className="record-action view" title="Include Anyway" disabled={busy || disabled} onClick={() => includeAnyway(item)}>
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      {!disabled && (
                        <button className="record-action delete" title="Skip" disabled={busy} onClick={() => skip(item)}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result && (
        <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          {result.created_count} created.
          {result.skipped_count ? ` ${result.skipped_count} skipped.` : ""}
          {reviewCount ? ` ${reviewCount} need review.` : ""}
          {result.error_count ? ` ${result.error_count} failed.` : ""}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        {creatableIds.length > 0 ? (
          <button
            className="btn btn-primary"
            disabled={busy || selectedCreatable.length === 0}
            onClick={createSelected}
          >
            {busy
              ? <><Loader2 size={15} className="spin" /> {progressText || "Creating…"}</>
              : `${actionLabel(batch.entity_type, !!result)} (${selectedCreatable.length})`}
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>
            {reviewCount > 0 ? "Resolve the rows marked Needs Review to continue." : "Nothing left to add."}
          </span>
        )}
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          entityType={batch.entity_type}
          onClose={() => setEditingItem(null)}
          onSave={async (fields) => {
            await patchItem(editingItem, { fields });
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
