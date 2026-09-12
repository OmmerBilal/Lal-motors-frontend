import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Order", "Customer", "Date", "Items", "Total", "Status"];
  const rows = [["SO-1001", "John Customer", "Sep 08, 2026", "1", "$420", "Confirmed"], ["SO-1002", "Wholesale Example", "Sep 07, 2026", "3", "$2,110", "Processing"], ["SO-1003", "John Customer", "Sep 05, 2026", "1", "$280", "Fulfilled"]];
  const fields = ["Order Number", "Customer", "Order Date", "Item", "Quantity", "Unit Price", "Shipping Amount", "Status"];

  return (
    <>
      <PageHeader eyebrow="Sales" title="Sales Orders" description="Create new sales and review current and past orders." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Sales Orders" fields={fields} />
    </>
  );
}
