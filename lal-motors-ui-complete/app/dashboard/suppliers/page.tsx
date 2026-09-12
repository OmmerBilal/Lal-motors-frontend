import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Supplier", "Company", "Email", "Phone", "Terms", "Rating"];
  const rows = [["Auto Source Co.", "Auto Source", "hello@autosource.example", "+86 555 110", "30 days", "4.5"], ["Parts Hub", "Parts Hub Ltd.", "sales@partshub.example", "+1 555 410", "Due on receipt", "4.2"]];
  const fields = ["Supplier Name", "Company Name", "Email", "Phone", "Country", "Payment Terms", "Rating"];

  return (
    <>
      <PageHeader eyebrow="Procurement" title="Suppliers" description="Manage supplier companies, contacts, payment terms and sourcing history." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Suppliers" fields={fields} />
    </>
  );
}
