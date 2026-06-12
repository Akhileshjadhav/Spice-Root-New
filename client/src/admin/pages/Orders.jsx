import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ActionButton from "../components/ActionButton";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { exportRowsToExcel } from "../utils/exportExcel";
import {
  getOrderStatusOptions,
  subscribeToOrders,
  updateOrderStatus,
} from "../../lib/adminStore";
import { useAuth } from "../../context/useAuth";

const Orders = () => {
  const navigate = useNavigate();
  const { adminProfile, currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [draftStatus, setDraftStatus] = useState("Pending");
  const [savingStatus, setSavingStatus] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [orderPeriod, setOrderPeriod] = useState("all");
  const [orderFromDate, setOrderFromDate] = useState("");
  const [orderToDate, setOrderToDate] = useState("");
  const requestedOrderId = searchParams.get("order") || "";
  const requestedUserId = searchParams.get("user") || "";
  const visibleOrders = useMemo(() => orders, [orders]);
  const dateFilteredOrders = useMemo(
    () =>
      visibleOrders.filter((order) =>
        isWithinDateFilters(order.createdAt, orderPeriod, orderFromDate, orderToDate)
      ),
    [orderFromDate, orderPeriod, orderToDate, visibleOrders]
  );
  const paymentOptions = useMemo(
    () => ["All", ...new Set(visibleOrders.map((order) => order.paymentMethod).filter(Boolean))],
    [visibleOrders]
  );
  const statusBaseOrders = useMemo(() => {
    const normalizedQuery = orderQuery.trim().toLowerCase();

    return dateFilteredOrders.filter((order) => {
      const matchesPayment = paymentFilter === "All" || order.paymentMethod === paymentFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          order.orderId,
          order.customerName,
          order.amountLabel,
          order.amount,
          order.paymentMethod,
          order.paymentStatus,
          order.status,
          order.date,
        ]
          .filter((value) => value !== undefined && value !== null)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesPayment && matchesQuery;
    });
  }, [dateFilteredOrders, orderQuery, paymentFilter]);
  const statusCounts = useMemo(
    () =>
      statusBaseOrders.reduce(
        (counts, order) => ({
          ...counts,
          [order.status]: (counts[order.status] || 0) + 1,
          All: counts.All + 1,
        }),
        { All: 0 }
      ),
    [statusBaseOrders]
  );
  const filteredOrders = useMemo(
    () =>
      statusBaseOrders.filter(
        (order) => statusFilter === "All" || order.status === statusFilter
      ),
    [statusBaseOrders, statusFilter]
  );

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      (items) => {
        setOrders(items);
      },
      (error) => console.error("Failed to load live orders:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setSelectedOrder(null);
      return;
    }

    const requestedOrder =
      filteredOrders.find(
        (item) =>
          item.id === requestedOrderId ||
          item.orderId === requestedOrderId ||
          (requestedUserId && item.userId === requestedUserId && item.id === requestedOrderId)
      ) || null;

    setSelectedOrder((current) => requestedOrder || filteredOrders.find((item) => item.id === current?.id) || filteredOrders[0]);
  }, [filteredOrders, requestedOrderId, requestedUserId]);

  useEffect(() => {
    setDraftStatus(selectedOrder?.status || "Pending");
  }, [selectedOrder]);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setSearchParams(
      order?.id
        ? {
            order: order.id,
            user: order.userId,
          }
        : {}
    );
  };

  const handleSaveStatus = async () => {
    if (!selectedOrder) {
      return;
    }

    try {
      setSavingStatus(true);
      await updateOrderStatus(
        selectedOrder,
        draftStatus,
        adminProfile?.name || currentUser?.displayName || currentUser?.email || "Admin"
      );
    } catch (error) {
      console.error("Failed to update order status:", error);
    } finally {
      setSavingStatus(false);
    }
  };

  const columns = [
    { key: "orderId", label: "Order ID" },
    {
      key: "customerName",
      label: "Customer",
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/admin/customer-details?user=${encodeURIComponent(row.userId)}&order=${encodeURIComponent(row.id)}`)}
          style={styles.customerButton}
        >
          {row.customerName}
        </button>
      ),
    },
    { key: "amountLabel", label: "Amount" },
    { key: "paymentMethod", label: "Payment" },
    { key: "status", label: "Status", type: "status" },
    { key: "date", label: "Date" },
    {
      key: "actions",
      label: "View",
      render: (row) => (
        <button type="button" onClick={() => handleSelectOrder(row)} style={styles.linkButton}>
          Open
        </button>
      ),
    },
  ];
  const exportColumns = [
    { key: "orderId", label: "Order ID" },
    { key: "customerName", label: "Customer" },
    { key: "amountLabel", label: "Amount" },
    { key: "paymentMethod", label: "Payment" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "status", label: "Order Status" },
    { key: "itemCount", label: "Items" },
    { key: "date", label: "Date" },
  ];
  const selectedOrderItemColumns = [
    { key: "name", label: "Product" },
    { key: "size", label: "Size", value: (row) => row.size || row.unit || "Standard pack" },
    { key: "quantity", label: "Quantity" },
    { key: "price", label: "Unit Price", value: (row) => `Rs ${Number(row.price || 0).toLocaleString("en-IN")}` },
    {
      key: "total",
      label: "Line Total",
      value: (row) => `Rs ${Number((row.price || 0) * (row.quantity || 0)).toLocaleString("en-IN")}`,
    },
  ];

  const handleExportOrders = () => {
    exportRowsToExcel({
      title: "Spice Root Orders",
      fileName: "spice-root-orders",
      columns: exportColumns,
      rows: filteredOrders,
    });
  };

  const handleExportSelectedOrder = () => {
    if (!selectedOrder) {
      return;
    }

    exportRowsToExcel({
      title: `Spice Root Order ${selectedOrder.orderId}`,
      fileName: `spice-root-order-${selectedOrder.orderId}`,
      columns: selectedOrderItemColumns,
      rows: selectedOrder.items,
    });
  };

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Orders</h2>
          <p>All customer orders stay here, while unread notifications are handled separately in the top bar.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-primary-button" onClick={handleExportOrders}>
            Export Orders Excel
          </button>
        </div>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Order Search & Status Filters</h3>
            <p>Filter by date, order ID, customer, amount, payment, and order status.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={handleExportOrders}>
            Download This Section
          </button>
        </div>

        <div className="admin-filter-row">
          <input
            className="admin-inline-search"
            value={orderQuery}
            onChange={(event) => setOrderQuery(event.target.value)}
            placeholder="Search order ID, customer, amount, payment, status..."
          />
          <select
            className="admin-inline-search"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
          >
            {paymentOptions.map((option) => (
              <option key={option} value={option}>
                {option === "All" ? "All Payments" : option}
              </option>
            ))}
          </select>
          <select
            className="admin-inline-search"
            value={orderPeriod}
            onChange={(event) => setOrderPeriod(event.target.value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="admin-inline-search"
            type="date"
            value={orderFromDate}
            onChange={(event) => setOrderFromDate(event.target.value)}
          />
          <input
            className="admin-inline-search"
            type="date"
            value={orderToDate}
            onChange={(event) => setOrderToDate(event.target.value)}
          />
        </div>

        <div className="admin-pill-list admin-status-filter-list">
          {["All", ...getOrderStatusOptions()].map((status) => (
            <button
              key={status}
              type="button"
              className={`admin-filter-chip${statusFilter === status ? " active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status} ({statusCounts[status] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="admin-split-grid">
        <div className="admin-module-card">
          <DataTable columns={columns} rows={filteredOrders} rowKey="id" />
          {filteredOrders.length === 0 ? (
            <div className="admin-empty-state" style={styles.emptyState}>
              No customer orders match the selected filters.
            </div>
          ) : null}
        </div>

        {selectedOrder ? (
          <aside className="admin-detail-card">
            <div className="admin-page-head compact">
              <div>
                <h3>Order Details</h3>
                <p>{selectedOrder.orderId}</p>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>
            <button
              type="button"
              className="admin-secondary-button admin-detail-export-button"
              onClick={handleExportSelectedOrder}
            >
              Download Order Detail
            </button>

            <div className="admin-detail-grid">
              <div><span>Customer</span><strong>{selectedOrder.customerName}</strong></div>
              <div><span>Phone</span><strong>{selectedOrder.phone}</strong></div>
              <div className="full"><span>Address</span><strong>{selectedOrder.address}</strong></div>
              <div><span>Payment</span><strong>{selectedOrder.paymentMethod}</strong></div>
              <div><span>Payment Status</span><strong>{selectedOrder.paymentStatus}</strong></div>
              <div><span>Items</span><strong>{selectedOrder.itemCount}</strong></div>
            </div>

            <label style={styles.statusField}>
              <span>Order Status</span>
              <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                {getOrderStatusOptions().map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.itemsWrap}>
              {selectedOrder.items.map((item) => (
                <div key={item.key || `${item.id}-${item.size || "default"}`} style={styles.itemRow}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.size || item.unit || "Standard pack"}</span>
                  </div>
                  <div style={styles.itemMeta}>
                    <span>Qty {item.quantity}</span>
                    <strong>Rs {Number((item.price || 0) * (item.quantity || 0)).toLocaleString("en-IN")}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-page-actions stretch">
              <ActionButton onClick={() => navigate(`/admin/customer-details?user=${encodeURIComponent(selectedOrder.userId)}&order=${encodeURIComponent(selectedOrder.id)}`)}>
                Open Customer
              </ActionButton>
              <ActionButton variant="primary" onClick={handleSaveStatus} disabled={savingStatus}>
                {savingStatus ? "Saving..." : "Save Status"}
              </ActionButton>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
};

const styles = {
  linkButton: {
    cursor: "pointer",
    color: "var(--ad-accent)",
    fontSize: "0.92rem",
    background: "transparent",
    border: 0,
  },
  customerButton: {
    cursor: "pointer",
    color: "var(--ad-text)",
    fontSize: "0.9rem",
    background: "transparent",
    border: 0,
    padding: 0,
    textAlign: "left",
  },
  emptyState: {
    marginTop: "12px",
  },
  statusField: {
    display: "grid",
    gap: "8px",
    marginBottom: "18px",
    color: "var(--ad-muted)",
  },
  itemsWrap: {
    display: "grid",
    gap: "12px",
    marginTop: "18px",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "var(--ad-bg2)",
  },
  itemMeta: {
    display: "grid",
    justifyItems: "end",
    gap: "4px",
  },
};

export default Orders;
