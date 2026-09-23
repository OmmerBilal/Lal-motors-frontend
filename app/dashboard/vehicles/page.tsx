"use client";

import {
  Archive,
  CarFront,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Message, Modal, SelectField } from "@/components/RealUi";
import { RequirePermission } from "@/components/RequirePermission";
import { VehicleWorkEntryForm } from "@/components/VehicleWorkEntryForm";
import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type Vehicle = {
  id: string;
  item_code: string;
  sku: string | null;
  name: string;
  description: string | null;
  condition: string | null;
  inventory_status: string;
  default_cost: string | number | null;
  default_selling_price: string | number | null;
  minimum_selling_price: string | number | null;
  currency_code: string;
  notes: string | null;

  vin: string | null;
  stock_number: string | null;
  lot_number: string | null;
  registration: string | null;
  year: number | null;
  make_id: string | null;
  make_name: string | null;
  model_id: string | null;
  model_name: string | null;
  trim: string | null;
  color: string | null;
  engine: string | null;
  transmission: string | null;
  fuel_type: string | null;
  mileage: number | null;
  purchase_price: string | number | null;
  purchase_date: string | null;
  acquisition_source: string | null;
  vehicle_process_status: string;
  dismantled_at: string | null;

  storage_location_id: string | null;
  location_code: string | null;
  storage_location_name: string | null;
  quantity_on_hand: string | number | null;
  quantity_reserved: string | number | null;

  created_at: string;
  updated_at: string;
};

type VehicleListResponse = {
  total: number;
  offset: number;
  limit: number;
  items: Vehicle[];
};

type VehicleMake = {
  id: string;
  name: string;
};

type VehicleModel = {
  id: string;
  make_id: string;
  name: string;
};

type StorageLocation = {
  id: string;
  location_code: string;
  name: string | null;
  location_type: string;
  operational_status: string;
};

type Mode = "create" | "view" | "edit" | null;

type VehicleForm = {
  name: string;
  vin: string;
  stock_number: string;
  lot_number: string;
  registration: string;
  year: string;
  make_name: string;
  model_name: string;
  trim: string;
  color: string;
  engine: string;
  transmission: string;
  fuel_type: string;
  mileage: string;
  purchase_price: string;
  purchase_date: string;
  default_selling_price: string;
  minimum_selling_price: string;
  condition: string;
  inventory_status: string;
  vehicle_process_status: string;
  storage_location_id: string;
  acquisition_source: string;
  notes: string;
};

const emptyForm: VehicleForm = {
  name: "",
  vin: "",
  stock_number: "",
  lot_number: "",
  registration: "",
  year: "",
  make_name: "",
  model_name: "",
  trim: "",
  color: "",
  engine: "",
  transmission: "",
  fuel_type: "",
  mileage: "",
  purchase_price: "",
  purchase_date: "",
  default_selling_price: "",
  minimum_selling_price: "",
  condition: "Used",
  inventory_status: "in_stock",
  vehicle_process_status: "in_inventory",
  storage_location_id: "",
  acquisition_source: "",
  notes: "",
};

