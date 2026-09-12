import { DataTable, PageHeader, SimpleForm } from "@/components/Shared";

export default function Page() {
  const columns = ["Vehicle", "VIN", "Stock / Lot", "Year", "Status"];
  const rows = [["2020 BMW 3 Series", "WBA8D9C0XL....", "STK-1024", "2020", "In Stock"], ["2019 Audi A4", "WAUENAF4XK....", "LOT-88421", "2019", "In Stock"], ["2018 Ford F-150", "1FTEW1EGXJ....", "LOT-17305", "2018", "Sold"]];
  const fields = ["VIN", "Stock Number", "Year", "Make", "Model", "Mileage", "Purchase Date", "Status"];

  return (
    <>
      <PageHeader eyebrow="Inventory" title="Vehicles" description="Manage salvage and inventory vehicles, VINs, mileage and lifecycle status." primaryLabel="Add New" />
      <DataTable columns={columns} rows={rows} />
      <SimpleForm title="Quick Add — Vehicles" fields={fields} />
    </>
  );
}
