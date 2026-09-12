import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Employee", "Role", "Type", "Email", "Status"];
  const rows = [["Admin User", "Administrator", "Full Time", "admin@lalmotors.com", "Active"], ["Warehouse User", "Warehouse", "Full Time", "warehouse@lalmotors.com", "Active"]];
  const fields = ["Employee Number", "Display Name", "Employment Type", "Email", "Phone", "Hire Date", "Status"];

  return (
    <>
      <PageHeader eyebrow="People" title="Employees" description="Manage employees, roles, schedules and time off." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Employees" fields={fields} />
    </>
  );
}
