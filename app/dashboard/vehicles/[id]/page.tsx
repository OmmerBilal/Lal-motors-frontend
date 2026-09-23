"use client";

import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RequirePermission } from "@/components/RequirePermission";
import { VehicleWorkEntryForm } from "@/components/VehicleWorkEntryForm";
import { DetailGrid, Metric, Message, StatusBadge, labelize, money } from "@/components/RealUi";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { queryKeys } from "@/lib/queryKeys";

type Vehicle = {
  id: string;
  item_code: string;
  name: string;
  condition: string | null;
  inventory_status: string;
  vehicle_process_status: string;
  vin: string | null;
  stock_number: string | null;
  lot_number: string | null;
  registration: string | null;
  year: number | null;
  make_name: string | null;
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
  default_selling_price: string | number | null;
  location_code: string | null;
  storage_location_name: string | null;
  notes: string | null;
};

type Acquisition = {
  acquisition_id: string;
  auction_source: string | null;
  lot_number: string | null;
  purchase_price: string | number | null;
  auction_fees: string | number | null;
  transport_cost: string | number | null;
  purchase_date: string | null;
  source_document_file_id: string | null;
  acquisition_status: "incoming" | "received";
  received_at: string | null;
};

type CostSummary = {
  purchase_price: string | number | null;
  auction_fees: string | number | null;
  transport_cost: string | number | null;
  acquisition_cost: string | number;
  parts_total: string | number;
  labour_total: string | number;
  other_total: string | number;
  current_invested_cost: string | number;
  asking_price: string | number | null;
  expected_margin: string | number | null;
};

type WorkEntry = {
  id: string;
  category: string | null;
  description: string;
  parts_cost: string | number;
  labour_cost: string | number;
  other_cost: string | number;
  total_cost: string | number;
  vendor_name: string | null;
  work_date: string | null;
  created_by_name: string | null;
  bills: { document_id: string; file_id: string; original_filename: string | null }[];
};

type Tab = "overview" | "acquisition" | "work" | "documents";

