"use client";

import {
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { RequirePermission } from "@/components/RequirePermission";
import { ApiError, apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

type Contact = {
  id: string;
  full_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_wechat: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  business_unit_id: string;
  customer_number: string | null;
  customer_type: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country_code: string | null;
  tax_exempt: boolean;
  default_payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  outstanding_balance: string | number;
  order_count: number;
  contacts: Contact[];
  created_at: string;
  updated_at: string;
};

type CustomerList = {
  total: number;
  offset: number;
  limit: number;
  items: Customer[];
};

type CustomerOrder = {
  id: string;
  order_number: string;
  order_date: string;
  order_status: string;
  order_total: string | number;
  paid_amount: string | number;
  balance_due: string | number;
  payment_status: string;
};

type Mode = "create" | "view" | "edit" | null;

type CustomerForm = {
  customer_type: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
  tax_exempt: boolean;
  default_payment_terms: string;
  notes: string;
};

const emptyCustomer: CustomerForm = {
  customer_type: "retail",
  name: "",
  company_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state_region: "",
  postal_code: "",
  country_code: "",
  tax_exempt: false,
  default_payment_terms: "",
  notes: "",
};

function customerToForm(customer: Customer): CustomerForm {
  return {
    customer_type: customer.customer_type,
    name: customer.name,
    company_name: customer.company_name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    address_line1: customer.address_line1 || "",
    address_line2: customer.address_line2 || "",
    city: customer.city || "",
    state_region: customer.state_region || "",
    postal_code: customer.postal_code || "",
    country_code: customer.country_code || "",
    tax_exempt: customer.tax_exempt,
    default_payment_terms: customer.default_payment_terms || "",
    notes: customer.notes || "",
  };
}

function money(value: string | number | null) {
  if (value === null || value === "") return "—";
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function labelize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);

  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    full_name: "",
    role_title: "",
    email: "",
    phone: "",
    whatsapp_wechat: "",
    is_primary: false,
    notes: "",
  });

  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isManager = useMemo(() => {
    const roles = new Set(
      (user?.roles || []).map((role) => role.toLowerCase()),
    );
    return roles.has("manager") || roles.has("administrator");
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      customer_type: typeFilter || undefined,
      active_only: activeOnly,
    }),
    [debouncedSearch, typeFilter, activeOnly],
  );

  const customersQuery = useQuery({
    queryKey: queryKeys.customers.list(listParams),
    queryFn: () => {
      const params = new URLSearchParams();
      if (listParams.search) params.set("search", listParams.search);
      if (listParams.customer_type) params.set("customer_type", listParams.customer_type);
      params.set("active_only", String(listParams.active_only));
      params.set("limit", "300");
      return apiFetch<CustomerList>(`/customers?${params.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const customers = customersQuery.data?.items ?? [];
  const total = customersQuery.data?.total ?? 0;
  const loading = customersQuery.isLoading;

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (new URLSearchParams(window.location.search).get("action") === "add") {
      autoOpenedRef.current = true;
      openCreate();
    }
  }, []);

  function openCreate() {
    setSelected(null);
    setForm(emptyCustomer);
    setOrders([]);
    setError("");
    setSuccess("");
    setMode("create");
  }

  async function openExisting(
    customer: Customer,
    targetMode: "view" | "edit",
  ) {
    setMode(targetMode);
    setDetailLoading(true);
    setError("");

    try {
      const [detail, orderData] = await Promise.all([
        apiFetch<Customer>(`/customers/${customer.id}`),
        apiFetch<CustomerOrder[]>(
          `/customers/${customer.id}/orders`,
        ),
      ]);

      setSelected(detail);
      setForm(customerToForm(detail));
      setOrders(orderData);
    } catch (err: any) {
      setError(err?.message || "Unable to load customer details.");
      setMode(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function setField<K extends keyof CustomerForm>(
    field: K,
    value: CustomerForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    if (mode !== "create" && mode !== "edit") return;

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      customer_type: form.customer_type,
      name: form.name,
      company_name: form.company_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      state_region: form.state_region || null,
      postal_code: form.postal_code || null,
      country_code: form.country_code
        ? form.country_code.toUpperCase()
        : null,
      tax_exempt: form.tax_exempt,
      default_payment_terms:
        form.default_payment_terms || null,
      notes: form.notes || null,
    };

    try {
      if (mode === "create") {
        await apiFetch<Customer>("/customers", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            contacts: [],
          }),
        });
        setSuccess("Customer created successfully.");
      } else if (selected) {
        await apiFetch<Customer>(`/customers/${selected.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Customer updated successfully.");
      }

      await invalidate(queryClient, ["customers", "dashboard"]);

      window.setTimeout(() => {
        setMode(null);
        setSelected(null);
        setSuccess("");
      }, 650);
    } catch (err: any) {
      setError(err?.message || "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(customer: Customer) {
    if (
      !window.confirm(
        `Deactivate ${customer.name}? Historical sales and payment data will be preserved.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/customers/${customer.id}`, {
        method: "DELETE",
      });
      setSuccess(`${customer.name} deactivated successfully.`);
      await invalidate(queryClient, ["customers", "dashboard"]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(
          "Only a Manager or Administrator can deactivate customers.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to deactivate customer.",
        );
      }
    }
  }

  function newContact() {
    setEditingContact(null);
    setContactForm({
      full_name: "",
      role_title: "",
      email: "",
      phone: "",
      whatsapp_wechat: "",
      is_primary: false,
      notes: "",
    });
    setContactOpen(true);
  }

  function editContact(contact: Contact) {
    setEditingContact(contact);
    setContactForm({
      full_name: contact.full_name,
      role_title: contact.role_title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      whatsapp_wechat: contact.whatsapp_wechat || "",
      is_primary: contact.is_primary,
      notes: contact.notes || "",
    });
    setContactOpen(true);
  }

  async function saveContact(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setSaving(true);
    setError("");

    const payload = {
      full_name: contactForm.full_name,
      role_title: contactForm.role_title || null,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      whatsapp_wechat: contactForm.whatsapp_wechat || null,
      is_primary: contactForm.is_primary,
      notes: contactForm.notes || null,
    };

    try {
      if (editingContact) {
        await apiFetch(
          `/customers/${selected.id}/contacts/${editingContact.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiFetch(`/customers/${selected.id}/contacts`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const refreshed = await apiFetch<Customer>(
        `/customers/${selected.id}`,
      );
      setSelected(refreshed);
      setContactOpen(false);
      setSuccess(
        editingContact
          ? "Contact updated successfully."
          : "Contact added successfully.",
      );
    } catch (err: any) {
      setError(err?.message || "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: Contact) {
    if (!selected) return;

    if (!window.confirm(`Delete contact ${contact.full_name}?`)) {
      return;
    }

    try {
      await apiFetch(
        `/customers/${selected.id}/contacts/${contact.id}`,
        { method: "DELETE" },
      );

      const refreshed = await apiFetch<Customer>(
        `/customers/${selected.id}`,
      );
      setSelected(refreshed);
      setSuccess("Contact deleted.");
    } catch (err: any) {
      setError(err?.message || "Unable to delete contact.");
    }
  }

  const totalOutstanding = customers.reduce(
    (sum, customer) =>
      sum + Number(customer.outstanding_balance || 0),
    0,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">CRM</div>
          <h1 className="page-title">Customers</h1>
          <p className="page-copy">
            Real customer records, contacts, balances and order history.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => customersQuery.refetch()}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Add Customer
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Customers" value={total} />
        <Metric
          label="Visible Active"
          value={customers.filter((c) => c.is_active).length}
        />
        <Metric
          label="Outstanding"
          value={money(totalOutstanding)}
        />
        <Metric
          label="Orders"
          value={customers.reduce(
            (sum, c) => sum + Number(c.order_count || 0),
            0,
          )}
        />
      </div>

      <Message error={error || (customersQuery.isError ? "Unable to load customers." : "")} success={success} />

      <section className="records-section">
        <div className="records-toolbar card">
          <div>
            <div style={{ fontWeight: 850 }}>Customer Directory</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              Search, manage contacts and view balances.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div className="records-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, company, email..."
              />
            </div>

            <select
              className="select"
              style={{ width: 145 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="export">Export</option>
              <option value="other">Other</option>
            </select>

            <label className="badge" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Orders</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 35, textAlign: "center" }}>
                    <Loader2 size={16} className="spin" /> Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 35, textAlign: "center" }}>
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div style={{ fontWeight: 800 }}>
                        {customer.name}
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {customer.company_name ||
                          customer.customer_number ||
                          ""}
                      </div>
                    </td>
                    <td>{labelize(customer.customer_type)}</td>
                    <td>
                      <div>{customer.email || "—"}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {customer.phone || ""}
                      </div>
                    </td>
                    <td>
                      {[customer.city, customer.state_region]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td>{customer.order_count}</td>
                    <td>{money(customer.outstanding_balance)}</td>
                    <td>
                      <span className="badge">
                        {customer.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="record-actions">
                        <button
                          className="record-action view"
                          title="View"
                          onClick={() =>
                            openExisting(customer, "view")
                          }
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="record-action edit"
                          title="Edit"
                          onClick={() =>
                            openExisting(customer, "edit")
                          }
                        >
                          <Pencil size={14} />
                        </button>
                        {isManager && customer.is_active && (
                          <button
                            className="record-action delete"
                            title="Deactivate"
                            onClick={() => deactivate(customer)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {mode && (
        <div
          className="modal-backdrop"
          onMouseDown={() => !saving && setMode(null)}
        >
          <div
            className="record-modal card"
            style={{ width: "min(950px, 100%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">
                  {mode === "create"
                    ? "New Customer"
                    : mode === "edit"
                      ? "Edit Customer"
                      : "Customer Details"}
                </div>
                <h3 style={{ margin: "5px 0 0", fontSize: 22 }}>
                  {mode === "create"
                    ? "Add customer"
                    : selected?.name || "Loading..."}
                </h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => setMode(null)}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 35, textAlign: "center" }}>
                <Loader2 size={20} className="spin" /> Loading...
              </div>
            ) : mode === "view" && selected ? (
              <CustomerDetails
                customer={selected}
                orders={orders}
                newContact={newContact}
                editContact={editContact}
                deleteContact={deleteContact}
              />
            ) : (
              <form onSubmit={saveCustomer}>
                <div className="form-grid">
                  <div>
                    <label className="form-label">Customer Type</label>
                    <select
                      className="select"
                      value={form.customer_type}
                      onChange={(e) =>
                        setField("customer_type", e.target.value)
                      }
                    >
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="export">Export</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <TextField
                    label="Name"
                    value={form.name}
                    setValue={(v) => setField("name", v)}
                    required
                  />
                  <TextField
                    label="Company"
                    value={form.company_name}
                    setValue={(v) => setField("company_name", v)}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    value={form.email}
                    setValue={(v) => setField("email", v)}
                  />
                  <TextField
                    label="Phone"
                    value={form.phone}
                    setValue={(v) => setField("phone", v)}
                  />
                  <TextField
                    label="Payment Terms"
                    value={form.default_payment_terms}
                    setValue={(v) =>
                      setField("default_payment_terms", v)
                    }
                  />
                  <TextField
                    label="Address Line 1"
                    value={form.address_line1}
                    setValue={(v) => setField("address_line1", v)}
                  />
                  <TextField
                    label="Address Line 2"
                    value={form.address_line2}
                    setValue={(v) => setField("address_line2", v)}
                  />
                  <TextField
                    label="City"
                    value={form.city}
                    setValue={(v) => setField("city", v)}
                  />
                  <TextField
                    label="State / Region"
                    value={form.state_region}
                    setValue={(v) => setField("state_region", v)}
                  />
                  <TextField
                    label="Postal Code"
                    value={form.postal_code}
                    setValue={(v) => setField("postal_code", v)}
                  />
                  <TextField
                    label="Country Code"
                    value={form.country_code}
                    setValue={(v) => setField("country_code", v)}
                    placeholder="US"
                    maxLength={2}
                  />

                  <label
                    className="badge"
                    style={{ cursor: "pointer", alignSelf: "end" }}
                  >
                    <input
                      type="checkbox"
                      checked={form.tax_exempt}
                      onChange={(e) =>
                        setField("tax_exempt", e.target.checked)
                      }
                    />
                    Tax Exempt
                  </label>

                  <div className="form-full">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(e) =>
                        setField("notes", e.target.value)
                      }
                    />
                  </div>
                </div>

                <Message error={error} success={success} compact />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMode(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={15} className="spin" /> Saving...
                      </>
                    ) : mode === "create" ? (
                      "Create Customer"
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {contactOpen && selected && (
        <div
          className="modal-backdrop"
          onMouseDown={() => !saving && setContactOpen(false)}
          style={{ zIndex: 80 }}
        >
          <div
            className="record-modal card"
            style={{ width: "min(620px, 100%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">Customer Contact</div>
                <h3 style={{ margin: "5px 0 0", fontSize: 22 }}>
                  {editingContact ? "Edit contact" : "Add contact"}
                </h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => setContactOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={saveContact}>
              <div className="form-grid">
                <TextField
                  label="Full Name"
                  value={contactForm.full_name}
                  setValue={(v) =>
                    setContactForm((c) => ({
                      ...c,
                      full_name: v,
                    }))
                  }
                  required
                />
                <TextField
                  label="Role / Title"
                  value={contactForm.role_title}
                  setValue={(v) =>
                    setContactForm((c) => ({
                      ...c,
                      role_title: v,
                    }))
                  }
                />
                <TextField
                  label="Email"
                  type="email"
                  value={contactForm.email}
                  setValue={(v) =>
                    setContactForm((c) => ({
                      ...c,
                      email: v,
                    }))
                  }
                />
                <TextField
                  label="Phone"
                  value={contactForm.phone}
                  setValue={(v) =>
                    setContactForm((c) => ({
                      ...c,
                      phone: v,
                    }))
                  }
                />
                <TextField
                  label="WhatsApp / WeChat"
                  value={contactForm.whatsapp_wechat}
                  setValue={(v) =>
                    setContactForm((c) => ({
                      ...c,
                      whatsapp_wechat: v,
                    }))
                  }
                />

                <label className="badge" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={contactForm.is_primary}
                    onChange={(e) =>
                      setContactForm((c) => ({
                        ...c,
                        is_primary: e.target.checked,
                      }))
                    }
                  />
                  Primary Contact
                </label>

                <div className="form-full">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="textarea"
                    value={contactForm.notes}
                    onChange={(e) =>
                      setContactForm((c) => ({
                        ...c,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <Message error={error} success="" compact />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 18,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setContactOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .spin {
          animation: lal-spin 0.9s linear infinite;
        }
        @keyframes lal-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

function CustomerDetails({
  customer,
  orders,
  newContact,
  editContact,
  deleteContact,
}: {
  customer: Customer;
  orders: CustomerOrder[];
  newContact: () => void;
  editContact: (contact: Contact) => void;
  deleteContact: (contact: Contact) => void;
}) {
  return (
    <>
      <div className="form-grid">
        {[
          ["Customer Number", customer.customer_number],
          ["Type", labelize(customer.customer_type)],
          ["Company", customer.company_name],
          ["Email", customer.email],
          ["Phone", customer.phone],
          [
            "Address",
            [
              customer.address_line1,
              customer.address_line2,
              customer.city,
              customer.state_region,
              customer.postal_code,
              customer.country_code,
            ]
              .filter(Boolean)
              .join(", "),
          ],
          ["Payment Terms", customer.default_payment_terms],
          ["Tax Exempt", customer.tax_exempt ? "Yes" : "No"],
          ["Outstanding", money(customer.outstanding_balance)],
          ["Orders", customer.order_count],
          ["Status", customer.is_active ? "Active" : "Inactive"],
          ["Notes", customer.notes],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <label className="form-label">{label}</label>
            <div className="record-value">
              {value === null || value === "" ? "—" : String(value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <div
          className="panel-head"
          style={{ marginBottom: 10 }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Contacts</h3>
          </div>
          <button className="btn btn-secondary" onClick={newContact}>
            <UserRoundPlus size={14} /> Add Contact
          </button>
        </div>

        {customer.contacts.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            No contacts yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {customer.contacts.map((contact) => (
              <div
                className="card"
                style={{
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                key={contact.id}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>
                    {contact.full_name}
                    {contact.is_primary ? " · Primary" : ""}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {[contact.role_title, contact.email, contact.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <button
                  className="record-action edit"
                  onClick={() => editContact(contact)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="record-action delete"
                  onClick={() => deleteContact(contact)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 10 }}>Order History</h3>
        {orders.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            No sales orders for this customer yet.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>{order.order_date}</td>
                    <td>{labelize(order.order_status)}</td>
                    <td>{money(order.order_total)}</td>
                    <td>{money(order.paid_amount)}</td>
                    <td>{money(order.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Users size={16} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        Live database data
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  setValue,
  type = "text",
  required,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}

function Message({
  error,
  success,
  compact = false,
}: {
  error: string;
  success: string;
  compact?: boolean;
}) {
  if (!error && !success) return null;

  return (
    <div
      className={compact ? "" : "card"}
      style={{
        padding: 12,
        marginTop: compact ? 14 : 0,
        marginBottom: compact ? 0 : 14,
        color: error ? "var(--danger)" : "var(--success)",
      }}
    >
      {error || success}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission perm="customers.view">
      <CustomersPage />
    </RequirePermission>
  );
}
