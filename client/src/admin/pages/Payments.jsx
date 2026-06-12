import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { exportRowsToExcel } from "../utils/exportExcel";
import { buildPaymentRows, isPaidOrder, subscribeToOrders } from "../../lib/adminStore";
import { formatPrice } from "../../lib/catalog";

const columns = [
  { key: "paymentId", label: "Payment ID" },
  { key: "orderId", label: "Order ID" },
  { key: "customer", label: "Customer" },
  { key: "amount", label: "Amount" },
  { key: "method", label: "Method" },
  { key: "status", label: "Status", type: "status" },
  { key: "date", label: "Date" },
];

const Payments = () => {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load live payments:", error)
    );

    return () => unsubscribe();
  }, []);

  const paymentRows = useMemo(() => buildPaymentRows(orders), [orders]);
  const statusOptions = useMemo(
    () => ["All", ...new Set(paymentRows.map((item) => item.status).filter(Boolean))],
    [paymentRows]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return paymentRows.filter((item) => {
      const matchesDate = isWithinDateFilters(item.raw?.createdAt, period, fromDate, toDate);
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          item.paymentId,
          item.orderId,
          item.customer,
          item.amount,
          item.amountValue,
          item.method,
          item.status,
          item.date,
        ]
          .filter((value) => value !== undefined && value !== null)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesDate && matchesStatus && matchesQuery;
    });
  }, [fromDate, paymentRows, period, query, statusFilter, toDate]);
  const paidRevenue = useMemo(
    () => orders.filter(isPaidOrder).reduce((total, order) => total + Math.max(0, Number(order.amount) || 0), 0),
    [orders]
  );
  const handleExport = () => {
    exportRowsToExcel({
      title: "Spice Root Payments",
      fileName: "spice-root-payments",
      columns,
      rows: filteredRows,
    });
  };

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Payments</h2>
          <p>Track Razorpay test transactions, payment status, and paid revenue from live orders.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-primary-button" onClick={handleExport}>
            Export Payments Excel
          </button>
        </div>
      </div>

      <div className="admin-kpi-grid" style={styles.summaryGrid}>
        <article className="admin-kpi-card">
          <span>Paid Revenue</span>
          <strong>{formatPrice(paidRevenue)}</strong>
          <small>{orders.filter(isPaidOrder).length} paid orders</small>
        </article>
        <article className="admin-kpi-card">
          <span>Total Payment Records</span>
          <strong>{paymentRows.length}</strong>
          <small>Synced from customer orders</small>
        </article>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Payment Filters</h3>
            <p>Filter by calendar date, payment ID, order ID, customer, amount, method, status, or date.</p>
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
            placeholder="Search payment ID, order ID, customer, amount, method, status..."
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
        <DataTable columns={columns} rows={filteredRows} rowKey="paymentId" />
        {filteredRows.length === 0 ? (
          <div className="admin-empty-state" style={styles.emptyState}>
            No payments match the selected filters.
          </div>
        ) : null}
      </div>
    </section>
  );
};

const styles = {
  summaryGrid: {
    marginBottom: "18px",
  },
  emptyState: {
    marginTop: "12px",
  },
};

export default Payments;
