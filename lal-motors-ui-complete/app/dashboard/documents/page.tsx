import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Document", "Type", "Related To", "Date", "Uploaded By"];
  const rows = [["Supplier Invoice 1001", "Invoice", "PO-1001", "Sep 05", "Admin"], ["Container Documents", "Customs", "SHP-1001", "Sep 06", "Admin"]];
  const fields = ["Document Name", "Document Type", "Related Record", "Document Date", "Notes"];

  return (
    <>
      <PageHeader eyebrow="Records" title="Documents" description="Store operational document metadata and connect files to business records." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Documents" fields={fields} />
    </>
  );
}
