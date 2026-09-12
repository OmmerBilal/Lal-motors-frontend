import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Product", "SKU", "Category", "Brand", "Price", "Status"];
  const rows = [["Tire Machine", "NEW-1001", "Equipment", "Generic", "$2,800", "Draft"], ["PVC Panel Kit", "NEW-1002", "Parts", "Generic", "$140", "In Stock"]];
  const fields = ["Product Name", "SKU", "Category", "Brand", "Cost Price", "Selling Price", "Quantity", "Supplier"];

  return (
    <>
      <PageHeader eyebrow="Catalog" title="New Items" description="Manage new stock such as tools, equipment, accessories and replacement products." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — New Items" fields={fields} />
    </>
  );
}
