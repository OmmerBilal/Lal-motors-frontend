"use client";

import {
  Archive,
  Boxes,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { RequirePermission } from "@/components/RequirePermission";
import { ApiError, apiFetch } from "@/lib/api";

type UsedPart = {
  id: string;
  item_code: string;
  sku: string | null;
  name: string;
  description: string | null;

  category_id: string | null;
  category_name: string | null;

  condition: string | null;
  inventory_status: string;

  default_cost: string | number | null;
  default_selling_price: string | number | null;
  minimum_selling_price: string | number | null;
  currency_code: string;
  barcode_qr: string | null;
  notes: string | null;

  source_vehicle_id: string | null;
  source_vehicle_name: string | null;
  source_vehicle_vin: string | null;
  source_vehicle_stock_number: string | null;

  oem_part_number: string | null;
  interchange_number: string | null;
  tested_status: string;
  source_vehicle_notes: string | null;

  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  quantity_available: string | number;

  storage_location_id: string | null;
  location_code: string | null;
  storage_location_name: string | null;
  average_unit_cost: string | number | null;

  fitments: Array<{
    id: string;
    make_id: string | null;
    make_name: string | null;
    model_id: string | null;
    model_name: string | null;
    year_from: number | null;
    year_to: number | null;
    engine: string | null;
    trim: string | null;
    notes: string | null;
  }>;

  created_at: string;
  updated_at: string;
};

type UsedPartList = {
  total: number;
  offset: number;
  limit: number;
  items: UsedPart[];
};

type Category = {
  id: string;
  name: string;
  applies_to: string | null;
};

type SourceVehicle = {
  id: string;
  name: string;
  vin: string | null;
  stock_number: string | null;
  year: number | null;
  make_name: string | null;
  model_name: string | null;
};

type Location = {
  id: string;
  location_code: string;
  name: string | null;
  location_type: string;
  operational_status: string;
};

type Mode = "create" | "view" | "edit" | null;

type FormState = {
  name: string;
  sku: string;
  description: string;
  category_id: string;
  condition: string;
  inventory_status: string;
  default_cost: string;
  default_selling_price: string;
  minimum_selling_price: string;
  oem_part_number: string;
  interchange_number: string;
  tested_status: string;
  source_vehicle_id: string;
  source_vehicle_notes: string;
  storage_location_id: string;
  quantity_on_hand: string;
  average_unit_cost: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  sku: "",
  description: "",
  category_id: "",
  condition: "Used",
  inventory_status: "in_stock",
  default_cost: "",
  default_selling_price: "",
  minimum_selling_price: "",
  oem_part_number: "",
  interchange_number: "",
  tested_status: "unknown",
  source_vehicle_id: "",
  source_vehicle_notes: "",
  storage_location_id: "",
  quantity_on_hand: "0",
  average_unit_cost: "",
  notes: "",
};

const statuses = [
  "draft",
  "incoming",
  "in_stock",
  "to_photograph",
  "ready_to_list",
  "listed",
  "reserved",
  "on_hold",
  "sold",
  "scrapped",
  "archived",
];

function labelize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function numeric(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function money(value: string | number | null) {
  if (value === null || value === "") return "—";
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function partToForm(part: UsedPart): FormState {
  return {
    name: part.name || "",
    sku: part.sku || "",
    description: part.description || "",
    category_id: part.category_id || "",
    condition: part.condition || "Used",
    inventory_status: part.inventory_status || "in_stock",
    default_cost:
      part.default_cost !== null ? String(part.default_cost) : "",
    default_selling_price:
      part.default_selling_price !== null
        ? String(part.default_selling_price)
        : "",
    minimum_selling_price:
      part.minimum_selling_price !== null
        ? String(part.minimum_selling_price)
        : "",
    oem_part_number: part.oem_part_number || "",
    interchange_number: part.interchange_number || "",
    tested_status: part.tested_status || "unknown",
    source_vehicle_id: part.source_vehicle_id || "",
    source_vehicle_notes: part.source_vehicle_notes || "",
    storage_location_id: part.storage_location_id || "",
    quantity_on_hand: String(part.quantity_on_hand || 0),
    average_unit_cost:
      part.average_unit_cost !== null
        ? String(part.average_unit_cost)
        : "",
    notes: part.notes || "",
  };
}

function UsedPartsPage() {
  const [parts, setParts] = useState<UsedPart[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [vehicles, setVehicles] = useState<SourceVehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<UsedPart | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("inventory_status", statusFilter);
      if (categoryFilter) params.set("category_id", categoryFilter);
      params.set("include_archived", String(includeArchived));
      params.set("limit", "200");

      const result = await apiFetch<UsedPartList>(
        `/used-parts?${params.toString()}`,
      );
      setParts(result.items);
      setTotal(result.total);
    } catch (err: any) {
      setError(err?.message || "Unable to load used parts.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, includeArchived]);

  async function loadLookups() {
    try {
      const [categoryData, vehicleData, locationData] =
        await Promise.all([
          apiFetch<Category[]>("/used-parts/lookups/categories"),
          apiFetch<SourceVehicle[]>(
            "/used-parts/lookups/source-vehicles",
          ),
          apiFetch<Location[]>(
            "/used-parts/lookups/storage-locations",
          ),
        ]);

      setCategories(categoryData);
      setVehicles(vehicleData);
      setLocations(locationData);
    } catch (err: any) {
      setError(err?.message || "Unable to load used-part lookups.");
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadParts, 250);
    return () => window.clearTimeout(timer);
  }, [loadParts]);

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setMode("create");
  }

  async function openExisting(part: UsedPart, targetMode: "view" | "edit") {
    setMode(targetMode);
    setDetailLoading(true);
    setError("");

    try {
      const detail = await apiFetch<UsedPart>(
        `/used-parts/${part.id}`,
      );
      setSelected(detail);
      setForm(partToForm(detail));
    } catch (err: any) {
      setError(err?.message || "Unable to load part details.");
      setMode(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function setField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (mode !== "create" && mode !== "edit") return;

    setSaving(true);
    setError("");
    setSuccess("");

    const common = {
      name: form.name,
      sku: form.sku || null,
      description: form.description || null,
      category_id: form.category_id || null,
      condition: form.condition || null,
      inventory_status: form.inventory_status,
      default_cost: numeric(form.default_cost),
      default_selling_price: numeric(form.default_selling_price),
      minimum_selling_price: numeric(form.minimum_selling_price),
      oem_part_number: form.oem_part_number || null,
      interchange_number: form.interchange_number || null,
      tested_status: form.tested_status,
      source_vehicle_id: form.source_vehicle_id || null,
      source_vehicle_notes: form.source_vehicle_notes || null,
      notes: form.notes || null,
    };

    try {
      if (mode === "create") {
        await apiFetch<UsedPart>("/used-parts", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            storage_location_id: form.storage_location_id || null,
            quantity_on_hand: Number(form.quantity_on_hand || 0),
            average_unit_cost: numeric(form.average_unit_cost),
            fitments: [],
          }),
        });

        setSuccess("Used part created successfully.");
      } else if (selected) {
        await apiFetch<UsedPart>(`/used-parts/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(common),
        });

        setSuccess("Used part updated successfully.");
      }

      await loadParts();
      window.setTimeout(() => {
        setMode(null);
        setSelected(null);
        setSuccess("");
      }, 650);
    } catch (err: any) {
      setError(err?.message || "Unable to save used part.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(part: UsedPart) {
    if (
      !window.confirm(
        `Archive ${part.name}? This preserves history but removes active stock.`,
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await apiFetch(`/used-parts/${part.id}`, {
        method: "DELETE",
      });
      setSuccess(`${part.name} archived successfully.`);
      await loadParts();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(
          "Only a Manager or Administrator can archive used parts.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to archive used part.",
        );
      }
    }
  }

  const totalAvailable = useMemo(
    () =>
      parts.reduce(
        (sum, part) => sum + Number(part.quantity_available || 0),
        0,
      ),
    [parts],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Catalog</div>
          <h1 className="page-title">Used Parts</h1>
          <p className="page-copy">
            Real used-part catalog and inventory data from PostgreSQL.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => loadParts()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Used Part
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Total Parts" value={total} />
        <Metric label="Visible Results" value={parts.length} />
        <Metric
          label="Available Qty"
          value={Number(totalAvailable.toFixed(3))}
        />
        <Metric
          label="In Stock"
          value={
            parts.filter((part) => part.inventory_status === "in_stock")
              .length
          }
        />
      </div>

      <Message error={error} success={success} />

      <section className="records-section">
        <div className="records-toolbar card">
          <div>
            <div style={{ fontWeight: 850 }}>All Used Parts</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              Search and manage the real used-parts catalog.
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
                placeholder="Name, SKU, OEM, interchange..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="select"
              style={{ width: 160 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              className="select"
              style={{ width: 155 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {labelize(status)}
                </option>
              ))}
            </select>

            <label className="badge" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) =>
                  setIncludeArchived(e.target.checked)
                }
              />
              Archived
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Part</th>
                <th>OEM / Interchange</th>
                <th>Category</th>
                <th>Source Vehicle</th>
                <th>Available</th>
                <th>Location</th>
                <th>Price</th>
                <th>Status</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <LoadingRow columns={9} text="Loading used parts..." />
              ) : parts.length === 0 ? (
                <EmptyRow columns={9} text="No used parts found." />
              ) : (
                parts.map((part) => (
                  <tr key={part.id}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{part.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {part.item_code}
                        {part.sku ? ` · ${part.sku}` : ""}
                      </div>
                    </td>
                    <td>
                      <div>{part.oem_part_number || "—"}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {part.interchange_number || ""}
                      </div>
                    </td>
                    <td>{part.category_name || "—"}</td>
                    <td>
                      {part.source_vehicle_name ||
                        part.source_vehicle_stock_number ||
                        "—"}
                    </td>
                    <td>{Number(part.quantity_available || 0)}</td>
                    <td>
                      {part.location_code ||
                        part.storage_location_name ||
                        "Unassigned"}
                    </td>
                    <td>{money(part.default_selling_price)}</td>
                    <td>
                      <span className="badge">
                        {labelize(part.inventory_status)}
                      </span>
                    </td>
                    <td>
                      <div className="record-actions">
                        <button
                          className="record-action view"
                          title="View"
                          onClick={() => openExisting(part, "view")}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="record-action edit"
                          title="Edit"
                          onClick={() => openExisting(part, "edit")}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="record-action delete"
                          title="Archive"
                          disabled={
                            part.inventory_status === "archived"
                          }
                          onClick={() => archive(part)}
                        >
                          <Archive size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {mode && (
        <div
          className="modal-backdrop"
          onMouseDown={() => !saving && setMode(null)}
        >
          <div
            className="record-modal card"
            style={{ width: "min(900px, 100%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  {mode === "create"
                    ? "New Used Part"
                    : mode === "edit"
                      ? "Edit Used Part"
                      : "Used Part Details"}
                </div>
                <h3 style={{ margin: "5px 0 0", fontSize: 22 }}>
                  {mode === "create"
                    ? "Add used part"
                    : selected?.name || "Loading..."}
                </h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => setMode(null)}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 35, textAlign: "center" }}>
                <Loader2 size={20} className="spin" /> Loading...
              </div>
            ) : mode === "view" && selected ? (
              <PartDetails part={selected} />
            ) : (
              <form onSubmit={save}>
                <div className="form-grid">
                  <TextField
                    label="Part Name"
                    value={form.name}
                    setValue={(v) => setField("name", v)}
                    required
                  />
                  <TextField
                    label="SKU"
                    value={form.sku}
                    setValue={(v) => setField("sku", v)}
                  />

                  <div>
                    <label className="form-label">Category</label>
                    <select
                      className="select"
                      value={form.category_id}
                      onChange={(e) =>
                        setField("category_id", e.target.value)
                      }
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <TextField
                    label="Condition"
                    value={form.condition}
                    setValue={(v) => setField("condition", v)}
                  />

                  <TextField
                    label="OEM Part Number"
                    value={form.oem_part_number}
                    setValue={(v) =>
                      setField("oem_part_number", v)
                    }
                  />

                  <TextField
                    label="Interchange Number"
                    value={form.interchange_number}
                    setValue={(v) =>
                      setField("interchange_number", v)
                    }
                  />

                  <div>
                    <label className="form-label">Tested Status</label>
                    <select
                      className="select"
                      value={form.tested_status}
                      onChange={(e) =>
                        setField("tested_status", e.target.value)
                      }
                    >
                      <option value="unknown">Unknown</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Inventory Status</label>
                    <select
                      className="select"
                      value={form.inventory_status}
                      onChange={(e) =>
                        setField("inventory_status", e.target.value)
                      }
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <TextField
                    label="Default Cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.default_cost}
                    setValue={(v) => setField("default_cost", v)}
                  />

                  <TextField
                    label="Selling Price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.default_selling_price}
                    setValue={(v) =>
                      setField("default_selling_price", v)
                    }
                  />

                  <TextField
                    label="Minimum Selling Price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minimum_selling_price}
                    setValue={(v) =>
                      setField("minimum_selling_price", v)
                    }
                  />

                  <div>
                    <label className="form-label">Source Vehicle</label>
                    <select
                      className="select"
                      value={form.source_vehicle_id}
                      onChange={(e) =>
                        setField("source_vehicle_id", e.target.value)
                      }
                    >
                      <option value="">No source vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name}
                          {vehicle.stock_number
                            ? ` · ${vehicle.stock_number}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {mode === "create" ? (
                    <>
                      <div>
                        <label className="form-label">
                          Initial Storage Location
                        </label>
                        <select
                          className="select"
                          value={form.storage_location_id}
                          onChange={(e) =>
                            setField(
                              "storage_location_id",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Unassigned</option>
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

                      <TextField
                        label="Initial Quantity"
                        type="number"
                        step="0.001"
                        min="0"
                        value={form.quantity_on_hand}
                        setValue={(v) =>
                          setField("quantity_on_hand", v)
                        }
                      />

                      <TextField
                        label="Average Unit Cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.average_unit_cost}
                        setValue={(v) =>
                          setField("average_unit_cost", v)
                        }
                      />
                    </>
                  ) : (
                    <div className="form-full">
                      <div
                        className="card"
                        style={{ padding: 12, fontSize: 12 }}
                      >
                        Inventory quantity/location are changed from the
                        Inventory module so stock history stays auditable.
                      </div>
                    </div>
                  )}

                  <div className="form-full">
                    <label className="form-label">Description</label>
                    <textarea
                      className="textarea"
                      value={form.description}
                      onChange={(e) =>
                        setField("description", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-full">
                    <label className="form-label">
                      Source Vehicle Notes
                    </label>
                    <textarea
                      className="textarea"
                      value={form.source_vehicle_notes}
                      onChange={(e) =>
                        setField(
                          "source_vehicle_notes",
                          e.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="form-full">
                    <label className="form-label">Internal Notes</label>
                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(e) =>
                        setField("notes", e.target.value)
                      }
                    />
                  </div>
                </div>

                <Message error={error} success={success} compact />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMode(null)}
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
                    ) : mode === "create" ? (
                      "Create Part"
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <SpinStyle />
    </>
  );
}

function PartDetails({ part }: { part: UsedPart }) {
  const details = [
    ["Item Code", part.item_code],
    ["SKU", part.sku],
    ["Category", part.category_name],
    ["Condition", part.condition],
    ["OEM Number", part.oem_part_number],
    ["Interchange", part.interchange_number],
    ["Tested", labelize(part.tested_status)],
    ["Source Vehicle", part.source_vehicle_name],
    ["Source VIN", part.source_vehicle_vin],
    ["Quantity On Hand", part.quantity_on_hand],
    ["Reserved", part.quantity_reserved],
    ["Available", part.quantity_available],
    [
      "Storage",
      part.location_code || part.storage_location_name || "Unassigned",
    ],
    ["Selling Price", money(part.default_selling_price)],
    ["Notes", part.notes],
  ];

  return (
    <>
      <div className="form-grid">
        {details.map(([label, value]) => (
          <div key={String(label)}>
            <label className="form-label">{label}</label>
            <div className="record-value">
              {value === null || value === "" ? "—" : String(value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="form-label">Fitments</div>
        {part.fitments.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            No fitments recorded.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {part.fitments.map((fitment) => (
              <div className="card" style={{ padding: 10 }} key={fitment.id}>
                {fitment.make_name || "Any make"}{" "}
                {fitment.model_name || ""}
                {fitment.year_from
                  ? ` · ${fitment.year_from}${
                      fitment.year_to
                        ? `–${fitment.year_to}`
                        : ""
                    }`
                  : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Boxes size={16} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        Live database data
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  setValue,
  type = "text",
  step,
  min,
  required,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  step?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        step={step}
        min={min}
        required={required}
      />
    </div>
  );
}

function LoadingRow({
  columns,
  text,
}: {
  columns: number;
  text: string;
}) {
  return (
    <tr>
      <td colSpan={columns}>
        <div style={{ padding: 35, textAlign: "center" }} className="muted">
          <Loader2 size={16} className="spin" /> {text}
        </div>
      </td>
    </tr>
  );
}

function EmptyRow({
  columns,
  text,
}: {
  columns: number;
  text: string;
}) {
  return (
    <tr>
      <td colSpan={columns}>
        <div style={{ padding: 35, textAlign: "center" }}>
          <strong>{text}</strong>
        </div>
      </td>
    </tr>
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

function SpinStyle() {
  return (
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
  );
}

export default function Page() {
  return (
    <RequirePermission perm="used_parts.view">
      <UsedPartsPage />
    </RequirePermission>
  );
}
