import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Customer", "Type", "Email", "Phone", "Orders", "Balance"];
  const rows = [["John Customer", "Retail", "john@example.com", "+1 555 0102", "2", "$0"], ["Wholesale Example", "Wholesale", "sales@example.com", "+1 555 0110", "4", "$1,250"]];
  const fields = ["Customer Name", "Company", "Email", "Phone", "Country", "City", "Customer Type", "Payment Terms"];

  return (
    <>
      <PageHeader eyebrow="CRM" title="Customers" description="Manage retail, wholesale and export customers with order history." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Customers" fields={fields} />
    </>
  );
}
