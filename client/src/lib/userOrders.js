import { arrayUnion, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeOrderRecord } from "./adminStore";
import { normalizeOrderStatusKey } from "./orderStatus";
import { subscribeSafely } from "./firestoreSubscriptions";

const NON_CANCELABLE_STATUSES = new Set(["shipped", "out for delivery", "delivered", "cancelled"]);

function getCreatedAtTime(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return Date.now();
}

export function subscribeToUserOrders(uid, onOrders, onError) {
  if (!uid) {
    onOrders([]);
    return () => {};
  }

  return subscribeSafely(
    collection(db, "users", uid, "orders"),
    (snapshot) => {
      const orders = snapshot.docs
        .map((item) => normalizeOrderRecord({ id: item.id, ...item.data(), userId: uid }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onOrders(orders);
    },
    onError
  );
}

export function mergeOrdersWithCurrent(latestOrder, orders = []) {
  if (!latestOrder?.id) {
    return orders;
  }

  return [latestOrder, ...orders.filter((item) => item.id !== latestOrder.id)];
}

export function createOptimisticOrder(orderId, payload) {
  return normalizeOrderRecord({
    id: orderId,
    orderId,
    userId: payload.userId,
    customer: payload.customer,
    items: payload.items,
    itemCount: payload.itemCount,
    total: payload.total,
    status: payload.status || "placed",
    paymentMethod: payload.paymentMethod || "Razorpay Test",
    paymentStatus: payload.paymentStatus || "Paid",
    paymentProvider: payload.paymentProvider || "Razorpay",
    paymentMode: payload.paymentMode || "test",
    paymentId: payload.paymentId || "",
    paidAt: payload.paidAt || null,
    createdAt: new Date(),
  });
}

export function canCancelOrder(order) {
  const status = normalizeOrderStatusKey(order?.statusKey || order?.status);

  return Boolean(order?.id && order?.userId && !NON_CANCELABLE_STATUSES.has(status));
}

export async function cancelUserOrder(order) {
  if (!canCancelOrder(order)) {
    throw new Error("This order cannot be cancelled after shipping has started.");
  }

  await updateDoc(doc(db, "users", order.userId, "orders", order.id), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
    "statusTimeline.cancelled": serverTimestamp(),
    statusHistory: arrayUnion({
      status: "Cancel",
      statusKey: "cancelled",
      actor: "Customer",
      createdAt: new Date().toISOString(),
    }),
  });
}