const inventoryStatuses = [
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

const processStatuses = [
  "incoming",
  "in_inventory",
  "awaiting_dismantle",
  "dismantled",
  "available_for_sale",
  "in_service",
  "sold",
  "scrapped",
];

function labelize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function optionalNumber(value: string) {
  if (value.trim() === "") return null;
  return Number(value);
}

function vehicleToForm(vehicle: Vehicle): VehicleForm {
  return {
    name: vehicle.name || "",
    vin: vehicle.vin || "",
    stock_number: vehicle.stock_number || "",
    lot_number: vehicle.lot_number || "",
    registration: vehicle.registration || "",
    year: vehicle.year ? String(vehicle.year) : "",
    make_name: vehicle.make_name || "",
    model_name: vehicle.model_name || "",
    trim: vehicle.trim || "",
    color: vehicle.color || "",
    engine: vehicle.engine || "",
    transmission: vehicle.transmission || "",
    fuel_type: vehicle.fuel_type || "",
    mileage:
      vehicle.mileage !== null ? String(vehicle.mileage) : "",
    purchase_price:
      vehicle.purchase_price !== null
        ? String(vehicle.purchase_price)
        : "",
    purchase_date: vehicle.purchase_date || "",
    default_selling_price:
      vehicle.default_selling_price !== null
        ? String(vehicle.default_selling_price)
        : "",
    minimum_selling_price:
      vehicle.minimum_selling_price !== null
        ? String(vehicle.minimum_selling_price)
        : "",
    condition: vehicle.condition || "Used",
    inventory_status: vehicle.inventory_status || "in_stock",
    vehicle_process_status:
      vehicle.vehicle_process_status || "in_inventory",
    storage_location_id: vehicle.storage_location_id || "",
    acquisition_source: vehicle.acquisition_source || "",
    notes: vehicle.notes || "",
  };
}

type VehicleTab = "active" | "incoming";

type IncomingVehicle = {
  id: string;
  item_code: string;
  name: string;
  vin: string | null;
  stock_number: string | null;
  year: number | null;
  make_name: string | null;
  model_name: string | null;
  purchase_date: string | null;
  purchase_price: string | number | null;
  auction_source: string | null;
  acquisition_status: string;
  source_document_file_id: string | null;
};

type IncomingVehicleListResponse = {
  total: number;
  items: IncomingVehicle[];
};

function VehiclesPage() {
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [vehicleTab, setVehicleTab] = useState<VehicleTab>("active");
  const [receiveTarget, setReceiveTarget] = useState<IncomingVehicle | null>(null);
  const [receiveDate, setReceiveDate] = useState("");
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveError, setReceiveError] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [showWorkEntryModal, setShowWorkEntryModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      inventory_status: statusFilter || undefined,
      include_archived: includeArchived,
    }),
    [debouncedSearch, statusFilter, includeArchived],
  );

  const vehiclesQuery = useQuery({
    queryKey: queryKeys.vehicles.list(listParams),
    queryFn: () => {
      const params = new URLSearchParams();
      if (listParams.search) params.set("search", listParams.search);
      if (listParams.inventory_status) params.set("inventory_status", listParams.inventory_status);
      params.set("include_archived", String(listParams.include_archived));
      params.set("limit", "200");
      return apiFetch<VehicleListResponse>(`/vehicles?${params.toString()}`);
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const vehicles = vehiclesQuery.data?.items ?? [];
  const total = vehiclesQuery.data?.total ?? 0;
  const loading = vehiclesQuery.isLoading;
  const loadVehicles = () => vehiclesQuery.refetch();

  const makesQuery = useQuery({
    queryKey: queryKeys.vehicles.makes(),
    queryFn: () => apiFetch<VehicleMake[]>("/vehicles/lookups/makes"),
    staleTime: 10 * 60 * 1000,
  });
  const makes = makesQuery.data ?? [];

  const locationsQuery = useQuery({
    queryKey: queryKeys.vehicles.locations(),
    queryFn: () => apiFetch<StorageLocation[]>("/vehicles/lookups/storage-locations"),
    staleTime: 5 * 60 * 1000,
  });
  const locations = locationsQuery.data ?? [];

  const matchedMake = useMemo(
    () =>
      makes.find(
        (make) =>
          make.name.toLowerCase() === form.make_name.toLowerCase(),
      ),
    [makes, form.make_name],
  );

  const modelsQuery = useQuery({
    queryKey: queryKeys.vehicles.models(matchedMake?.id ?? ""),
    queryFn: () => apiFetch<VehicleModel[]>(`/vehicles/lookups/models?make_id=${matchedMake!.id}`),
    enabled: !!matchedMake,
    staleTime: 10 * 60 * 1000,
  });
  const models = matchedMake ? modelsQuery.data ?? [] : [];

  const incomingParams = useMemo(
    () => ({ search: debouncedSearch.trim() || undefined }),
    [debouncedSearch],
  );

  const incomingQuery = useQuery({
    queryKey: queryKeys.vehicles.incoming(incomingParams),
    queryFn: () => {
      const params = new URLSearchParams();
      if (incomingParams.search) params.set("search", incomingParams.search);
      params.set("limit", "200");
      return apiFetch<IncomingVehicleListResponse>(`/vehicles/incoming?${params.toString()}`);
    },
    enabled: vehicleTab === "incoming",
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const incomingVehicles = incomingQuery.data?.items ?? [];

  function documentUrl(vehicleId: string, fileId: string) {
    return `${API_BASE_URL}/vehicles/${vehicleId}/documents/${fileId}`;
  }

  function openReceive(vehicle: IncomingVehicle) {
    setReceiveTarget(vehicle);
    setReceiveDate(new Date().toISOString().slice(0, 10));
    setReceiveLocationId(locations[0]?.id || "");
    setReceiveError("");
  }

  async function submitReceive(e: FormEvent) {
    e.preventDefault();
    if (!receiveTarget || !receiveLocationId) {
      setReceiveError("Choose a storage location.");
      return;
    }

    setReceiving(true);
    setReceiveError("");

    try {
      await apiFetch(`/vehicles/${receiveTarget.id}/mark-received`, {
        method: "POST",
        body: JSON.stringify({
          received_date: receiveDate || null,
          storage_location_id: receiveLocationId,
        }),
      });
      await invalidate(queryClient, ["vehicles", "inventory", "dashboard"]);
      setReceiveTarget(null);
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : "Unable to mark this vehicle as received.");
    } finally {
      setReceiving(false);
    }
  }

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setMode("create");
  }

  function openView(vehicle: Vehicle) {
    setSelected(vehicle);
    setForm(vehicleToForm(vehicle));
    setMode("view");
  }

  function openEdit(vehicle: Vehicle) {
    setSelected(vehicle);
    setForm(vehicleToForm(vehicle));
    setError("");
    setSuccess("");
    setMode("edit");
  }

  function closeModal() {
    if (saving) return;
    setMode(null);
    setSelected(null);
  }

  function setField<K extends keyof VehicleForm>(
    field: K,
    value: VehicleForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveVehicle(e: FormEvent) {
    e.preventDefault();

    if (mode !== "create" && mode !== "edit") return;

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name || null,
      vin: form.vin || null,
      stock_number: form.stock_number || null,
      lot_number: form.lot_number || null,
      registration: form.registration || null,
      year: optionalNumber(form.year),
      make_name: form.make_name || null,
      model_name: form.model_name || null,
      trim: form.trim || null,
      color: form.color || null,
      engine: form.engine || null,
      transmission: form.transmission || null,
      fuel_type: form.fuel_type || null,
      mileage: optionalNumber(form.mileage),
      purchase_price: optionalNumber(form.purchase_price),
      purchase_date: form.purchase_date || null,
      default_selling_price: optionalNumber(
        form.default_selling_price,
      ),
      minimum_selling_price: optionalNumber(
        form.minimum_selling_price,
      ),
      condition: form.condition || null,
      inventory_status: form.inventory_status,
      vehicle_process_status: form.vehicle_process_status,
      storage_location_id: form.storage_location_id || null,
      acquisition_source: form.acquisition_source || null,
      notes: form.notes || null,
    };

    try {
      if (mode === "create") {
        await apiFetch<Vehicle>("/vehicles", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setSuccess("Vehicle created successfully.");
      } else if (selected) {
        await apiFetch<Vehicle>(`/vehicles/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setSuccess("Vehicle updated successfully.");
      }

      await invalidate(queryClient, ["vehicles", "inventory", "dashboard"]);

      window.setTimeout(() => {
        setMode(null);
        setSelected(null);
        setSuccess("");
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Unable to save vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveVehicle(vehicle: Vehicle) {
    const confirmed = window.confirm(
      `Archive ${vehicle.name}? The record will be preserved in history and hidden from the normal vehicle list.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await apiFetch(`/vehicles/${vehicle.id}`, {
        method: "DELETE",
      });

      setSuccess(`${vehicle.name} archived successfully.`);
      await invalidate(queryClient, ["vehicles", "inventory", "dashboard"]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(
          "Only a Manager or Administrator can archive vehicles.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to archive vehicle.",
        );
      }
    }
  }

  const displayError = error || (vehiclesQuery.isError ? "Unable to load vehicles." : "");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Inventory</div>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-copy">
            Real vehicle records from the Lal Motors PostgreSQL database.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {has("vehicles.work.add") && (
            <button className="btn btn-secondary" onClick={() => setShowWorkEntryModal(true)}>
              <Wrench size={15} /> Vehicle Work
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => (vehicleTab === "active" ? loadVehicles() : incomingQuery.refetch())}
            disabled={vehicleTab === "active" ? loading : incomingQuery.isLoading}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Vehicle
          </button>
        </div>
      </div>

      {has("vehicles.acquisition.view") && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn ${vehicleTab === "active" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setVehicleTab("active")}
          >
            Active Vehicles
          </button>
          <button
            type="button"
            className={`btn ${vehicleTab === "incoming" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setVehicleTab("incoming")}
          >
            Incoming / In Transit
          </button>
        </div>
      )}

      {vehicleTab === "active" && (
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span>Total Vehicles</span>
            <span className="metric-icon">
              <CarFront size={17} />
            </span>
          </div>
          <div className="metric-value">{total}</div>
          <div className="metric-trend">Live database count</div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>Visible Results</span>
          </div>
          <div className="metric-value">{vehicles.length}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Current filters
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>In Stock</span>
          </div>
          <div className="metric-value">
            {
              vehicles.filter(
                (vehicle) => vehicle.inventory_status === "in_stock",
              ).length
            }
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Loaded records
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-top">
            <span>Ready / Listed</span>
          </div>
          <div className="metric-value">
            {
              vehicles.filter((vehicle) =>
                ["ready_to_list", "listed"].includes(
                  vehicle.inventory_status,
                ),
              ).length
            }
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Loaded records
          </div>
        </div>
      </div>
      )}

      {displayError && (
        <div
          className="card"
          style={{
            padding: 13,
            marginBottom: 14,
            borderColor:
              "color-mix(in srgb,var(--danger) 34%,var(--line))",
            color: "var(--danger)",
          }}
        >
          {displayError}
        </div>
      )}

      {success && (
        <div
          className="card"
          style={{
            padding: 13,
            marginBottom: 14,
            borderColor:
              "color-mix(in srgb,var(--success) 34%,var(--line))",
            color: "var(--success)",
          }}
        >
          {success}
        </div>
      )}

      {vehicleTab === "active" && (
      <section className="records-section">
        <div className="records-toolbar card">
          <div>
            <div style={{ fontWeight: 850 }}>All Vehicles</div>
            <div
              className="muted"
              style={{ fontSize: 12, marginTop: 3 }}
            >
              Search, view, edit and archive real records.
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
                placeholder="VIN, stock, make, model..."
              />
            </div>

            <select
              className="select"
              style={{ width: 170 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {inventoryStatuses.map((status) => (
                <option key={status} value={status}>
                  {labelize(status)}
                </option>
              ))}
            </select>

            <label
              className="badge"
              style={{ cursor: "pointer", userSelect: "none" }}
            >
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
                <th>Vehicle</th>
                <th>VIN</th>
                <th>Stock / Lot</th>
                <th>Year</th>
                <th>Mileage</th>
                <th>Location</th>
                <th>Status</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div
                      style={{
                        minHeight: 160,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <span
                        className="muted"
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Loader2 size={17} className="spin" />
                        Loading vehicles...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: 34,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        No vehicles found
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 13, marginTop: 5 }}
                      >
                        Change your filters or add a new vehicle.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <Link
                        href={`/dashboard/vehicles/${vehicle.id}`}
                        style={{ fontWeight: 800, color: "var(--text)" }}
                      >
                        {vehicle.name}
                      </Link>
                      <div
                        className="muted"
                        style={{ fontSize: 11, marginTop: 3 }}
                      >
                        {vehicle.make_name || "—"}{" "}
                        {vehicle.model_name || ""}
                      </div>
                    </td>

                    <td>{vehicle.vin || "—"}</td>

                    <td>
                      {vehicle.stock_number ||
                        vehicle.lot_number ||
                        "—"}
                    </td>

                    <td>{vehicle.year || "—"}</td>

                    <td>
                      {vehicle.mileage !== null
                        ? Number(vehicle.mileage).toLocaleString()
                        : "—"}
                    </td>

                    <td>
                      {vehicle.location_code ||
                        vehicle.storage_location_name ||
                        "Unassigned"}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          vehicle.inventory_status === "archived"
                            ? "orange"
                            : vehicle.inventory_status === "in_stock"
                              ? "green"
                              : "blue"
                        }`}
                      >
                        {labelize(vehicle.inventory_status)}
                      </span>
                    </td>

                    <td>
                      <div className="record-actions">
                        <button
                          className="record-action view"
                          title="View"
                          onClick={() => openView(vehicle)}
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          className="record-action edit"
                          title="Edit"
                          onClick={() => openEdit(vehicle)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          className="record-action delete"
                          title="Archive"
                          onClick={() => archiveVehicle(vehicle)}
                          disabled={
                            vehicle.inventory_status === "archived"
                          }
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
      )}

      {vehicleTab === "incoming" && (
        <section className="records-section">
          <div className="records-toolbar card">
            <div>
              <div style={{ fontWeight: 850 }}>Incoming / In Transit</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                Purchased but not yet physically received — not available as sellable stock.
              </div>
            </div>
            <div className="records-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Stock number, VIN, auction source..."
              />
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>VIN</th>
                  <th>Stock #</th>
                  <th>Purchase Date</th>
                  <th>Purchase Price</th>
                  <th>Auction / Source</th>
                  <th style={{ width: 190 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomingQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 34, textAlign: "center" }}>
                      <span className="muted" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <Loader2 size={17} className="spin" /> Loading...
                      </span>
                    </td>
                  </tr>
                ) : incomingVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 34, textAlign: "center" }} className="muted">
                      No incoming vehicles. Scan an auction slip from the AI Command Center to add one.
                    </td>
                  </tr>
                ) : (
                  incomingVehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <Link href={`/dashboard/vehicles/${vehicle.id}`} style={{ fontWeight: 800, color: "var(--text)" }}>
                          {vehicle.name}
                        </Link>
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                          {vehicle.year || ""} {vehicle.make_name || ""} {vehicle.model_name || ""}
                        </div>
                      </td>
                      <td>{vehicle.vin || "—"}</td>
                      <td>{vehicle.stock_number || "—"}</td>
                      <td>{vehicle.purchase_date || "—"}</td>
                      <td>
                        {vehicle.purchase_price !== null
                          ? `$${Number(vehicle.purchase_price).toLocaleString()}`
                          : "—"}
                      </td>
                      <td>{vehicle.auction_source || "—"}</td>
                      <td>
                        <div className="record-actions">
                          <Link
                            href={`/dashboard/vehicles/${vehicle.id}`}
                            className="record-action view"
                            title="View Vehicle"
                          >
                            <Eye size={14} />
                          </Link>

                          {vehicle.source_document_file_id && (
                            <a
                              className="record-action view"
                              title="View Auction Slip"
                              href={documentUrl(vehicle.id, vehicle.source_document_file_id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileText size={14} />
                            </a>
                          )}

                          {has("vehicles.acquisition.manage") && (
                            <button
                              className="record-action edit"
                              title="Mark Received"
                              onClick={() => openReceive(vehicle)}
                            >
                              <PackageCheck size={14} />
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
      )}

      {mode && (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div
            className="record-modal card"
            style={{ width: "min(900px, 100%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  {mode === "create"
                    ? "New Vehicle"
                    : mode === "edit"
                      ? "Edit Vehicle"
                      : "Vehicle Details"}
                </div>

                <h3
                  style={{
                    margin: "5px 0 0",
                    fontSize: 22,
                  }}
                >
                  {mode === "create"
                    ? "Add vehicle to Lal Motors"
                    : selected?.name}
                </h3>
              </div>

              <button
                className="icon-btn"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            {mode === "view" && selected ? (
              <VehicleDetails vehicle={selected} />
            ) : (
              <form onSubmit={saveVehicle}>
                <div className="form-grid">
                  <TextField
                    label="Vehicle Name"
                    value={form.name}
                    setValue={(value) => setField("name", value)}
                    placeholder="e.g. 2020 Nissan Altima"
                  />

                  <TextField
                    label="VIN"
                    value={form.vin}
                    setValue={(value) => setField("vin", value)}
                    placeholder="Vehicle identification number"
                  />

                  <TextField
                    label="Stock Number"
                    value={form.stock_number}
                    setValue={(value) =>
                      setField("stock_number", value)
                    }
                  />

                  <TextField
                    label="Lot Number"
                    value={form.lot_number}
                    setValue={(value) =>
                      setField("lot_number", value)
                    }
                  />

                  <TextField
                    label="Registration"
                    value={form.registration}
                    setValue={(value) =>
                      setField("registration", value)
                    }
                  />

                  <TextField
                    label="Year"
                    type="number"
                    value={form.year}
                    setValue={(value) => setField("year", value)}
                    min="1900"
                    max="2200"
                  />

                  <div>
                    <label className="form-label">Make</label>
                    <input
                      className="input"
                      value={form.make_name}
                      onChange={(e) =>
                        setField("make_name", e.target.value)
                      }
                      list="vehicle-makes"
                      placeholder="Type or select make"
                    />
                    <datalist id="vehicle-makes">
                      {makes.map((make) => (
                        <option
                          key={make.id}
                          value={make.name}
                        />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="form-label">Model</label>
                    <input
                      className="input"
                      value={form.model_name}
                      onChange={(e) =>
                        setField("model_name", e.target.value)
                      }
                      list="vehicle-models"
                      placeholder="Type or select model"
                    />
                    <datalist id="vehicle-models">
                      {models.map((model) => (
                        <option
                          key={model.id}
                          value={model.name}
                        />
                      ))}
                    </datalist>
                  </div>

                  <TextField
                    label="Trim"
                    value={form.trim}
                    setValue={(value) => setField("trim", value)}
                  />

                  <TextField
                    label="Color"
                    value={form.color}
                    setValue={(value) => setField("color", value)}
                  />

                  <TextField
                    label="Engine"
                    value={form.engine}
                    setValue={(value) => setField("engine", value)}
                  />

                  <TextField
                    label="Transmission"
                    value={form.transmission}
                    setValue={(value) =>
                      setField("transmission", value)
                    }
                  />

                  <TextField
                    label="Fuel"
                    value={form.fuel_type}
                    setValue={(value) => setField("fuel_type", value)}
                  />

                  <TextField
                    label="Mileage"
                    type="number"
                    value={form.mileage}
                    setValue={(value) =>
                      setField("mileage", value)
                    }
                    min="0"
                  />

                  <TextField
                    label="Purchase Price"
                    type="number"
                    value={form.purchase_price}
                    setValue={(value) =>
                      setField("purchase_price", value)
                    }
                    min="0"
                    step="0.01"
                  />

                  <TextField
                    label="Purchase Date"
                    type="date"
                    value={form.purchase_date}
                    setValue={(value) =>
                      setField("purchase_date", value)
                    }
                  />

                  <TextField
                    label="Selling Price"
                    type="number"
                    value={form.default_selling_price}
                    setValue={(value) =>
                      setField("default_selling_price", value)
                    }
                    min="0"
                    step="0.01"
                  />

                  <TextField
                    label="Minimum Selling Price"
                    type="number"
                    value={form.minimum_selling_price}
                    setValue={(value) =>
                      setField("minimum_selling_price", value)
                    }
                    min="0"
                    step="0.01"
                  />

                  <TextField
                    label="Condition"
                    value={form.condition}
                    setValue={(value) =>
                      setField("condition", value)
                    }
                  />

                  <div>
                    <label className="form-label">
                      Inventory Status
                    </label>
                    <select
                      className="select"
                      value={form.inventory_status}
                      onChange={(e) =>
                        setField(
                          "inventory_status",
                          e.target.value,
                        )
                      }
                    >
                      {inventoryStatuses.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      Vehicle Process
                    </label>
                    <select
                      className="select"
                      value={form.vehicle_process_status}
                      onChange={(e) =>
                        setField(
                          "vehicle_process_status",
                          e.target.value,
                        )
                      }
                    >
                      {processStatuses.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      Storage Location
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
                    label="Acquisition Source"
                    value={form.acquisition_source}
                    setValue={(value) =>
                      setField("acquisition_source", value)
                    }
                  />

                  <div className="form-full">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(e) =>
                        setField("notes", e.target.value)
                      }
                      placeholder="Internal notes..."
                    />
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      color: "var(--danger)",
                      fontSize: 13,
                      marginTop: 14,
                    }}
                  >
                    {error}
                  </div>
                )}

                {success && (
                  <div
                    style={{
                      color: "var(--success)",
                      fontSize: 13,
                      marginTop: 14,
                    }}
                  >
                    {success}
                  </div>
                )}

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
                    onClick={closeModal}
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
                        <Loader2 size={15} className="spin" />
                        Saving...
                      </>
                    ) : mode === "create" ? (
                      "Create Vehicle"
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

      {receiveTarget && (
        <Modal
          title={`Mark ${receiveTarget.name} Received`}
          eyebrow="Incoming / In Transit"
          onClose={() => (!receiving ? setReceiveTarget(null) : undefined)}
          width={420}
        >
          <form onSubmit={submitReceive}>
            <Message error={receiveError} />
            <div className="form-grid">
              <div>
                <label className="form-label">Received Date</label>
                <input
                  className="input"
                  type="date"
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                />
              </div>
              <SelectField
                label="Storage Location"
                value={receiveLocationId}
                onChange={setReceiveLocationId}
                required
                options={[
                  { value: "", label: "Select a location..." },
                  ...locations.map((l) => ({
                    value: l.id,
                    label: l.name ? `${l.location_code} — ${l.name}` : l.location_code,
                  })),
                ]}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReceiveTarget(null)} disabled={receiving}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={receiving}>
                {receiving ? (
                  <>
                    <Loader2 size={15} className="spin" /> Saving...
                  </>
                ) : (
                  "Mark Received"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showWorkEntryModal && (
        <Modal
          title="Vehicle Work"
          eyebrow="Add Work / Parts"
          onClose={() => setShowWorkEntryModal(false)}
          width={640}
        >
          <VehicleWorkEntryForm onSaved={() => setShowWorkEntryModal(false)} />
        </Modal>
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

function TextField({
  label,
  value,
  setValue,
  type = "text",
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function VehicleDetails({ vehicle }: { vehicle: Vehicle }) {
  const details = [
    ["Item Code", vehicle.item_code],
    ["VIN", vehicle.vin],
    ["Stock Number", vehicle.stock_number],
    ["Lot Number", vehicle.lot_number],
    ["Registration", vehicle.registration],
    ["Year", vehicle.year],
    ["Make", vehicle.make_name],
    ["Model", vehicle.model_name],
    ["Trim", vehicle.trim],
    ["Color", vehicle.color],
    ["Engine", vehicle.engine],
    ["Transmission", vehicle.transmission],
    ["Fuel", vehicle.fuel_type],
    [
      "Mileage",
      vehicle.mileage !== null
        ? Number(vehicle.mileage).toLocaleString()
        : null,
    ],
    ["Condition", vehicle.condition],
    ["Inventory Status", labelize(vehicle.inventory_status)],
    [
      "Process Status",
      labelize(vehicle.vehicle_process_status),
    ],
    ["Purchase Price", vehicle.purchase_price],
    ["Selling Price", vehicle.default_selling_price],
    ["Purchase Date", vehicle.purchase_date],
    ["Acquisition Source", vehicle.acquisition_source],
    [
      "Storage",
      vehicle.location_code ||
        vehicle.storage_location_name ||
        "Unassigned",
    ],
    ["Notes", vehicle.notes],
  ];

  return (
    <div className="form-grid">
      {details.map(([label, value]) => (
        <div
          key={String(label)}
          className={label === "Notes" ? "form-full" : ""}
        >
          <label className="form-label">{label}</label>
          <div className="record-value">
            {value === null || value === "" ? "—" : String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission perm="vehicles.view">
      <VehiclesPage />
    </RequirePermission>
  );
}
