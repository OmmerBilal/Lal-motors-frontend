import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Transaction", "Date", "Direction", "Party", "Amount", "Status"];
  const rows = [["PAY-1001", "Sep 08", "Incoming", "John Customer", "$420", "Posted"], ["PAY-1002", "Sep 07", "Outgoing", "Auto Source Co.", "$2,000", "Posted"]];
  const fields = ["Transaction Number", "Date", "Direction", "Type", "Customer / Supplier", "Amount", "Method", "Status"];

  return (
    <>
      <PageHeader eyebrow="Finance" title="Payments & Financials" description="Track incoming and outgoing transactions and their allocations." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Payments & Financials" fields={fields} />
    </>
  );
}
