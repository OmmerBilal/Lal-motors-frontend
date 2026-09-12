import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["PO", "Supplier", "Date", "Expected", "Total", "Status"];
  const rows = [["PO-1001", "Auto Source Co.", "Sep 01, 2026", "Sep 18, 2026", "$6,400", "Confirmed"], ["PO-1002", "Parts Hub", "Sep 03, 2026", "Sep 15, 2026", "$2,180", "Submitted"]];
  const fields = ["PO Number", "Supplier", "Order Date", "Expected Delivery", "Item", "Quantity", "Unit Cost", "Status"];

  return (
    <>
      <PageHeader eyebrow="Procurement" title="Purchase Orders" description="Track supplier orders from draft through receiving." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Purchase Orders" fields={fields} />
    </>
  );
}
