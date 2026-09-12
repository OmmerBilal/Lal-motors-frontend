import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Item", "Type", "Location", "On Hand", "Reserved", "Available"];
  const rows = [["Front Bumper", "Used Part", "A-01", "1", "0", "1"], ["2020 BMW 3 Series", "Vehicle", "UNASSIGNED", "1", "0", "1"], ["Tire Machine", "New Item", "Warehouse", "4", "1", "3"]];
  const fields = ["Item", "Location", "Quantity", "Reserved", "Unit Cost"];

  return (
    <>
      <PageHeader eyebrow="Stock Control" title="Inventory" description="Unified stock view across vehicles, used parts and new items." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Inventory" fields={fields} />
    </>
  );
}
