# Lal Motors — Full Business Frontend Connection Batch

This frontend patch connects all backend business modules that are currently ready and fixes the dashboard routing issue.

## Connected pages in this batch

```text
/dashboard/new-items      -> /api/v1/new-items
/dashboard/sales          -> /api/v1/sales-orders
/dashboard/suppliers      -> /api/v1/suppliers
/dashboard/purchases      -> /api/v1/purchase-orders
/dashboard/procurement    -> /api/v1/procurement-ops/*
/dashboard/shipments      -> /api/v1/shipments
/dashboard/containers     -> /api/v1/containers
/dashboard/payments       -> /api/v1/payments
```

Previously connected pages remain unchanged:

```text
/dashboard/vehicles
/dashboard/parts
/dashboard/inventory
/dashboard/customers
```

## Dashboard fix

`/dashboard` is explicitly the **Overall Dashboard** and shows live counts from multiple business modules. Used Parts stays only at:

```text
/dashboard/parts
```

The Dashboard navigation link and LAL MOTORS logo both point to:

```text
/dashboard
```

## Module search

A new module search is above the sidebar navigation list and also available in the top bar.

Examples:

```text
inventory      -> Inventory
payment        -> Payments
container      -> Containers
quote          -> Procurement Ops
facebook       -> Meta
```

Clicking a dropdown result opens that module directly.

## Install

Extract the ZIP and merge these folders/files into your existing frontend:

```text
lal-motors-ui-final-frontend
```

Allow Windows to replace matching files.

The patch changes/adds:

```text
components/DashboardShell.tsx
components/RealUi.tsx
lib/navigation.ts
app/dashboard/page.tsx
app/dashboard/new-items/page.tsx
app/dashboard/sales/page.tsx
app/dashboard/suppliers/page.tsx
app/dashboard/purchases/page.tsx
app/dashboard/procurement/page.tsx
app/dashboard/shipments/page.tsx
app/dashboard/containers/page.tsx
app/dashboard/payments/page.tsx
```

It does NOT replace `.env.local`, auth pages, Vehicles, Used Parts, Inventory or Customers.

## Run

Backend terminal:

```powershell
cd C:\Users\ommer\OneDrive\Desktop\lal-motors-backend-foundation
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --reload-dir app
```

Frontend terminal:

```powershell
cd C:\Users\ommer\OneDrive\Desktop\lal-motors-ui-final-frontend
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

Use `localhost` for frontend and backend so the HttpOnly auth cookie stays on the same browser host scope.

## Easy UI verification

1. Open `/dashboard` and confirm **Overall Dashboard** is shown, not Used Parts.
2. In the sidebar module search type `inventory`; click Inventory in the dropdown.
3. Test New Items: list, create, view, edit. Manager/Admin can archive.
4. Test Sales: list, create, view, edit, line items and fulfillments. Manager/Admin can cancel.
5. Test Suppliers: list, create, view, edit, contacts and history. Manager/Admin can deactivate.
6. Test Purchase Orders: list, create, view, edit, PO lines and Receive. PO Receive updates inventory through the backend transaction.
7. Test Procurement Ops tabs: Quotes, Certifications, Production Runs, QC Inspections, Supplier Communications.
8. Test Shipments: create/edit, link POs, attach containers, add container items.
9. Test Containers: list/create/view/edit. Manager/Admin can delete only unused containers.
10. Test Payments: create/edit, allocations, view. Manager/Admin can post or void.

## Important business rules preserved

- Sales order cancellation is not physical deletion.
- PO receiving is the only action needed for that PO receipt; do not also call Inventory Receive for the same stock.
- Adding items to a shipment container tracks logistics only and does not change stock quantity.
- Payment posting/voiding is protected by Manager/Admin permissions.
- Posted/void/refunded payments are locked from normal editing.
- New-item inventory quantity changes after creation should be managed through Inventory so movement history is preserved.
