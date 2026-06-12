import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import { subscribeToOrders } from "../../lib/adminStore";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { exportRowsToExcel } from "../utils/exportExcel";

const columns = [
  { key: "shipmentId", label: "Shipment ID" },
  { key: "orderId", label: "Order ID" },
  { key: "courier", label: "Courier" },
  { key: "tracking", label: "Tracking" },
  { key: "status", label: "Status", type: "status" },
  { key: "dispatch", label: "Dispatch Date" },
  { key: "eta", label: "ETA" },
];

function buildShippingRowsFromOrders(orders) {
  return orders.map((order) => {
    const raw = order.raw || {};
    const orderId = order.orderId || order.id;

    return {
      shipmentId: raw.shipmentId || `SHIP-${String(orderId || order.id).replace(/[^a-z0-9]/gi, "").slice(-8)}`,
      orderId,
      courier: raw.courier || raw.shippingCourier || "Pending Assignment",
      tracking: raw.tracking || raw.trackingNumber || "Not assigned",
      status: order.status,
      dispatch: raw.dispatchDate || raw.dispatch || order.date,
      eta: raw.eta || raw.estimatedDelivery || "Pending",
      createdAt: order.createdAt,
    };
  });
}

const Shipping = () => {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load live shipping orders:", error)
    );

    return () => unsubscribe();
  }, []);

  const allRows = useMemo(() => buildShippingRowsFromOrders(orders), [orders]);
  const statusOptions = useMemo(
    () => ["All", ...new Set(allRows.map((item) => item.status).filter(Boolean))],
    [allRows]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return allRows.filter((item) => {
      const matchesDate = isWithinDateFilters(item.createdAt || item.dispatch, period, fromDate, toDate);
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          item.shipmentId,
          item.orderId,
          item.courier,
          item.tracking,
          item.status,
          item.dispatch,
          item.eta,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesDate && matchesStatus && matchesQuery;
    });
  }, [allRows, fromDate, period, query, statusFilter, toDate]);

  const handleExport = () => {
    exportRowsToExcel({
      title: "Spice Root Shipping Details",
      fileName: "spice-root-shipping-details",
      columns,
      rows: filteredRows,
    });
  };

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Shipping / Delivery</h2>
          <p>Watch courier movement and delivery deadlines.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-primary-button" onClick={handleExport}>
            Export Shipping Details Excel
          </button>
        </div>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Shipping Filters</h3>
            <p>Filter by calendar date, shipment ID, order ID, courier, tracking, status, dispatch date, or ETA.</p>
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
            placeholder="Search shipment ID, order ID, courier, tracking, status, dispatch, ETA..."
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
        <DataTable columns={columns} rows={filteredRows} rowKey="shipmentId" />
        {filteredRows.length === 0 ? (
          <div className="admin-empty-state" style={{ marginTop: "12px" }}>
            {allRows.length === 0
              ? "No live orders yet. Shipping rows will appear here once customers place orders."
              : "No shipping records match the selected filters."}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Shipping;
