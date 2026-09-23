"use client";

import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { Field, Message, SelectField, TextAreaField } from "@/components/RealUi";
import { apiFetch, apiUpload } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";

type VehicleOption = {
  id: string;
  name: string;
  stock_number: string | null;
  vin: string | null;
};

type VehicleListResponse = { items: VehicleOption[] };
type UploadedBillsResponse = { files: { file_id: string }[] };

const CATEGORY_OPTIONS = [
  "Parts",
  "Tyres",
  "Battery",
  "Headlight",
  "Paint / Body",
  "Engine Service",
  "MOT / Inspection",
  "Labour",
  "Transport",
  "Other",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Shared by the Vehicle Detail "Work & Costs" tab (vehicleId locked) and the
// standalone "Vehicle Work" quick-entry point (vehicle picked by search) —
// one form, so the simple employee path never diverges from the detail-page
// path. Reuses the same upload-then-reference pattern as auction slips:
// bills are uploaded first (POST .../work-entries/bills), then the entry is
// created referencing the returned file_ids.
export function VehicleWorkEntryForm({
  vehicleId,
  onSaved,
}: {
  vehicleId?: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [pickedVehicleId, setPickedVehicleId] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [category, setCategory] = useState("Parts");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [partsCost, setPartsCost] = useState("0");
  const [labourCost, setLabourCost] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [vendorName, setVendorName] = useState("");
  const [workDate, setWorkDate] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [bills, setBills] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const vehicleSearchQuery = useQuery({
    queryKey: ["vehicles", "workEntrySearch", vehicleSearch],
    queryFn: () =>
      apiFetch<VehicleListResponse>(
        `/vehicles?search=${encodeURIComponent(vehicleSearch)}&limit=10`,
      ),
    enabled: !vehicleId && vehicleSearch.trim().length > 1,
    staleTime: 30_000,
  });
  const vehicleOptions = vehicleSearchQuery.data?.items ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const targetVehicleId = vehicleId || pickedVehicleId;

    if (!targetVehicleId) {
      setError("Select a vehicle first.");
      return;
    }
    if (!description.trim()) {
      setError("Describe the work or part.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let billFileIds: string[] = [];

      if (bills.length) {
        const form = new FormData();
        bills.forEach((f) => form.append("files", f));
        const uploaded = await apiUpload<UploadedBillsResponse>(
          `/vehicles/${targetVehicleId}/work-entries/bills`,
          form,
        );
        billFileIds = uploaded.files.map((f) => f.file_id);
      }

      await apiFetch(`/vehicles/${targetVehicleId}/work-entries`, {
        method: "POST",
        body: JSON.stringify({
          category,
          description: description.trim(),
          quantity: Number(quantity) || 1,
          parts_cost: Number(partsCost) || 0,
          labour_cost: Number(labourCost) || 0,
          other_cost: Number(otherCost) || 0,
          vendor_name: vendorName || null,
          work_date: workDate || null,
          notes: notes || null,
          bill_file_ids: billFileIds,
        }),
      });

      setSuccess("Work entry saved.");
      await invalidate(queryClient, ["vehicles"]);
      setDescription("");
      setPartsCost("0");
      setLabourCost("0");
      setOtherCost("0");
      setVendorName("");
      setNotes("");
      setBills([]);
      setPickedVehicleId("");
      setVehicleSearch("");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save work entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Message error={error} success={success} />

      <div className="form-grid">
        {!vehicleId && (
          <div className="form-full">
            <label className="form-label">Vehicle</label>
            <input
              className="input"
              value={vehicleSearch}
              onChange={(e) => {
                setVehicleSearch(e.target.value);
                setPickedVehicleId("");
              }}
              placeholder="Search by stock number, VIN, registration, or make/model"
            />
            {vehicleSearch.trim().length > 1 && (
              <select
                className="select"
                style={{ marginTop: 8 }}
                value={pickedVehicleId}
                onChange={(e) => setPickedVehicleId(e.target.value)}
                required
              >
                <option value="">
                  {vehicleOptions.length ? "Select the matching vehicle..." : "No matches yet..."}
                </option>
                {vehicleOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.stock_number || v.vin || ""} — {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <SelectField
          label="Category"
          value={category}
          onChange={setCategory}
          options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
        />
        <Field label="Work / Part Name" value={description} onChange={setDescription} placeholder="e.g. Front brake pads" required />
        <Field label="Quantity" type="number" value={quantity} onChange={setQuantity} min="0" step="1" />
        <Field label="Parts Cost" type="number" value={partsCost} onChange={setPartsCost} min="0" step="0.01" />
        <Field label="Labour Cost" type="number" value={labourCost} onChange={setLabourCost} min="0" step="0.01" />
        <Field label="Other Cost" type="number" value={otherCost} onChange={setOtherCost} min="0" step="0.01" />
        <Field label="Vendor / Garage" value={vendorName} onChange={setVendorName} placeholder="Optional" />
        <Field label="Work Date" type="date" value={workDate} onChange={setWorkDate} />
        <TextAreaField label="Notes" value={notes} onChange={setNotes} placeholder="Optional" />

        <div className="form-full">
          <label className="form-label">Bills / Receipts</label>
          <input
            className="input"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            onChange={(e) => setBills(Array.from(e.target.files || []))}
          />
          {bills.length > 0 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {bills.length} file(s) selected
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? (
            <>
              <Loader2 size={15} className="spin" /> Saving...
            </>
          ) : (
            "Save Work Entry"
          )}
        </button>
      </div>
    </form>
  );
}
