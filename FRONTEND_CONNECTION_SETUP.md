# Lal Motors Frontend ↔ Backend Connection Update

This patch connects the frontend to the APIs that already exist.

## Connected now

### Authentication
- `/login` → `POST /api/v1/auth/login`
- `/signup` → `POST /api/v1/auth/signup`
- Dashboard protection → `GET /api/v1/auth/me`
- Logout → `POST /api/v1/auth/logout`

### Vehicles
- live list from PostgreSQL
- live search
- status filter
- make/model lookups
- storage-location lookup
- create vehicle
- view vehicle
- edit vehicle
- archive vehicle
- live vehicle count on the dashboard

Other modules remain frontend mock data until their backend APIs are built.

---

## Install this patch

Extract this ZIP.

Copy/merge its files into your existing frontend:

```text
lal-motors-ui-final-frontend
```

Allow Windows to replace the matching files.

Do NOT delete your other frontend files.

## Optional `.env.local`

The code defaults to:

```text
http://localhost:8000/api/v1
```

So you do not need an env file for local development.

If you want one, copy:

```text
.env.local.example
```

to:

```text
.env.local
```

## Run both projects

### Terminal 1 — backend

Inside:

```text
lal-motors-backend-foundation
```

run:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --reload-dir app
```

Backend:

```text
http://localhost:8000
```

### Terminal 2 — frontend

Inside:

```text
lal-motors-ui-final-frontend
```

run:

```powershell
npm run dev
```

Frontend:

```text
http://localhost:3000
```

IMPORTANT:
Use `localhost` for both frontend and backend browser URLs during testing.
Do not mix `localhost` and `127.0.0.1` because authentication cookies are host-specific.

## Test

1. Open `http://localhost:3000/signup`
2. Create an account, or use one you already created through Swagger.
3. Login at `http://localhost:3000/login`
4. You should be redirected to `/dashboard`
5. Open `/dashboard/vehicles`
6. You should see the real PostgreSQL vehicles.
7. Create a test vehicle.
8. Edit it.
9. Archive it if your account has Manager or Administrator role.
10. Click Logout from the sidebar.

If a Staff user tries to archive, `403` is expected because the backend intentionally requires Manager/Administrator.

## Next phase

After this works end-to-end we will build and connect:
1. Used Parts
2. Inventory
3. Customers
4. Sales
5. Suppliers / Purchase Orders
6. Payments
7. Logistics / Containers
8. Tasks / Documents / Employees
9. Shopify / eBay / Meta / TikTok
10. AI function execution