function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const vehicleId = params.id;
  const { has } = usePermissions();
  const [tab, setTab] = useState<Tab>("overview");

  const vehicleQuery = useQuery({
    queryKey: queryKeys.vehicles.detail(vehicleId),
    queryFn: () => apiFetch<Vehicle>(`/vehicles/${vehicleId}`),
  });
  const vehicle = vehicleQuery.data;

  const acquisitionQuery = useQuery({
    queryKey: [...queryKeys.vehicles.detail(vehicleId), "acquisition"],
    queryFn: () => apiFetch<Acquisition>(`/vehicles/${vehicleId}/acquisition`),
    enabled: (tab === "acquisition" || tab === "documents") && has("vehicles.acquisition.view"),
    retry: false,
  });

  const workEntriesQuery = useQuery({
    queryKey: queryKeys.vehicles.workEntries(vehicleId),
    queryFn: () => apiFetch<{ items: WorkEntry[] }>(`/vehicles/${vehicleId}/work-entries`),
    enabled: tab === "work" || tab === "documents",
  });
  const workEntries = workEntriesQuery.data?.items ?? [];

  const costSummaryQuery = useQuery({
    queryKey: queryKeys.vehicles.costSummary(vehicleId),
    queryFn: () => apiFetch<CostSummary>(`/vehicles/${vehicleId}/cost-summary`),
    enabled: tab === "work" && has("vehicles.cost.view"),
  });
  const costSummary = costSummaryQuery.data;

  function documentUrl(fileId: string) {
    return `${API_BASE_URL}/vehicles/${vehicleId}/documents/${fileId}`;
  }

  if (vehicleQuery.isLoading) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <span className="muted" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <Loader2 size={17} className="spin" /> Loading vehicle...
        </span>
      </div>
    );
  }

  if (!vehicle) {
    return <Message error="Vehicle not found." />;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <Link href="/dashboard/vehicles" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 6 }}>
            <ArrowLeft size={14} /> Back to Vehicles
          </Link>
          <div className="eyebrow">{vehicle.item_code}</div>
          <h1 className="page-title">{vehicle.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge value={vehicle.inventory_status} />
        </div>
      </div>

      <div className="records-toolbar card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              ["overview", "Overview"],
              ["acquisition", "Acquisition"],
              ["work", "Work & Costs"],
              ["documents", "Documents"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`btn ${tab === key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="card" style={{ padding: 20 }}>
          <DetailGrid
            rows={[
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
              ["Mileage", vehicle.mileage !== null ? Number(vehicle.mileage).toLocaleString() : null],
              ["Condition", vehicle.condition],
              ["Process Status", labelize(vehicle.vehicle_process_status)],
              ["Storage", vehicle.location_code || vehicle.storage_location_name || "Unassigned"],
              ["Asking Price", money(vehicle.default_selling_price)],
              ["Notes", vehicle.notes],
            ]}
          />
        </div>
      )}

      {tab === "acquisition" && (
        <RequirePermission perm="vehicles.acquisition.view">
          <div className="card" style={{ padding: 20 }}>
            {acquisitionQuery.isLoading ? (
              <span className="muted" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Loader2 size={16} className="spin" /> Loading...
              </span>
            ) : acquisitionQuery.data ? (
              <>
                <DetailGrid
                  rows={[
                    ["Auction / Source", acquisitionQuery.data.auction_source],
                    ["Lot Number", acquisitionQuery.data.lot_number],
                    ["Purchase Price", money(acquisitionQuery.data.purchase_price)],
                    ["Auction Fees", money(acquisitionQuery.data.auction_fees)],
                    ["Transport", money(acquisitionQuery.data.transport_cost)],
                    ["Purchase Date", acquisitionQuery.data.purchase_date],
                    ["Status", labelize(acquisitionQuery.data.acquisition_status)],
                    ["Received At", acquisitionQuery.data.received_at],
                  ]}
                />
                {acquisitionQuery.data.source_document_file_id && (
                  <a
                    className="btn btn-secondary"
                    style={{ marginTop: 16, display: "inline-flex" }}
                    href={documentUrl(acquisitionQuery.data.source_document_file_id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={15} /> View Auction Slip
                  </a>
                )}
              </>
            ) : (
              <div className="muted">This vehicle has no acquisition record (not added via auction slip).</div>
            )}
          </div>
        </RequirePermission>
      )}

      {tab === "work" && (
        <>
          {has("vehicles.cost.view") && costSummary && (
            <div className="metric-grid" style={{ marginBottom: 16 }}>
              <Metric label="Current Invested Cost" value={money(costSummary.current_invested_cost)} />
              <Metric label="Asking Price" value={money(costSummary.asking_price)} />
              <Metric
                label="Expected Margin"
                value={costSummary.expected_margin !== null ? money(costSummary.expected_margin) : "—"}
              />
            </div>
          )}

          {has("vehicles.work.add") && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 850, marginBottom: 12 }}>Add Work Entry</div>
              <VehicleWorkEntryForm vehicleId={vehicleId} onSaved={() => workEntriesQuery.refetch()} />
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Work</th>
                    <th>Parts</th>
                    <th>Labour</th>
                    <th>Other</th>
                    <th>Total</th>
                    <th>Employee</th>
                    <th>Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {workEntriesQuery.isLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, textAlign: "center" }}>
                        <Loader2 size={16} className="spin" />
                      </td>
                    </tr>
                  ) : workEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, textAlign: "center" }} className="muted">
                        No work entries yet.
                      </td>
                    </tr>
                  ) : (
                    workEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.work_date || "—"}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{entry.description}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{entry.category || "—"}</div>
                        </td>
                        <td>{money(entry.parts_cost)}</td>
                        <td>{money(entry.labour_cost)}</td>
                        <td>{money(entry.other_cost)}</td>
                        <td style={{ fontWeight: 800 }}>{money(entry.total_cost)}</td>
                        <td>{entry.created_by_name || "—"}</td>
                        <td>
                          {entry.bills.length > 0 ? (
                            entry.bills.map((bill) => (
                              <a
                                key={bill.document_id}
                                href={documentUrl(bill.file_id)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "block", fontSize: 12 }}
                              >
                                {bill.original_filename || "View"}
                              </a>
                            ))
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "documents" && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {acquisitionQuery.data?.source_document_file_id && (
              <a href={documentUrl(acquisitionQuery.data.source_document_file_id)} target="_blank" rel="noreferrer">
                <FileText size={14} /> Auction Slip
              </a>
            )}
            {workEntries.flatMap((entry) =>
              entry.bills.map((bill) => (
                <a key={bill.document_id} href={documentUrl(bill.file_id)} target="_blank" rel="noreferrer">
                  <FileText size={14} /> {bill.original_filename || `Bill — ${entry.description}`}
                </a>
              )),
            )}
            {!acquisitionQuery.data?.source_document_file_id && workEntries.every((e) => e.bills.length === 0) && (
              <div className="muted">No documents attached to this vehicle yet.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <RequirePermission perm="vehicles.view">
      <VehicleDetailPage />
    </RequirePermission>
  );
}
