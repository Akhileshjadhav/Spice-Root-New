import { serverTimestamp } from "../firebase";

export const ORDER_STATUS_FLOW = [
  { key: "order confirmed", label: "Order Confirmed" },
  { key: "processed", label: "Processed" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "out for delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancel" },
];

const ORDER_STATUS_LABELS = ORDER_STATUS_FLOW.reduce((lookup, item) => {
  lookup.set(item.key, item.label);
  lookup.set(item.label.toLowerCase(), item.label);
  return lookup;
}, new Map());

const ORDER_STATUS_ALIASES = {
  placed: "order confirmed",
  pending: "order confirmed",
  confirmed: "order confirmed",
  processing: "processed",
  cancel: "cancelled",
  canceled: "cancelled",
  cancelled: "cancelled",
};

export const ORDER_STATUS_LABEL_OPTIONS = ORDER_STATUS_FLOW.map((item) => item.label);

export const ORDER_ALERT_STATUS_KEYS = new Set([
  "placed",
  "pending",
  "processing",
  "confirmed",
  "order confirmed",
  "processed",
  "packed",
]);

export const CLOSED_ORDER_STATUS_KEYS = new Set(["delivered", "cancelled"]);

export function normalizeOrderStatusKey(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  if (!normalized) {
    return "order confirmed";
  }

  return ORDER_STATUS_ALIASES[normalized] || normalized;
}

export function normalizeOrderStatusLabel(value) {
  const key = normalizeOrderStatusKey(value);
  return ORDER_STATUS_LABELS.get(key) || key.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function resolveOrderStatusInput(value) {
  const key = normalizeOrderStatusKey(value);
  return {
    key,
    label: normalizeOrderStatusLabel(key),
  };
}

export function buildCheckoutOrderStatusPayload() {
  const { key, label } = resolveOrderStatusInput("order confirmed");
  const createdAt = new Date().toISOString();

  return {
    status: key,
    statusTimeline: {
      [key]: serverTimestamp(),
    },
    statusHistory: [
      {
        status: label,
        statusKey: key,
        actor: "System",
        createdAt,
      },
    ],
  };
}
