"use client";

import {
  ArrowRightLeft,
  Boxes,
  ClipboardCheck,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { StatusBadge } from "@/components/RealUi";
import { ApiError, CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type InventoryRow = {
  business_unit_id: string;
  item_id: string;
  item_type: string;
  item_code: string;
  sku: string | null;
  name: string;
  inventory_status: string;
  storage_location_id: string;
  location_code: string;
  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  quantity_available: string | number;
  unit_cost: string | number;
  inventory_value: string | number;
};

type InventoryList = {
  total: number;
  offset: number;
  limit: number;
  items: InventoryRow[];
};

type Valuation = {
  item_type: string;
  distinct_items: number;
  total_quantity: string | number;
  total_inventory_value: string | number;
};

type ItemLookup = {
  id: string;
  item_type: string;
  item_code: string;
  sku: string | null;
  name: string;
  inventory_status: string;
};

type Location = {
  id: string;
  business_unit_id: string;
  parent_location_id: string | null;
  location_code: string;
  name: string | null;
  location_type: string;
  operational_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Movement = {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  movement_type: string;
  from_location_id: string | null;
  from_location_code: string | null;
  to_location_id: string | null;
  to_location_code: string | null;
  quantity: string | number;
  unit_cost: string | number | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by_user_id: string | null;
  occurred_at: string;
};

type MovementList = {
  total: number;
  offset: number;
  limit: number;
  items: Movement[];
};

type Operation =
  | "transfer"
  | "reserve"
  | "release"
  | "adjust"
  | null;

function money(value: string | number | null) {
  if (value === null || value === "") return "—";
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function labelize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stockStatus(row: InventoryRow): string {
  if (Number(row.quantity_on_hand) <= 0) return "out_of_stock";
  if (Number(row.quantity_available) <= 0) return "fully_reserved";
  return "in_stock";
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [items, setItems] = useState<ItemLookup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [operation, setOperation] = useState<Operation>(null);
  const [selectedItem, setSelectedItem] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [newQuantity, setNewQuantity] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isManager = useMemo(() => {
    const roles = new Set(
      (user?.roles || []).map((role) => role.toLowerCase()),
    );
    return roles.has("manager") || roles.has("administrator");
  }, [user]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (typeFilter) params.set("item_type", typeFilter);
      if (locationFilter) params.set("location_id", locationFilter);
      params.set("limit", "300");

      const result = await apiFetch<InventoryList>(
        `/inventory?${params.toString()}`,
      );
      setRows(result.items);
    } catch (err: any) {
      setError(err?.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, locationFilter]);

  async function loadSupporting() {
    try {
      const [
        valuationData,
        itemData,
        locationData,
        movementData,
        currentUser,
      ] = await Promise.all([
        apiFetch<Valuation[]>("/inventory/valuation"),
        apiFetch<ItemLookup[]>("/inventory/lookups/items?limit=300"),
        apiFetch<Location[]>("/inventory/locations"),
        apiFetch<MovementList>("/inventory/movements?limit=30"),
        getCurrentUser(),
      ]);

      setValuations(valuationData);
      setItems(itemData);
      setLocations(locationData);
      setMovements(movementData.items);
      setUser(currentUser);
    } catch (err: any) {
      setError(err?.message || "Unable to load inventory supporting data.");
    }
  }

  useEffect(() => {
    loadSupporting();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadInventory, 250);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  const totalValue = valuations.reduce(
    (sum, row) => sum + Number(row.total_inventory_value || 0),
    0,
  );
  const totalQty = valuations.reduce(
    (sum, row) => sum + Number(row.total_quantity || 0),
    0,
  );

  function beginOperation(op: Operation, row?: InventoryRow) {
    setOperation(op);
    setSelectedItem(row?.item_id || "");
    setFromLocation(
      op === "transfer" || op === "reserve" || op === "release"
        ? row?.storage_location_id || ""
        : "",
    );
    setToLocation("");
    setQuantity("1");
    setNewQuantity(
      row ? String(row.quantity_on_hand ?? "0") : "0",
    );
    setUnitCost("");
    setReason("");
    setError("");
    setSuccess("");
  }

  async function submitOperation(e: FormEvent) {
    e.preventDefault();
    if (!operation) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (operation === "transfer") {
        await apiFetch("/inventory/transfer", {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItem,
            from_location_id: fromLocation,
            to_location_id: toLocation,
            quantity: Number(quantity),
            reference_type: "dashboard",
            notes: "Transferred from Lal Motors dashboard",
          }),
        });
      }

      if (operation === "reserve" || operation === "release") {
        await apiFetch(`/inventory/${operation}`, {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItem,
            storage_location_id: fromLocation,
            quantity: Number(quantity),
            reference_type: "dashboard",
            notes: `${labelize(operation)} from Lal Motors dashboard`,
          }),
        });
      }

      if (operation === "adjust") {
        await apiFetch("/inventory/adjust", {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItem,
            storage_location_id: fromLocation,
            new_quantity_on_hand: Number(newQuantity),
            unit_cost:
              unitCost.trim() === "" ? null : Number(unitCost),
            reason,
          }),
        });
      }

      setSuccess(`${labelize(operation)} completed successfully.`);
      await Promise.all([loadInventory(), loadSupporting()]);

      window.setTimeout(() => {
        setOperation(null);
        setSuccess("");
      }, 650);
    } catch (err: any) {
      setError(err?.message || "Inventory operation failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Operations</div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-copy">
            Live stock, locations, movements, reservations and valuation.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() =>
              Promise.all([loadInventory(), loadSupporting()])
            }
          >
            <RefreshCw size={15} /> Refresh
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => beginOperation("transfer")}
          >
            <ArrowRightLeft size={15} /> Transfer
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric
          icon={<Boxes size={16} />}
          label="Inventory Rows"
          value={rows.length}
        />
        <Metric
          icon={<ClipboardCheck size={16} />}
          label="Total Quantity"
          value={Number(totalQty.toFixed(3))}
        />
        <Metric
          icon={<ShieldCheck size={16} />}
          label="Inventory Value"
          value={money(totalValue)}
        />
        <Metric
          icon={<MapPin size={16} />}
          label="Active Locations"
          value={
            locations.filter(
              (location) => location.operational_status === "active",
            ).length
          }
        />
      </div>

      <Message error={error} success={success} />

      <section className="records-section">
        <div className="records-toolbar card">
          <div>
            <div style={{ fontWeight: 850 }}>Current Inventory</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              All stock balances across all storage locations, including items at zero quantity.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div className="records-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Item, SKU, location..."
              />
            </div>

            <select
              className="select"
              style={{ width: 150 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All item types</option>
              <option value="vehicle">Vehicle</option>
              <option value="used_part">Used Part</option>
              <option value="new_item">New Item</option>
            </select>

            <select
              className="select"
              style={{ width: 165 }}
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.location_code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Location</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
                <th>Unit Cost</th>
                <th>Value</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: 35, textAlign: "center" }}>
                    <Loader2 size={16} className="spin" /> Loading inventory...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 35, textAlign: "center" }}>
                    No stock found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.item_id}-${row.storage_location_id}`}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{row.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {row.item_code}
                        {row.sku ? ` · ${row.sku}` : ""}
                      </div>
                    </td>
                    <td>{labelize(row.item_type)}</td>
                    <td>{row.location_code}</td>
                    <td>{Number(row.quantity_on_hand)}</td>
                    <td>{Number(row.quantity_reserved)}</td>
                    <td>{Number(row.quantity_available)}</td>
                    <td>
                      <StatusBadge value={stockStatus(row)} />
                    </td>
                    <td>{money(row.unit_cost)}</td>
                    <td>{money(row.inventory_value)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "6px 8px", fontSize: 11 }}
                          onClick={() => beginOperation("transfer", row)}
                        >
                          Transfer
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "6px 8px", fontSize: 11 }}
                          onClick={() => beginOperation("reserve", row)}
                        >
                          Reserve
                        </button>
                        {Number(row.quantity_reserved) > 0 && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "6px 8px", fontSize: 11 }}
                            onClick={() => beginOperation("release", row)}
                          >
                            Release
                          </button>
                        )}
                        {isManager && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "6px 8px", fontSize: 11 }}
                            onClick={() => beginOperation("adjust", row)}
                          >
                            Adjust
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div>
            <h3 style={{ margin: 0 }}>Recent Inventory Movements</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Latest 30 stock events.
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Quantity</th>
                <th>Occurred</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 28, textAlign: "center" }}>
                    No movements yet.
                  </td>
                </tr>
              ) : (
                movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.item_name}</td>
                    <td>
                      <span className="badge">
                        {labelize(movement.movement_type)}
                      </span>
                    </td>
                    <td>{movement.from_location_code || "—"}</td>
                    <td>{movement.to_location_code || "—"}</td>
                    <td>{Number(movement.quantity)}</td>
                    <td>
                      {new Date(movement.occurred_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {operation && (
        <div
          className="modal-backdrop"
          onMouseDown={() => !saving && setOperation(null)}
        >
          <div
            className="record-modal card"
            style={{ width: "min(620px, 100%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">Inventory Operation</div>
                <h3 style={{ margin: "5px 0 0", fontSize: 22 }}>
                  {labelize(operation)}
                </h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => setOperation(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitOperation}>
              <div className="form-grid">
                <div className="form-full">
                  <label className="form-label">Item</label>
                  <select
                    className="select"
                    value={selectedItem}
                    onChange={(e) =>
                      setSelectedItem(e.target.value)
                    }
                    required
                  >
                    <option value="">Select item...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_code} — {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                {(operation === "transfer" ||
                  operation === "reserve" ||
                  operation === "release" ||
                  operation === "adjust") && (
                  <div>
                    <label className="form-label">
                      {operation === "transfer"
                        ? "From Location"
                        : "Storage Location"}
                    </label>
                    <select
                      className="select"
                      value={fromLocation}
                      onChange={(e) =>
                        setFromLocation(e.target.value)
                      }
                      required
                    >
                      <option value="">Select location...</option>
                      {locations.map((location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.location_code}
                          {location.name
                            ? ` — ${location.name}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {operation === "transfer" && (
                  <div>
                    <label className="form-label">To Location</label>
                    <select
                      className="select"
                      value={toLocation}
                      onChange={(e) =>
                        setToLocation(e.target.value)
                      }
                      required
                    >
                      <option value="">Select location...</option>
                      {locations.map((location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.location_code}
                          {location.name
                            ? ` — ${location.name}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {operation !== "adjust" && (
                  <div>
                    <label className="form-label">Quantity</label>
                    <input
                      className="input"
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                  </div>
                )}

                {operation === "adjust" && (
                  <div>
                    <label className="form-label">
                      New Quantity On Hand
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.001"
                      min="0"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      required
                    />
                  </div>
                )}

                {operation === "adjust" && (
                  <div>
                    <label className="form-label">
                      Unit Cost (optional)
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                    />
                  </div>
                )}

                {operation === "adjust" && (
                  <div className="form-full">
                    <label className="form-label">Reason</label>
                    <textarea
                      className="textarea"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      placeholder="Physical count correction, damage, etc."
                    />
                  </div>
                )}
              </div>

              <Message error={error} success={success} compact />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOperation(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="spin" /> Saving...
                    </>
                  ) : (
                    `Confirm ${labelize(operation)}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .spin {
          animation: lal-spin 0.9s linear infinite;
        }
        @keyframes lal-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        Live database data
      </div>
    </div>
  );
}

function Message({
  error,
  success,
  compact = false,
}: {
  error: string;
  success: string;
  compact?: boolean;
}) {
  if (!error && !success) return null;

  return (
    <div
      className={compact ? "" : "card"}
      style={{
        padding: 12,
        marginTop: compact ? 14 : 0,
        marginBottom: compact ? 0 : 14,
        color: error ? "var(--danger)" : "var(--success)",
      }}
    >
      {error || success}
    </div>
  );
}
