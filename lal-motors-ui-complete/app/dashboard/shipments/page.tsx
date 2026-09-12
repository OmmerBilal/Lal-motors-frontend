import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Shipment", "Type", "Carrier", "Container", "ETA", "Status"];
  const rows = [["SHP-1001", "Inbound", "Maersk", "Shanghai", "New Jersey", "Sep 18", "In Transit"], ["SHP-1002", "Inbound", "COSCO", "Ningbo", "Newark", "Sep 24", "Booked"]];
  const fields = ["Shipment Number", "Type", "Carrier", "Origin", "Destination", "ETA", "Container Number", "Status"];

  return (
    <>
      <PageHeader eyebrow="Logistics" title="Shipments & Containers" description="Track inbound/outbound shipments, containers, ETAs and logistics status." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Shipments & Containers" fields={fields} />
    </>
  );
}
