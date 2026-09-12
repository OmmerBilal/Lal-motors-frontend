import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Task", "Assigned", "Due", "Priority", "Status"];
  const rows = [["Photograph new bumper", "Admin", "Today", "High", "In Progress"], ["Follow up supplier PO-1001", "Admin", "Tomorrow", "Medium", "Todo"]];
  const fields = ["Task", "Description", "Due Date", "Priority", "Assigned To", "Status"];

  return (
    <>
      <PageHeader eyebrow="Operations" title="Tasks & Follow-ups" description="Keep daily operational tasks, due dates and ownership visible." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Tasks & Follow-ups" fields={fields} />
    </>
  );
}
