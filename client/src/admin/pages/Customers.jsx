import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { exportRowsToExcel } from "../utils/exportExcel";
import { showSiteToast } from "../../lib/siteToast";
import {
  buildCustomerRows,
  deleteCustomer,
  saveCustomer,
  subscribeToOrders,
  subscribeToUsers,
} from "../../lib/adminStore";

const emptyForm = {
  name: "",
  email: "",
  phoneNumber: "",
  city: "",
  state: "",
  status: "Active",
};

const Customers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      setUsers,
      (error) => console.error("Failed to load live customers:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load customer orders:", error)
    );

    return () => unsubscribe();
  }, []);

  const customerRows = useMemo(() => buildCustomerRows(users, orders), [orders, users]);
  const statusOptions = useMemo(
    () => ["All", ...new Set(customerRows.map((item) => item.status).filter(Boolean))],
    [customerRows]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customerRows.filter((item) => {
      const matchesDate = isWithinDateFilters(item.createdAt, period, fromDate, toDate);
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [item.customer, item.email, item.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesDate && matchesStatus && matchesQuery;
    });
  }, [customerRows, fromDate, period, query, statusFilter, toDate]);
  const columns = useMemo(
    () => [
      {
        key: "customer",
        label: "Customer",
        render: (row) => (
          <button
            type="button"
            style={styles.customerButton}
            onClick={() => navigate(`/admin/customer-details?user=${encodeURIComponent(row.uid)}`)}
          >
            {row.customer}
          </button>
        ),
      },
      { key: "email", label: "Email" },
      { key: "orders", label: "Orders", align: "right" },
      { key: "spend", label: "Total Spend" },
      { key: "status", label: "Status", type: "status" },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div className="admin-row-actions">
            <button type="button" className="admin-panel-action-link" onClick={() => handleEdit(row)}>
              Update
            </button>
            <button type="button" className="admin-panel-action-link danger" onClick={() => handleDelete(row)}>
              Remove
            </button>
          </div>
        ),
      },
    ],
    [navigate]
  );

  const handleEdit = (row) => {
    setSaveError("");
    setEditingCustomer(row);
    setForm({
      name: row.customer || "",
      email: row.email || "",
      phoneNumber: row.phone === "Not provided" ? "" : row.phone || "",
      city: row.city === "Not provided" ? "" : row.city || "",
      state: row.state === "Not provided" ? "" : row.state || "",
      status: row.status || "Active",
    });
  };

  const handleClearForm = () => {
    setSaveError("");
    setEditingCustomer(null);
    setForm(emptyForm);
  };
const handleDelete = async (row) => {
  const confirmed = window.confirm(`Remove customer ${row.customer}?`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteCustomer(row.uid);

    showSiteToast("Customer deleted successfully");
  } catch (error) {
    console.error("Failed to delete customer:", error);

    showSiteToast(
      error.message || "Failed to delete customer",
      { type: "error" }
    );
  }
};

const handleSave = async (event) => {
  event.preventDefault();

  if (!editingCustomer?.uid) {
    setSaveError(
      "Select a registered customer from the table, then use Update to edit their profile."
    );

    showSiteToast(
      "Select a customer before updating",
      { type: "error" }
    );

    return;
  }

  try {
    setSaving(true);
    setSaveError("");

    await saveCustomer(editingCustomer.uid, form);

    showSiteToast("Customer updated successfully");

    handleClearForm();
  } catch (error) {
    console.error("Failed to save customer:", error);

    showSiteToast(
      error.message || "Could not save customer details.",
      { type: "error" }
    );

    setSaveError(
      error.message || "Could not save customer details."
    );
  } finally {
    setSaving(false);
  }
};

  const handleExport = () => {
    exportRowsToExcel({
      title: "Spice Root Customers",
      fileName: "spice-root-customers",
      columns: [
        { key: "customer", label: "Customer" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "city", label: "City" },
        { key: "orders", label: "Orders" },
        { key: "spend", label: "Total Spend" },
        { key: "status", label: "Status" },
        { key: "joined", label: "Joined" },
      ],
      rows: filteredRows,
    });
  };

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Customers</h2>
          <p>See live registered users, total orders, total spend, and account activity status.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-primary-button" onClick={handleExport}>
            Export Customers Excel
          </button>
        </div>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Update Customer</h3>
            <p>Customer profiles are created when users register. Select a customer below and choose Update to edit their details.</p>
          </div>
        </div>

        <form className="admin-field-grid" onSubmit={handleSave}>
          <label>
            <span>Customer Name</span>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Email ID</span>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            <span>Phone</span>
            <input value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
          </label>
          <label>
            <span>City</span>
            <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
          </label>
          <label>
            <span>State</span>
            <input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} />
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              {["Active", "Returning", "New", "Inactive"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="admin-page-actions">
            <button type="submit" className="admin-primary-button" disabled={saving || !editingCustomer}>
              {saving ? "Saving..." : "Update Customer"}
            </button>
            <button type="button" className="admin-secondary-button" onClick={handleClearForm}>
              Clear
            </button>
          </div>
          {saveError ? <p style={{ color: "#b42318", margin: 0 }}>{saveError}</p> : null}
        </form>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Customer Filters</h3>
            <p>Filter by calendar date, customer name, email ID, and status.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={handleExport}>
            Download This Section
          </button>
        </div>
        <div className="admin-filter-row">
          <input
            className="admin-inline-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer name, email ID, status..."
          />
          <select className="admin-inline-search" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((item) => (
              <option key={item} value={item}>{item === "All" ? "All Statuses" : item}</option>
            ))}
          </select>
          <select className="admin-inline-search" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input className="admin-inline-search" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="admin-inline-search" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="admin-module-card">
        <DataTable columns={columns} rows={filteredRows} rowKey="uid" />
        {filteredRows.length === 0 ? (
          <div className="admin-empty-state" style={styles.emptyState}>
            No customers match the selected filters.
          </div>
        ) : null}
      </div>
    </section>
  );
};

const styles = {
  customerButton: {
    background: "transparent",
    border: 0,
    color: "var(--ad-text)",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  emptyState: {
    marginTop: "12px",
  },
};

export default Customers;
