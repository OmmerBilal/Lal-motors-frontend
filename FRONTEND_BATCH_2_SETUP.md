# Lal Motors — Frontend Connection Batch 2

This patch connects these real backend modules to the frontend:

```text
Used Parts
Inventory
Customers
```

Vehicles remains connected from the previous patch.

The dashboard home now also uses live counts for:

```text
Vehicles
Used Parts
Customers
Sales Orders
```

Sales Orders itself is not yet connected as a frontend module; only its
dashboard count is live.

---

## Files replaced

```text
app/dashboard/parts/page.tsx
app/dashboard/inventory/page.tsx
app/dashboard/customers/page.tsx
app/dashboard/page.tsx
```

No auth files, navigation files, global styles, backend files, or `.env`
files are changed.

---

## Install

Extract the ZIP.

Copy the `app` folder into:

```text
lal-motors-ui-final-frontend
```

Allow Windows to merge/replace matching files.

---

## Run backend

```powershell
cd C:\Users\ommer\OneDrive\Desktop\lal-motors-backend-foundation
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --reload-dir app
```

Use:

```text
http://localhost:8000
```

---

## Run frontend

In another terminal:

```powershell
cd C:\Users\ommer\OneDrive\Desktop\lal-motors-ui-final-frontend
npm run dev
```

Use:

```text
http://localhost:3000
```

Use `localhost` for both.

---

# Test Used Parts

Open:

```text
http://localhost:3000/dashboard/parts
```

Test:

1. Real migrated parts appear.
2. Search works.
3. Category/status filters work.
4. Add Used Part.
5. Create with quantity `0`, OR select a valid storage location for a
   positive initial quantity.
6. View.
7. Edit.
8. Staff user should not be able to archive; Manager/Admin can.

Important:
After creation, stock quantity/location changes are intentionally done
from the Inventory page so inventory movement history stays auditable.

---

# Test Inventory

Open:

```text
http://localhost:3000/dashboard/inventory
```

Test:

1. Real positive inventory balances appear.
2. Search/filter works.
3. Live valuation cards appear.
4. Receive Stock.
5. Transfer between two locations if available.
6. Reserve.
7. Release.
8. Recent movement history updates.

For Staff:
- Adjust button is hidden.
- Storage-location administration remains Manager/Admin.

---

# Test Customers

Open:

```text
http://localhost:3000/dashboard/customers
```

Test:

1. Real customer list appears.
2. Search and type filter work.
3. Add Customer.
4. Edit Customer.
5. View Customer.
6. Add contact from customer View.
7. Edit contact.
8. Delete contact.
9. Order history appears when the customer has orders.
10. Manager/Admin can deactivate.
11. Staff does not see the deactivate button.

---

# Expected architecture

```text
Next.js frontend
    ↓ credentials: include
FastAPI authenticated API
    ↓
PostgreSQL / Supabase
```

The browser never receives database credentials.

---

# After verification

The connected frontend modules will be:

```text
Vehicles
Used Parts
Inventory
Customers
```

The backend module waiting for frontend connection will be:

```text
Sales Orders
```

Then development continues with the next backend API batch.
