import { useState } from "react";
import {
  FaBox,
  FaCheckCircle,
  FaClipboardList,
  FaMotorcycle,
  FaShippingFast,
  FaSyncAlt,
  FaTimesCircle,
} from "react-icons/fa";
import { formatPrice, formatProductMeta } from "../../lib/catalog";
import { ORDER_STATUS_FLOW, normalizeOrderStatusKey } from "../../lib/orderStatus";
import { canCancelOrder } from "../../lib/userOrders";

const TRACKING_STEPS = ORDER_STATUS_FLOW.filter((item) => item.key !== "cancelled").map((item) => ({
  key: item.key,
  label: item.label,
  icon:
    item.key === "order confirmed"
      ? FaClipboardList
      : item.key === "processed"
        ? FaSyncAlt
        : item.key === "packed"
          ? FaBox
          : item.key === "shipped"
            ? FaShippingFast
            : item.key === "out for delivery"
              ? FaMotorcycle
              : FaCheckCircle,
}));

function getStepState(orderStatus, stepKey, stepIndex) {
  const normalizedStatus = normalizeOrderStatusKey(orderStatus);

  if (normalizedStatus === "cancelled") {
    return "pending";
  }

  const currentIndex = TRACKING_STEPS.findIndex((step) => step.key === normalizedStatus);
  const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;

  if (stepIndex < safeCurrentIndex) {
    return "complete";
  }

  if (stepIndex === safeCurrentIndex || stepKey === normalizedStatus) {
    return "current";
  }

  return "pending";
}

function formatTimelineTime(order, stepKey) {
  const value = order.statusTimeline?.[stepKey] || (stepKey === "order confirmed" ? order.createdAt : null);
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : value
          ? new Date(value)
          : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Updates when this step is reached";
  }

  return date.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrackingFlow({ order, variant = "compact" }) {
  const isCancelled = normalizeOrderStatusKey(order.statusKey || order.status) === "cancelled";
  const className = variant === "vertical" ? "order-tracking-flow vertical" : "order-tracking-flow";

  return (
    <div className={`${className}${isCancelled ? " is-cancelled" : ""}`}>
      {TRACKING_STEPS.map((step, index) => {
        const state = getStepState(order.status, step.key, index);
        const Icon = step.icon;

        return (
          <div key={step.key} className={`order-tracking-step ${state}`}>
            <span aria-hidden="true">
              <Icon />
            </span>
            <div>
              <strong>{step.label}</strong>
              {variant === "vertical" ? <small>{formatTimelineTime(order, step.key)}</small> : null}
            </div>
          </div>
        );
      })}
      {isCancelled ? (
        <div className="order-tracking-step cancelled">
          <span aria-hidden="true">
            <FaTimesCircle />
          </span>
          <div>
            <strong>Cancel</strong>
            {variant === "vertical" ? <small>{formatTimelineTime(order, "cancel")}</small> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderHistoryPanel({
  orders = [],
  title = "Order History",
  subtitle = "Your saved orders appear here automatically.",
  highlightOrderId = "",
  emptyTitle = "No orders yet.",
  emptyBody = "Place your first order to see it here.",
  onCancelOrder,
  onDownloadInvoice,
  cancellingOrderId = "",
}) {
  const [expandedOrderId, setExpandedOrderId] = useState(highlightOrderId || "");

  return (
    <section className="ember-surface order-history-panel">
      <div className="order-history-head">
        <div>
          <span className="checkout-section-kicker">Orders</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="order-history-empty">
          <h3>{emptyTitle}</h3>
          <p>{emptyBody}</p>
        </div>
      ) : (
        <div className="order-history-list">
          {orders.map((order) => (
            <article key={order.id} className="order-history-card">
              <div className="order-history-row">
                <div>
                  <div className="order-history-order-line">
                    <strong>{order.orderId}</strong>
                    {highlightOrderId === order.id ? (
                      <span>Current Order</span>
                    ) : null}
                  </div>
                  <small>{order.date}</small>
                </div>
                <div className="order-history-amount">
                  <strong>{order.amountLabel || formatPrice(order.amount)}</strong>
                  <small>{order.status}</small>
                </div>
              </div>

              <div className="order-history-actions">
                <div className="order-history-product-names">
                  {order.items.map((item) => (
                    <strong key={item.key || `${item.id}-${item.size || "default"}`}>{item.name}</strong>
                  ))}
                </div>
                <button
                  type="button"
                  className="catalog-text-button"
                  onClick={() => setExpandedOrderId((current) => (current === order.id ? "" : order.id))}
                >
                  {expandedOrderId === order.id ? "Hide Tracking" : "Track Order"}
                </button>
                {onCancelOrder && canCancelOrder(order) ? (
                  <button
                    type="button"
                    className="catalog-text-button cart-remove-button"
                    disabled={cancellingOrderId === order.id}
                    onClick={() => onCancelOrder(order)}
                  >
                    {cancellingOrderId === order.id ? "Cancelling..." : "Cancel Order"}
                  </button>
                ) : null}
                {String(order.status || "").trim().toLowerCase() === "delivered" && onDownloadInvoice ? (
                  <button
                    type="button"
                    className="catalog-text-button"
                    onClick={() => onDownloadInvoice(order)}
                  >
                    Download Invoice
                  </button>
                ) : null}
              </div>

              {expandedOrderId === order.id ? (
                <div className="order-tracking-detail">
                  <TrackingFlow order={order} variant="vertical" />
                </div>
              ) : null}

              {expandedOrderId === order.id ? null : (
              <div className="order-history-items">
                {order.items.map((item) => (
                  <div key={item.key || `${item.id}-${item.size || "default"}`} className="order-history-item-row">
                    <div>
                      <strong>{item.name}</strong>
                      <small>{formatProductMeta(item) || "Standard pack"}</small>
                    </div>
                    <div className="order-history-amount">
                      <small>Qty {item.quantity}</small>
                      <strong>{formatPrice((item.price || 0) * (item.quantity || 0))}</strong>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default OrderHistoryPanel;
