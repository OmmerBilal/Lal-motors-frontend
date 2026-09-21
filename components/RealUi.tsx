"use client";

import { AlertCircle, CheckCircle2, Inbox, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";

export function labelize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function money(value: string | number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function numberOrNull(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export function Message({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const tone = error ? "var(--danger)" : "var(--success)";
  return (
    <div
      className="card"
      style={{
        padding: "12px 14px",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: `color-mix(in srgb, ${tone} 8%, var(--panel))`,
        borderColor: `color-mix(in srgb, ${tone} 30%, var(--line))`,
      }}
    >
      {error
        ? <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
        : <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0 }} />}
      <span style={{ fontSize: 13, color: "var(--text)" }}>{error || success}</span>
    </div>
  );
}

export function LoadingRow({ columns, text = "Loading..." }: { columns: number; text?: string }) {
  return (
    <tr>
      <td colSpan={columns} style={{ padding: 34, textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
          <Loader2 className="spin" size={16} /> {text}
        </span>
      </td>
    </tr>
  );
}

export function EmptyRow({ columns, text = "No records found." }: { columns: number; text?: string }) {
  return (
    <tr>
      <td colSpan={columns} style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--muted)" }}>
          <Inbox size={22} strokeWidth={1.5} />
          <strong style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>{text}</strong>
        </div>
      </td>
    </tr>
  );
}

const STATUS_TONE: Record<string, "green" | "orange" | "red" | "blue"> = {
  active: "green", posted: "green", paid: "green", full: "green", fulfilled: "green",
  delivered: "green", completed: "green", in_stock: "green",   connected: "green",
  approved: "green", published: "green",
  pending: "orange", partial: "orange", partially_fulfilled: "orange", partially_paid: "orange",
  unpaid: "orange", on_hold: "orange", to_photograph: "orange", fully_reserved: "orange",
  not_connected: "orange", connected_pending_test: "orange", token_expired: "orange",
  permission_required: "orange", attention_required: "orange", "attention required": "orange",
  draft: "blue", confirmed: "blue", processing: "blue", submitted: "blue", in_production: "blue",
  reserved: "blue", incoming: "blue", listed: "blue", ready_to_list: "blue",
  cancelled: "red", void: "red", failed: "red", returned: "red", refunded: "red",
  scrapped: "red", closed: "red", inactive: "red", out_of_stock: "red",
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const tone = STATUS_TONE[(value || "").toLowerCase()] || "";
  return <span className={`badge ${tone}`}>{labelize(value)}</span>;
}

export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  width = 880,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="record-modal card"
        style={{ width: `min(${width}px, 100%)` }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h3 style={{ margin: "5px 0 0", fontSize: 22 }}>{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  max,
  step,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={`${o.value}-${o.label}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="form-full">
      <label className="form-label">{label}</label>
      <textarea
        className="textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

export function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span></div>
      <div className="metric-value">{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export function DetailGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="form-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <label className="form-label">{label}</label>
          <div className="record-value">{value ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export function GlobalSpinStyle() {
  return (
    <style jsx global>{`
      .spin { animation: lal-spin .85s linear infinite; }
      @keyframes lal-spin { to { transform: rotate(360deg); } }
    `}</style>
  );
}
