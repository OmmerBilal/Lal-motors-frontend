"use client";

import { ChevronDown, History, Plus, ScanLine, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type Batch, BatchReviewTable, type CreateResult, type EntityType } from "@/components/BatchReviewTable";
import { AIProgressIndicator } from "@/components/AIProgressIndicator";
import { Message, Modal } from "@/components/RealUi";
import { apiFetch } from "@/lib/api";
import { newRequestId, useAIProgress } from "@/lib/hooks/useAIProgress";

const EXTRACT_TIMEOUT_MS = 300_000;

function SmartIntakeModal({
  entityType,
  isAcquisition,
  mode,
  onClose,
  onBatchCreated,
  onAllDone,
}: {
  entityType: EntityType;
  isAcquisition: boolean;
  mode: "bulk" | "scan";
  onClose: () => void;
  onBatchCreated?: () => void;
  onAllDone?: (res: CreateResult) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiProgress = useAIProgress();
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  function cancelExtract() {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }

  async function runText() {
    if (loading) return;
    setLoading(true);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;
    const requestId = newRequestId();
    aiProgress.start(requestId, "Reading pasted data…");
    try {
      const res = await apiFetch<Batch>(`/smart-intake/${entityType}/extract-text`, {
        method: "POST",
        timeoutMs: EXTRACT_TIMEOUT_MS,
        signal: controller.signal,
        body: JSON.stringify({ text, is_acquisition: isAcquisition, client_request_id: requestId }),
      });
      setBatch(res);
    } catch (e) {
      setError(cancelledRef.current ? "Cancelled." : e instanceof Error ? e.message : "Unable to process this data.");
    } finally {
      aiProgress.stop();
      abortRef.current = null;
      setLoading(false);
    }
  }

  async function runImages() {
    if (files.length === 0 || loading) return;
    setLoading(true);
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;
    const requestId = newRequestId();
    aiProgress.start(requestId, files.length > 1 ? `Uploading ${files.length} images…` : "Uploading image…");
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("is_acquisition", String(isAcquisition));
      form.append("client_request_id", requestId);
      const res = await apiFetch<Batch>(`/smart-intake/${entityType}/extract-images`, {
        method: "POST",
        timeoutMs: EXTRACT_TIMEOUT_MS,
        signal: controller.signal,
        body: form,
      });
      setBatch(res);
    } catch (e) {
      setError(cancelledRef.current ? "Cancelled." : e instanceof Error ? e.message : "Unable to process these images.");
    } finally {
      aiProgress.stop();
      abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <Modal title={mode === "bulk" ? "Bulk / Raw Data" : "Scan Image(s)"} eyebrow="Smart Intake" onClose={onClose} width={batch ? 960 : 560}>
      <Message error={error} />
      {loading && !batch && (
        <div style={{ marginBottom: 12 }}>
          <AIProgressIndicator progress={aiProgress.progress} onCancel={cancelExtract} />
        </div>
      )}

      {!batch && mode === "bulk" && (
        <>
          <label className="form-label">Paste rows — one record per line</label>
          <textarea
            className="textarea"
            style={{ minHeight: 200 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Stock 101 | Toyota Prius | 2021 | VIN...\nStock 102 | BMW 320D | 2019 | VIN...\nStock 103 | Audi A4 | 2020 | VIN..."}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn btn-primary" disabled={loading || !text.trim()} onClick={runText}>
              {loading ? "Working…" : "Extract Records"}
            </button>
          </div>
        </>
      )}

      {!batch && mode === "scan" && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            hidden
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
            Camera / Upload
          </button>
          {files.length > 0 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{files.length} file(s) selected</div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn btn-primary" disabled={loading || files.length === 0} onClick={runImages}>
              {loading ? "Working…" : "Extract Records"}
            </button>
          </div>
        </>
      )}

      {batch && (
        <BatchReviewTable
          batchId={batch.id}
          initialBatch={batch}
          onCreated={() => onBatchCreated?.()}
          onComplete={(res) => onAllDone?.(res)}
        />
      )}
    </Modal>
  );
}

// The [+ Add] launcher every Smart-Intake-enabled module (Vehicles, New
// Items, Inventory) shares — Manual Entry delegates to the page's own
// existing create form/modal (untouched), Bulk/Scan share one intake modal
// + BatchReviewTable instead of three separate implementations per module.
export function SmartIntakeLauncher({
  entityType,
  isAcquisition = false,
  label = "Add",
  onManual,
  onBatchCreated,
}: {
  entityType: EntityType;
  isAcquisition?: boolean;
  label?: string;
  // Omit for modules with no existing "manual create" concept (e.g.
  // Inventory, which only ever resolves against or receives against an
  // existing catalog item) — the Manual Entry menu item is hidden.
  onManual?: () => void;
  onBatchCreated?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"bulk" | "scan" | null>(null);
  const [doneNote, setDoneNote] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button className="btn btn-primary" onClick={() => setMenuOpen((o) => !o)}>
        <Plus size={15} /> {label} <ChevronDown size={13} />
      </button>

      {menuOpen && (
        <div className="card" style={{ position: "absolute", zIndex: 60, top: "calc(100% + 6px)", right: 0, minWidth: 210, padding: 6, boxShadow: "var(--shadow)" }}>
          {onManual && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => { setMenuOpen(false); onManual(); }}
            >
              <Plus size={14} /> Manual Entry
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => { setMenuOpen(false); setMode("bulk"); }}
          >
            <Type size={14} /> Bulk / Raw Data
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => { setMenuOpen(false); setMode("scan"); }}
          >
            <ScanLine size={14} /> Scan Image(s)
          </button>
          <a
            href={`/dashboard/import-history?module=${entityType}`}
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
          >
            <History size={14} /> Import History
          </a>
        </div>
      )}

      {mode && (
        <SmartIntakeModal
          entityType={entityType}
          isAcquisition={isAcquisition}
          mode={mode}
          onClose={() => setMode(null)}
          onBatchCreated={onBatchCreated}
          onAllDone={(res) => {
            // Everything actionable is processed: close the modal, refresh the
            // host list (already invalidated per create) and confirm briefly.
            setMode(null);
            setDoneNote(
              `${res.created_count} created${res.skipped_count ? `, ${res.skipped_count} skipped` : ""}.`,
            );
            window.setTimeout(() => setDoneNote(""), 8000);
          }}
        />
      )}
      {doneNote && (
        <div role="status" className="muted" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", whiteSpace: "nowrap", fontSize: 12 }}>
          {doneNote}
        </div>
      )}
    </div>
  );
}
