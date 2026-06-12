function normalizeTone(status) {
  const value = String(status || "").toLowerCase();

  if (["active", "paid", "approved", "delivered", "confirmed", "resolved", "in stock"].includes(value)) {
    return "success";
  }

  if (["processing", "pending", "in progress", "shipped", "expiring", "draft"].includes(value)) {
    return "warning";
  }

  if (["cancelled", "cancelled", "inactive", "out of stock", "refunded", "closed"].includes(value)) {
    return "danger";
  }

  return "neutral";
}

function StatusBadge({ status }) {
  return (
    <span className={`admin-status-pill admin-status-${normalizeTone(status)}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
