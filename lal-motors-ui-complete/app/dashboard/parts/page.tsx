import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Part", "Code", "Category", "Condition", "Price", "Status"];
  const rows = [["Front Bumper", "P-00001", "Body", "Used", "$420", "In Stock"], ["Transmission", "P-00002", "Drivetrain", "Used", "$1,850", "In Stock"], ["Headlight Assembly", "P-00003", "Lighting", "Used", "$280", "Ready to List"]];
  const fields = ["Part Name", "Part Code", "Category", "OEM Part Number", "Condition", "Asking Price", "Storage Location", "Source Vehicle"];

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Used Parts" description="Track dismantled parts, source vehicles, fitment, pricing and storage." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Used Parts" fields={fields} />
    </>
  );
}
