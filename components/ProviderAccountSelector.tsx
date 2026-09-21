"use client";

export type ProviderAccountOption = {
  id: string;
  display_name?: string | null;
  account_name: string;
  shop_domain?: string | null;
  status?: string;
};

export function accountLabel(account: ProviderAccountOption) {
  return account.display_name || account.account_name || account.shop_domain || "Store";
}

export function ProviderAccountSelector({
  accounts,
  value,
  onChange,
  requireSelection = false,
  disabled = false,
  label,
}: {
  accounts: ProviderAccountOption[];
  value: string;
  onChange: (id: string) => void;
  requireSelection?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  if (accounts.length === 0) return null;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
      {label && <span className="muted" style={{ fontSize: 12 }}>{label}</span>}
      <select
        className="select"
        style={{ width: 220 }}
        value={value}
        disabled={disabled}
        aria-label={label || "Select store"}
        onChange={(e) => onChange(e.target.value)}
      >
        {(requireSelection || accounts.length > 1) && !value && <option value="">{label ? `Select ${label.toLowerCase()}` : "Select a store"}</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {accountLabel(account)}
          </option>
        ))}
      </select>
    </label>
  );
}
