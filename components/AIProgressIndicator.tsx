"use client";

import { Check, Loader2 } from "lucide-react";

import type { AIProgressState } from "@/lib/hooks/useAIProgress";

// Shared progress display for every AI operation. Shows the real current
// stage prominently, completed stages subtly, and "n of m" only when the
// backend actually reported a total. No fake percentages: an unknown-length
// provider call just shows its truthful stage text.
export function AIProgressIndicator({
  progress,
  onCancel,
  compact = false,
}: {
  progress: AIProgressState;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const showCount = progress.total !== null && progress.total > 0 && progress.current !== null;
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {!compact &&
        progress.history.slice(-3).map((step) => (
          <div key={step} className="muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", opacity: 0.7 }}>
            <Check size={12} />
            {step}
          </div>
        ))}
      <div className="muted" style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
        <Loader2 size={14} className="spin" />
        <span>{progress.message || "Working…"}</span>
        {showCount && (
          <span style={{ opacity: 0.8 }}>
            ({progress.current} of {progress.total})
          </span>
        )}
        {onCancel && (
          <button type="button" className="btn btn-secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
