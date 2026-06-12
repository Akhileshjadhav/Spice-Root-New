import {
  addDoc,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  query,
  orderBy,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, serverTimestamp } from "../firebase";
import { formatPrice, slugify } from "./catalog";
import { cleanupSubscriptions, subscribeSafely } from "./firestoreSubscriptions";
import { recordAdminLog } from "./adminLogs";
import {
  CLOSED_ORDER_STATUS_KEYS,
  ORDER_ALERT_STATUS_KEYS,
  ORDER_STATUS_LABEL_OPTIONS,
  normalizeOrderStatusKey,
  normalizeOrderStatusLabel,
  resolveOrderStatusInput,
} from "./orderStatus";

const ORDER_ALERT_STATUSES = ORDER_ALERT_STATUS_KEYS;
const CLOSED_ORDER_STATUSES = CLOSED_ORDER_STATUS_KEYS;
const ORDER_STATUS_OPTIONS = ORDER_STATUS_LABEL_OPTIONS;
const REVIEW_STATUS_OPTIONS = ["Pending", "Approved", "Hidden"];
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const PRODUCT_HISTORY_COLLECTION = "productHistory";
const ADMINS_COLLECTION = "admins";
const BEST_SELLERS_COLLECTION = "bestSellers";

function normalizeLabel(value, fallback = "") {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || fallback;
}

function normalizeStatus(value, fallback = "Pending") {
  const normalizedValue = normalizeLabel(value, fallback)
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  return normalizedValue.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getCreatedAtTime(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (!value) {
    return Date.now();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? Date.now() : parsedDate.getTime();
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatOrderDate(value) {
  const rawDate = toDate(value);

  if (!rawDate) {
    return "Just now";
  }

  return rawDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value) {
  const rawDate = toDate(value);

  if (!rawDate) {
    return "Today";
  }

  return rawDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function formatDateTime(value) {
  const rawDate = toDate(value);

  if (!rawDate) {
    return "Just now";
  }

  return rawDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value) {
  const rawDate = toDate(value);

  if (!rawDate) {
    return "Just now";
  }

  return rawDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSku(value = "") {
  const parts = slugify(value)
    .split("-")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.slice(0, 2).toUpperCase());

  return `SR-${parts.join("") || "PRD"}`;
}

function getStartOfDayTimestamp(date) {
  const rawDate = new Date(date);
  rawDate.setHours(0, 0, 0, 0);
  return rawDate.getTime();
}

function isWithinDays(value, dayCount) {
  const time = getCreatedAtTime(value);

  if (!time) {
    return false;
  }

  return Date.now() - time <= dayCount * MILLIS_IN_DAY;
}

function formatJoinedLabel(value) {
  if (!value) {
    return "Joined recently";
  }

  return `Joined ${formatShortDate(value)}`;
}

const DEFAULT_CATEGORY_DEFINITIONS = [
  {
    id: "masala",
    name: "Masala",
    description: "Premium spice blends and masalas.",
  },
  {
    id: "flour",
    name: "Flour",
    description: "Everyday and millet flours.",
  },
  {
    id: "pantry",
    name: "Pantry",
    description: "Pantry staples and essentials.",
  },
];

export function getDefaultCategoryDefinitions() {
  return DEFAULT_CATEGORY_DEFINITIONS.map((item) => ({ ...item }));
}

export function getProductStatusOptions() {
  return ["Active", "Low Stock", "Coming Soon"];
}

export function getOrderStatusOptions() {
  return ORDER_STATUS_OPTIONS;
}

export function getReviewStatusOptions() {
  return REVIEW_STATUS_OPTIONS;
}

export function buildCategoryPayload(values) {
  return {
    name: normalizeLabel(values.name),
    image: normalizeLabel(values.image),
    description: normalizeLabel(values.description),
  };
}

export async function saveCategory(categoryId, values) {
  const name = normalizeLabel(values.name);
  const resolvedCategoryId = slugify(categoryId || name);

  if (!resolvedCategoryId) {
    throw new Error("Category name is required.");
  }

  await setDoc(doc(db, "categories", resolvedCategoryId), buildCategoryPayload(values), {
    merge: true,
  });

  await recordAdminLog({
    section: "Categories",
    action: categoryId ? "Category updated" : "Category created",
    target: name,
    details: values.description || "",
  });

  return resolvedCategoryId;
}

export async function deleteCategory(categoryId) {
  if (!categoryId) {
    throw new Error("Category reference is missing.");
  }

  await deleteDoc(doc(db, "categories", categoryId));
  await recordAdminLog({
    section: "Categories",
    action: "Category deleted",
    target: categoryId,
  });
}

export function mergeCategoriesWithProducts(categoryDocs = [], products = []) {
  const categories = new Map();

  categoryDocs.forEach((item) => {
    const name = normalizeLabel(item.name, item.id);
    const id = slugify(item.id || name);

    categories.set(id, {
      id,
      name,
      image: normalizeLabel(item.image),
      description: normalizeLabel(item.description),
      productCount: 0,
    });
  });

  products.forEach((product) => {
    const name = normalizeLabel(product.category, "Uncategorized");
    const id = slugify(name);
    
    if (!categories.has(id)) {
      categories.set(id, {
        id,
        name,
        image: product.image || "",
        description: "",
        productCount: 0,
      });
    }

    const current = categories.get(id);
    categories.set(id, {
      ...current,
      productCount: (current.productCount || 0) + 1,
    });
  });

  return Array.from(categories.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export function subscribeToCategories(onCategories, onError) {
  return subscribeSafely(
    collection(db, "categories"),
    (snapshot) => {
      const categoryDocs = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      onCategories(categoryDocs);
    },
    onError
  );
}

function normalizeAdminUserRecord(record) {
  const createdAt = record.createdAt || null;
  const updatedAt = record.updatedAt || null;
  const lastLoginAt = record.lastLoginAt || null;
  const uid = normalizeLabel(record.uid || record.id);

  return {
    id: record.id || uid,
    uid,
    name: normalizeLabel(record.name, "Admin User"),
    email: normalizeLabel(record.email),
    role: normalizeLabel(record.role, "admin"),
    status: normalizeStatus(record.status, "active"),
    createdAt,
    updatedAt,
    lastLoginAt,
    lastLogin: lastLoginAt ? formatDateTime(lastLoginAt) : "Not logged in yet",
  };
}

export function subscribeToAdminUsers(onUsers, onError) {
  return subscribeSafely(
    collection(db, ADMINS_COLLECTION),
    (snapshot) => {
      const rows = snapshot.docs
        .map((item) => normalizeAdminUserRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => left.name.localeCompare(right.name));

      onUsers(rows);
    },
    onError
  );
}

export async function saveAdminUser(values = {}) {
  const uid = normalizeLabel(values.uid || values.id);
  const email = normalizeLabel(values.email).toLowerCase();
  const name = normalizeLabel(values.name, "Admin User");

  if (!uid) {
    throw new Error("Firebase Auth UID is required to grant admin access.");
  }

  if (!email) {
    throw new Error("Admin email is required.");
  }

  await setDoc(
    doc(db, ADMINS_COLLECTION, uid),
    {
      uid,
      email,
      name,
      role: normalizeLabel(values.role, "admin"),
      status: normalizeLabel(values.status, "active"),
      updatedAt: serverTimestamp(),
      ...(values.id ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  await recordAdminLog({
    section: "Admin Users",
    action: values.id ? "Admin user updated" : "Admin user created",
    target: email,
    details: name,
  });

  return uid;
}

export async function deleteAdminUser(adminUserId) {
  if (!adminUserId) {
    return;
  }

  await deleteDoc(doc(db, ADMINS_COLLECTION, adminUserId));
  await recordAdminLog({
    section: "Admin Users",
    action: "Admin user removed",
    target: adminUserId,
  });
}

function normalizeBestSellerRecord(record = {}) {
  const productName = normalizeLabel(record.productName || record.name, "Best Seller");
  const basePrice = Number(record.price ?? record.basePrice) || 0;

  return {
    id: record.id || "",
    sourceProductId: normalizeLabel(record.sourceProductId),
    productName,
    name: productName,
    category: normalizeLabel(record.category, "Best Seller"),
    price: basePrice,
    priceLabel: formatPrice(basePrice),
    stock: Number(record.stock) || 0,
    imageUrl: normalizeLabel(record.imageUrl || record.image, "/images/mirchi.png"),
    image: normalizeLabel(record.imageUrl || record.image, "/images/mirchi.png"),
    description: normalizeLabel(record.description),
    highlights: Array.isArray(record.highlights) && record.highlights.length
      ? record.highlights.filter(Boolean)
      : ["Premium quality", "Freshly packed", "Customer favorite"],
    status: normalizeStatus(record.status, "Active"),
    sortOrder: Number(record.sortOrder) || 0,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

export function subscribeToBestSellers(onBestSellers, onError) {
  return subscribeSafely(
    collection(db, BEST_SELLERS_COLLECTION),
    (snapshot) => {
      const rows = snapshot.docs
        .map((item) => normalizeBestSellerRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.productName.localeCompare(right.productName));

      onBestSellers(rows);
    },
    onError
  );
}

export async function saveBestSeller(values = {}) {
  const productName = normalizeLabel(values.productName || values.name, "Best Seller");
  const bestSellerId = values.id || values.sourceProductId || slugify(productName) || `best-seller-${Date.now()}`;

  await setDoc(
    doc(db, BEST_SELLERS_COLLECTION, bestSellerId),
    {
      sourceProductId: normalizeLabel(values.sourceProductId),
      productName,
      category: normalizeLabel(values.category, "Best Seller"),
      price: Number(values.price ?? values.basePrice) || 0,
      stock: Number(values.stock) || 0,
      imageUrl: normalizeLabel(values.imageUrl || values.image, "/images/mirchi.png"),
      description: normalizeLabel(values.description),
      highlights: Array.isArray(values.highlights) && values.highlights.length
        ? values.highlights.filter(Boolean)
        : ["Premium quality", "Freshly packed", "Customer favorite"],
      status: normalizeStatus(values.status, "Active"),
      sortOrder: Number(values.sortOrder) || 0,
      updatedAt: serverTimestamp(),
      ...(values.id ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  await recordAdminLog({
    section: "Best Sellers",
    action: values.id ? "Best seller updated" : "Best seller added",
    target: productName,
    details: normalizeLabel(values.category, "Best Seller"),
  });

  return bestSellerId;
}

export async function deleteBestSeller(bestSellerId) {
  if (!bestSellerId) {
    return;
  }

  await deleteDoc(doc(db, BEST_SELLERS_COLLECTION, bestSellerId));
  await recordAdminLog({
    section: "Best Sellers",
    action: "Best seller removed",
    target: bestSellerId,
  });
}

function getProductDocumentId(product = {}) {
  return product.documentId || product.id || product.slug || slugify(product.name || product.productName);
}

export async function logProductHistory(action, product = {}) {
  const productId = getProductDocumentId(product);
  const productName = normalizeLabel(product.name || product.productName, "Product");
  const basePrice = Number(product.basePrice ?? product.price) || 0;

  await addDoc(collection(db, PRODUCT_HISTORY_COLLECTION), {
    action: normalizeStatus(action, "Updated"),
    productId,
    productName,
    category: normalizeLabel(product.category, "Uncategorized"),
    totalCount: Number(product.stock) || 0,
    price: basePrice,
    status: normalizeStatus(product.status, "Active"),
    imageUrl: product.image || product.imageUrl || "",
    sku: product.sku || buildSku(product.slug || productName),
    priceTiers: Array.isArray(product.priceTiers) ? product.priceTiers : [],
    createdAt: serverTimestamp(),
  });

  await recordAdminLog({
    section: "Products",
    action: `Product ${normalizeStatus(action, "Updated").toLowerCase()}`,
    target: productName,
    details: `${normalizeLabel(product.category, "Uncategorized")} - ${formatPrice(basePrice)}`,
  });
}

function normalizeProductHistoryRecord(record) {
  const createdAt = record.createdAt || null;

  return {
    id: record.id,
    action: normalizeStatus(record.action, "Updated"),
    productId: normalizeLabel(record.productId),
    productName: normalizeLabel(record.productName || record.name, "Product"),
    category: normalizeLabel(record.category, "Uncategorized"),
    totalCount: Number(record.totalCount ?? record.stock) || 0,
    price: Number(record.price) || 0,
    priceLabel: formatPrice(Number(record.price) || 0),
    status: normalizeStatus(record.status, "Active"),
    imageUrl: normalizeLabel(record.imageUrl || record.image),
    sku: normalizeLabel(record.sku),
    createdAt,
    date: formatOrderDate(createdAt),
    time: formatTime(createdAt),
    dateTime: formatDateTime(createdAt),
  };
}

export function subscribeToProductHistory(onHistory, onError) {
  return subscribeSafely(
    collection(db, PRODUCT_HISTORY_COLLECTION),
    (snapshot) => {
      const rows = snapshot.docs
        .map((item) => normalizeProductHistoryRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onHistory(rows);
    },
    onError
  );
}

export function normalizeOrderRecord(record) {
  const customer = record.customer || {};
  const statusKey = normalizeOrderStatusKey(record.status);
  const status = normalizeOrderStatusLabel(statusKey);
  const paymentMethod = normalizeLabel(
    record.paymentMethod || record.payment || "",
    "Cash on Delivery"
  );
  const paymentStatus = normalizeStatus(
    record.paymentStatus || (paymentMethod === "Cash on Delivery" ? "Pending" : "Paid"),
    paymentMethod === "Cash on Delivery" ? "Pending" : "Paid"
  );
  const customerName = normalizeLabel(
    record.customerName || customer.fullName || customer.name || record.customer,
    "Customer"
  );
  const phone = normalizeLabel(
    customer.mobileNumber || customer.phone || record.phone,
    "Not provided"
  );
  const address = [
    customer.addressLine1 || record.addressLine1 || record.address,
    customer.addressLine2 || record.addressLine2,
    customer.city || record.city,
    customer.state || record.state,
    customer.pincode || record.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const total = Number(record.total) || 0;
  const createdAt = record.createdAt || null;

  return {
    id: record.id,
    orderId: record.orderId || record.orderNumber || record.id,
    userId: record.userId || "",
    customerName,
    customerEmail: normalizeLabel(customer.email || record.customerEmail),
    phone,
    address: address || "Address not provided",
    amount: total,
    amountLabel: formatPrice(total),
    paymentMethod,
    paymentStatus,
    paymentProvider: normalizeLabel(record.paymentProvider),
    paymentMode: normalizeLabel(record.paymentMode),
    paymentId: normalizeLabel(record.paymentId),
    paidAt: record.paidAt || null,
    razorpayOrderId: normalizeLabel(record.razorpayOrderId),
    razorpaySignature: normalizeLabel(record.razorpaySignature),
    status,
    statusKey,
    date: formatOrderDate(createdAt),
    createdAt,
    updatedAt: record.updatedAt || null,
    statusTimeline: record.statusTimeline || {},
    statusHistory: Array.isArray(record.statusHistory) ? record.statusHistory : [],
    itemCount: Number(record.itemCount) || 0,
    items: Array.isArray(record.items) ? record.items : [],
    raw: record,
    subtotal: Number(record.subtotal) || 0,
    discountAmount: Number(record.discountAmount) || 0,
    couponCode: record.couponCode || "",
    coupon: record.coupon || null,
  };
}

export function subscribeToOrders(onOrders, onError) {
  return subscribeSafely(
    query(collectionGroup(db, "orders"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const orders = snapshot.docs
        .map((item) =>
          normalizeOrderRecord({
            id: item.id,
            ...item.data(),
            userId: item.ref.parent.parent?.id || "",
          })
        )
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onOrders(orders);
    },
    onError
  );
}

export async function updateOrderStatus(order, status, adminName = "Admin") {
  if (!order?.userId || !order?.id) {
    throw new Error("Order reference is missing.");
  }

  const { key: statusKey, label: statusLabel } = resolveOrderStatusInput(status);

  await updateDoc(doc(db, "users", order.userId, "orders", order.id), {
    status: statusKey,
    updatedAt: serverTimestamp(),
    [`statusTimeline.${statusKey}`]: serverTimestamp(),
    statusHistory: arrayUnion({
      status: statusLabel,
      statusKey,
      actor: "Admin",
      createdAt: new Date().toISOString(),
    }),
  });

  await recordAdminLog({
    section: "Orders",
    action: `Order status updated to ${statusLabel}`,
    target: order.orderId || order.id,
    adminName,
    details: `${order.customerName || "Customer"} - ${order.amountLabel || ""}`,
  });
}

export async function createAdminOrderNotification(order) {
  await addDoc(collection(db, "adminNotifications"), buildAdminOrderNotificationPayload(order));
}

export function buildAdminOrderNotificationPayload(order) {
  const normalizedOrder = normalizeOrderRecord(order);

  return {
    type: "order",
    userId: normalizedOrder.userId,
    orderId: normalizedOrder.orderId,
    orderDocumentId: normalizedOrder.id,
    customerName: normalizedOrder.customerName,
    customerEmail: normalizedOrder.customerEmail,
    status: "Unread",
    orderStatus: normalizedOrder.status,
    createdAt: serverTimestamp(),
  };
}

function normalizeNotificationRecord(record) {
  const status = normalizeStatus(record.status, "Unread");
  const customerName = normalizeLabel(record.customerName, "Customer");
  const orderId = normalizeLabel(record.orderId, record.orderDocumentId || record.id);

  return {
    id: record.id,
    type: record.type || "order",
    userId: record.userId || "",
    orderId,
    orderDocumentId: record.orderDocumentId || "",
    customerName,
    customerEmail: normalizeLabel(record.customerEmail),
    status,
    orderStatus: normalizeStatus(record.orderStatus, "Pending"),
    createdAt: record.createdAt || null,
    date: formatDateTime(record.createdAt),
    title: `${customerName} placed a new order`,
    message: `Order ${orderId} is waiting for admin review.`,
    isUnread: status === "Unread",
  };
}

export function subscribeToAdminNotifications(onNotifications, onError) {
  return subscribeSafely(
    collection(db, "adminNotifications"),
    (snapshot) => {
      const notifications = snapshot.docs
        .map((item) => normalizeNotificationRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onNotifications(notifications);
    },
    onError
  );
}

export async function markAdminNotificationAsRead(notificationId) {
  if (!notificationId) {
    return;
  }

  await updateDoc(doc(db, "adminNotifications", notificationId), {
    status: "Read",
    readAt: serverTimestamp(),
  });
}

export async function acknowledgeAdminOrderNotification(notification) {
  if (!notification?.id) {
    return;
  }

  await markAdminNotificationAsRead(notification.id);
}

export function getOrderNotificationCounts(orders = [], notifications = []) {
  const unreadNotifications = notifications.filter((item) => item.isUnread).length;

  return orders.reduce(
    (counts, order) => {
      const normalizedStatus = normalizeOrderStatusKey(order.statusKey || order.status);

      if (!CLOSED_ORDER_STATUSES.has(normalizedStatus)) {
        counts.pendingDeliveries += 1;
      }

      return counts;
    },
    { newOrders: unreadNotifications, pendingDeliveries: 0 }
  );
}

export function getPendingAdminOrders(orders = []) {
  return orders.filter((order) => {
    const status = normalizeOrderStatusKey(order.statusKey || order.status);
    return !CLOSED_ORDER_STATUSES.has(status);
  });
}

export function isPaidOrder(order) {
  return String(order?.paymentStatus || "").trim().toLowerCase() === "paid";
}

export function buildPaymentRows(orders = []) {
  return orders
    .filter((order) => order.paymentMethod || order.paymentStatus)
    .map((order) => ({
      paymentId: order.paymentId || `PAY-${order.id}`,
      orderId: order.orderId,
      customer: order.customerName,
      amount: order.amountLabel,
      amountValue: order.amount,
      method: order.paymentMethod,
      status: order.paymentStatus,
      date: order.date,
      raw: order,
    }));
}

function normalizeContactSubmissionRecord(record) {
  const createdAt = record.createdAt || null;
  const updatedAt = record.updatedAt || null;
  const adminReply = normalizeLabel(record.adminReply);
  const status = normalizeStatus(record.status, "New");

  return {
    id: record.id,
    userId: record.userId || "",
    name: normalizeLabel(record.name, "Customer"),
    email: normalizeLabel(record.email, "No email"),
    message: normalizeLabel(record.message),
    status,
    createdAt,
    updatedAt,
    date: formatOrderDate(createdAt),
    dateTime: formatDateTime(createdAt),
    adminSeen: Boolean(record.adminSeen),
    adminReply,
    adminReplyAt: record.adminReplyAt || null,
    userReplySeen: adminReply ? Boolean(record.userReplySeen) : true,
    hasUnreadReply: Boolean(adminReply) && !record.userReplySeen,
    subject: normalizeLabel(record.subject, normalizeLabel(record.message).slice(0, 42) || "Customer query"),
    preview:
      normalizeLabel(record.message).slice(0, 82) +
      (normalizeLabel(record.message).length > 82 ? "..." : ""),
  };
}

export function subscribeToContactSubmissions(onSubmissions, onError) {
  return subscribeSafely(
    collection(db, "contactSubmissions"),
    (snapshot) => {
      const submissions = snapshot.docs
        .map((item) => normalizeContactSubmissionRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onSubmissions(submissions);
    },
    onError
  );
}

export function subscribeToUserContactSubmissions(userId, email, onSubmissions, onError) {
  if (!userId && !email) {
    onSubmissions([]);
    return () => {};
  }

  const submissionsById = new Map();

  const pushMergedSubmissions = () => {
    const submissions = Array.from(submissionsById.values()).sort(
      (left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt)
    );
    onSubmissions(submissions);
  };

  const unsubscribers = [];

  if (userId) {
    unsubscribers.push(
      subscribeSafely(
        query(collection(db, "contactSubmissions"), where("userId", "==", userId)),
        (snapshot) => {
          snapshot.docs.forEach((item) => {
            submissionsById.set(
              item.id,
              normalizeContactSubmissionRecord({ id: item.id, ...item.data() })
            );
          });
          pushMergedSubmissions();
        },
        onError
      )
    );
  }

  if (email) {
    unsubscribers.push(
      subscribeSafely(
        query(collection(db, "contactSubmissions"), where("email", "==", email)),
        (snapshot) => {
          snapshot.docs.forEach((item) => {
            submissionsById.set(
              item.id,
              normalizeContactSubmissionRecord({ id: item.id, ...item.data() })
            );
          });
          pushMergedSubmissions();
        },
        onError
      )
    );
  }

  return () => {
    cleanupSubscriptions(unsubscribers, onError);
  };
}

export async function markContactSubmissionAsRead(submissionId) {
  if (!submissionId) {
    return;
  }

  await updateDoc(doc(db, "contactSubmissions", submissionId), {
    adminSeen: true,
    updatedAt: serverTimestamp(),
  });

  await recordAdminLog({
    section: "Customer Queries",
    action: "Query marked as read",
    target: submissionId,
  });
}

export async function replyToContactSubmission(submissionId, reply, currentStatus = "Replied") {
  if (!submissionId) {
    return;
  }

  await updateDoc(doc(db, "contactSubmissions", submissionId), {
    adminReply: normalizeLabel(reply),
    adminReplyAt: serverTimestamp(),
    adminSeen: true,
    userReplySeen: false,
    status: normalizeStatus(currentStatus, "Replied"),
    updatedAt: serverTimestamp(),
  });

  await recordAdminLog({
    section: "Customer Queries",
    action: "Admin replied to query",
    target: submissionId,
    details: normalizeLabel(reply).slice(0, 120),
  });
}

export async function markContactReplyAsSeen(submissionId) {
  if (!submissionId) {
    return;
  }

  await updateDoc(doc(db, "contactSubmissions", submissionId), {
    userReplySeen: true,
    updatedAt: serverTimestamp(),
  });
}

function normalizeUserQueryReplyRecord(record) {
  return {
    id: record.id,
    submissionId: record.submissionId || "",
    subject: normalizeLabel(record.subject, "Admin reply"),
    adminReply: normalizeLabel(record.adminReply),
    createdAt: record.createdAt || null,
    dateTime: formatDateTime(record.createdAt),
    seen: Boolean(record.seen),
  };
}

export function subscribeToUserQueryReplyNotifications(userId, onNotifications, onError) {
  if (!userId) {
    onNotifications([]);
    return () => {};
  }

  return subscribeSafely(
    collection(db, "users", userId, "queryReplies"),
    (snapshot) => {
      const notifications = snapshot.docs
        .map((item) => normalizeUserQueryReplyRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onNotifications(notifications);
    },
    onError
  );
}

export async function createUserQueryReplyNotification(userId, submissionId, subject, adminReply) {
  if (!userId || !submissionId) {
    return;
  }

  await setDoc(
    doc(db, "users", userId, "queryReplies", submissionId),
    {
      submissionId,
      subject: normalizeLabel(subject, "Customer query"),
      adminReply: normalizeLabel(adminReply),
      seen: false,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markUserQueryReplyNotificationSeen(userId, notificationId) {
  if (!userId || !notificationId) {
    return;
  }

  await updateDoc(doc(db, "users", userId, "queryReplies", notificationId), {
    seen: true,
  });
}

function getOrderedStockByProductId(orders = []) {
  return orders.reduce((lookup, order) => {
    const normalizedStatus = normalizeOrderStatusKey(order.statusKey || order.status);

    if (CLOSED_ORDER_STATUSES.has(normalizedStatus)) {
      return lookup;
    }

    order.items.forEach((item) => {
      const key = item.id || item.slug || item.name;

      if (!key) {
        return;
      }

      lookup.set(key, (lookup.get(key) || 0) + Math.max(0, Number(item.quantity) || 0));
    });

    return lookup;
  }, new Map());
}

function getInventoryStatus(product, availableStock, reorderLevel) {
  if (product.status === "Coming Soon") {
    return "Coming Soon";
  }

  if (availableStock <= 0) {
    return "Out of Stock";
  }

  if (availableStock <= reorderLevel || product.status === "Low Stock") {
    return "Low Stock";
  }

  return "Active";
}

export function buildInventoryRows(products = [], orders = []) {
  const orderedStockLookup = getOrderedStockByProductId(orders);

  return products.map((product) => {
    const key = product.documentId || product.id || product.slug;
    const totalStock = Math.max(0, Number(product.stock) || 0);
    const orderedStock = Math.max(
      0,
      orderedStockLookup.get(key) || orderedStockLookup.get(product.id) || 0
    );
    const availableStock = Math.max(0, totalStock - orderedStock);
    const reorderLevel = Math.max(1, Number(product.reorderLevel) || 10);
    const status = getInventoryStatus(product, availableStock, reorderLevel);

    return {
      id: key,
      sku: product.sku || buildSku(product.slug || product.name),
      product: product.name,
      category: product.category,
      totalStock,
      orderedStock,
      availableStock,
      reorderLevel,
      status,
    };
  });
}

export function buildInventoryStats(rows = []) {
  const lowStockCount = rows.filter((item) => item.status === "Low Stock").length;
  const outOfStockCount = rows.filter((item) => item.status === "Out of Stock").length;
  const reorderCount = rows.filter(
    (item) => item.availableStock > 0 && item.availableStock <= item.reorderLevel
  ).length;

  return [
    { label: "Total SKUs", value: String(rows.length), tone: "amber" },
    { label: "Low Stock", value: String(lowStockCount), tone: "warning" },
    { label: "Out of Stock", value: String(outOfStockCount), tone: "danger" },
    { label: "Ready To Reorder", value: String(reorderCount), tone: "info" },
  ];
}

function normalizeUserRecord(record) {
  const name = normalizeLabel(record.name || record.firstName, "Spice Root customer");

  return {
    id: record.id || record.uid,
    uid: record.uid || record.id || "",
    name,
    firstName: normalizeLabel(record.firstName, name.split(/\s+/)[0] || "Customer"),
    email: normalizeLabel(record.email, "No email"),
    phoneNumber: normalizeLabel(record.phoneNumber),
    city: normalizeLabel(record.city),
    state: normalizeLabel(record.state),
    addressLine1: normalizeLabel(record.addressLine1),
    addressLine2: normalizeLabel(record.addressLine2),
    pincode: normalizeLabel(record.pincode),
    status: normalizeLabel(record.status || record.adminStatus),
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    lastLoginAt: record.lastLoginAt || null,
  };
}

export function subscribeToUsers(onUsers, onError) {
  return subscribeSafely(
    collection(db, "users"),
    (snapshot) => {
      const users = snapshot.docs
        .map((item) => normalizeUserRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onUsers(users);
    },
    onError
  );
}

function buildCustomerStatus(user, orders) {
  if (user.status) {
    return normalizeStatus(user.status, "Active");
  }

  if (orders.some((item) => isWithinDays(item.createdAt, 14))) {
    return "Active";
  }

  if (isWithinDays(user.lastLoginAt, 30)) {
    return "Active";
  }

  if (orders.length > 0) {
    return "Returning";
  }

  return "New";
}

export async function saveCustomer(customerId, values) {
  if (!customerId) {
    throw new Error(
      "Customer profiles are created when users register. Select a customer from the list to update their profile."
    );
  }

  const name = normalizeLabel(values.name || values.customer || values.firstName, "Spice Root customer");
  const payload = {
    name,
    firstName: normalizeLabel(values.firstName, name.split(/\s+/)[0] || "Customer"),
    email: normalizeLabel(values.email, "No email"),
    phoneNumber: normalizeLabel(values.phoneNumber || values.phone),
    alternatePhoneNumber: normalizeLabel(values.alternatePhoneNumber),
    city: normalizeLabel(values.city),
    state: normalizeLabel(values.state),
    addressLine1: normalizeLabel(values.addressLine1),
    addressLine2: normalizeLabel(values.addressLine2),
    pincode: normalizeLabel(values.pincode),
    deliveryInstructions: normalizeLabel(values.deliveryInstructions),
    status: normalizeStatus(values.status, "Active"),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", customerId), payload, { merge: true });
  await recordAdminLog({
    section: "Customers",
    action: "Customer updated",
    target: name,
    details: payload.email,
  });
  return customerId;
}

export async function deleteCustomer(customerId) {
  if (!customerId) {
    return;
  }

  await deleteDoc(doc(db, "users", customerId));
  await recordAdminLog({
    section: "Customers",
    action: "Customer deleted",
    target: customerId,
  });
}

export function buildCustomerRows(users = [], orders = []) {
  const ordersByUser = orders.reduce((lookup, order) => {
    if (!order.userId) {
      return lookup;
    }

    const list = lookup.get(order.userId) || [];
    list.push(order);
    lookup.set(order.userId, list);
    return lookup;
  }, new Map());

  return users
    .map((user) => {
      const customerOrders = ordersByUser.get(user.uid) || [];
      const totalSpendValue = customerOrders.reduce(
        (total, order) => total + Math.max(0, Number(order.amount) || 0),
        0
      );
      const latestOrder = customerOrders
        .slice()
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt))[0];

      return {
        id: user.uid,
        uid: user.uid,
        customer: user.name,
        email: user.email,
        orders: customerOrders.length,
        spend: formatPrice(totalSpendValue),
        totalSpendValue,
        totalSpend: totalSpendValue,
        status: buildCustomerStatus(user, customerOrders),
        phone: user.phoneNumber || "Not provided",
        city: user.city || "Not provided",
        state: user.state || "Not provided",
        lastOrderDate: latestOrder?.date || "No orders yet",
        joined: formatJoinedLabel(user.createdAt),
        createdAt: user.createdAt,
      };
    })
    .sort((left, right) => right.totalSpendValue - left.totalSpendValue || right.orders - left.orders);
}

export function buildCustomerDetails(users = [], orders = [], reviews = [], userId = "") {
  const requestedProfile = userId ? users.find((item) => item.uid === userId) || null : null;
  const profile = userId ? requestedProfile : users[0] || null;

  if (!profile) {
    return null;
  }

  const customerOrders = orders.filter((item) => item.userId === profile.uid);
  const customerReviews = reviews.filter((item) => item.userId === profile.uid);
  const totalSpendValue = customerOrders.reduce(
    (total, order) => total + Math.max(0, Number(order.amount) || 0),
    0
  );
  const favoriteProduct =
    customerOrders
      .flatMap((order) => order.items || [])
      .sort((left, right) => (right.quantity || 0) - (left.quantity || 0))[0]?.name || "No orders yet";

  return {
    id: profile.uid,
    name: profile.name,
    email: profile.email,
    phone: profile.phoneNumber || "Not provided",
    totalOrders: customerOrders.length,
    totalSpend: formatPrice(totalSpendValue),
    totalSpendValue,
    loyaltyPoints: String(customerOrders.length * 10),
    lastActive: customerOrders[0]?.date || formatOrderDate(profile.lastLoginAt || profile.createdAt),
    favorite: favoriteProduct,
    address: [
      profile.addressLine1,
      profile.addressLine2,
      profile.city,
      profile.state,
      profile.pincode,
    ]
      .filter(Boolean)
      .join(", ") || "Address not provided",
    notes:
      customerReviews[0]?.review ||
      "No customer notes yet. Once reviews or more orders arrive, this section updates automatically.",
    orders: customerOrders,
    reviews: customerReviews,
    status: buildCustomerStatus(profile, customerOrders),
  };
}

function normalizeReviewRecord(record) {
  const type = record.type === "overall" ? "overall" : "product";
  const productName =
    type === "overall"
      ? "Overall Store Review"
      : normalizeLabel(record.productName, "Product Review");
  const createdAt = record.createdAt || null;

  return {
    id: record.id,
    userId: record.userId || "",
    orderId: normalizeLabel(record.orderId),
    productId: normalizeLabel(record.productId),
    productName,
    product: productName,
    type,
    customer: normalizeLabel(record.customerName, "Customer"),
    customerEmail: normalizeLabel(record.customerEmail),
    rating: Math.max(1, Math.min(5, Number(record.rating) || 5)),
    review: normalizeLabel(record.review),
    status: normalizeStatus(record.status, "Pending"),
    createdAt,
    date: formatOrderDate(createdAt),
    isApproved: normalizeStatus(record.status, "Pending") === "Approved",
  };
}

function mapReviewSnapshot(snapshot) {
  return snapshot.docs
    .map((item) => normalizeReviewRecord({ id: item.id, ...item.data() }))
    .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));
}

export function subscribeToReviews(onReviews, onError) {
  return subscribeSafely(
    collection(db, "reviews"),
    (snapshot) => {
      onReviews(mapReviewSnapshot(snapshot));
    },
    onError
  );
}

export function subscribeToApprovedReviews(onReviews, onError) {
  return subscribeSafely(
    query(collection(db, "reviews"), where("status", "==", "Approved")),
    (snapshot) => {
      onReviews(mapReviewSnapshot(snapshot));
    },
    onError
  );
}

export function subscribeToApprovedProductReviews(productId, onReviews, onError) {
  if (!productId) {
    onReviews([]);
    return () => {};
  }

  return subscribeSafely(
    query(
      collection(db, "reviews"),
      where("status", "==", "Approved"),
      where("type", "==", "product"),
      where("productId", "==", productId)
    ),
    (snapshot) => {
      onReviews(mapReviewSnapshot(snapshot));
    },
    onError
  );
}

export function subscribeToReviewsForUser(userId, onReviews, onError) {
  if (!userId) {
    onReviews([]);
    return () => {};
  }

  return subscribeSafely(
    query(collection(db, "reviews"), where("userId", "==", userId)),
    (snapshot) => {
      onReviews(mapReviewSnapshot(snapshot));
    },
    onError
  );
}

export async function submitReview(payload) {
  const type = payload.type === "overall" ? "overall" : "product";

  await addDoc(collection(db, "reviews"), {
    userId: payload.userId,
    customerName: normalizeLabel(payload.customerName, "Customer"),
    customerEmail: normalizeLabel(payload.customerEmail),
    orderId: normalizeLabel(payload.orderId),
    productId: type === "overall" ? "" : normalizeLabel(payload.productId),
    productName: type === "overall" ? "Overall Store Review" : normalizeLabel(payload.productName),
    type,
    rating: Math.max(1, Math.min(5, Number(payload.rating) || 5)),
    review: normalizeLabel(payload.review),
    status: "Pending",
    createdAt: serverTimestamp(),
  });
}

export async function updateReviewStatus(reviewId, status) {
  if (!reviewId) {
    return;
  }

  await updateDoc(doc(db, "reviews", reviewId), {
    status: normalizeStatus(status, "Pending"),
    updatedAt: serverTimestamp(),
  });

  await recordAdminLog({
    section: "Reviews",
    action: `Review status updated to ${normalizeStatus(status, "Pending")}`,
    target: reviewId,
  });
}

export async function deleteReview(reviewId) {
  if (!reviewId) {
    return;
  }

  await deleteDoc(doc(db, "reviews", reviewId));
  await recordAdminLog({
    section: "Reviews",
    action: "Review deleted",
    target: reviewId,
  });
}

export function getReviewableDeliveredItems(orders = []) {
  return orders
    .filter((order) => String(order.status || "").trim().toLowerCase() === "delivered")
    .flatMap((order) =>
      (order.items || []).map((item) => ({
        orderId: order.orderId,
        productId: item.id || item.slug || "",
        productName: item.name,
        quantity: item.quantity,
      }))
    )
    .filter((item) => item.productId && item.productName)
    .filter(
      (item, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.orderId === item.orderId && candidate.productId === item.productId
        ) === index
    );
}

function buildDailyRevenueSeries(orders = [], dayOffset = 0, totalDays = 7) {
  return Array.from({ length: totalDays }, (_, index) => {
    const dayIndex = totalDays - 1 - index + dayOffset;
    const targetDate = new Date(Date.now() - dayIndex * MILLIS_IN_DAY);
    const startOfDay = getStartOfDayTimestamp(targetDate);
    const endOfDay = startOfDay + MILLIS_IN_DAY;
    const dailyTotal = orders.reduce((total, order) => {
      const orderTime = getCreatedAtTime(order.createdAt);

      if (orderTime < startOfDay || orderTime >= endOfDay) {
        return total;
      }

      return total + Math.max(0, Number(order.amount) || 0);
    }, 0);

    return {
      day: targetDate.toLocaleDateString("en-IN", { weekday: "short" }),
      value: dailyTotal,
    };
  });
}

function buildDailyOrderSeries(orders = [], totalDays = 7) {
  return Array.from({ length: totalDays }, (_, index) => {
    const dayIndex = totalDays - 1 - index;
    const targetDate = new Date(Date.now() - dayIndex * MILLIS_IN_DAY);
    const startOfDay = getStartOfDayTimestamp(targetDate);
    const endOfDay = startOfDay + MILLIS_IN_DAY;
    const total = orders.filter((order) => {
      const orderTime = getCreatedAtTime(order.createdAt);
      return orderTime >= startOfDay && orderTime < endOfDay;
    }).length;

    return {
      label: targetDate.toLocaleDateString("en-IN", { weekday: "short" }),
      total,
    };
  });
}

function buildTopSellingProducts(products = [], orders = []) {
  const totals = new Map();
  const productLookup = new Map(
    products.map((product) => [product.id || product.slug || product.documentId, product])
  );

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.id || item.slug || item.name;

      if (!key) {
        return;
      }

      const current = totals.get(key) || {
        key,
        name: item.name,
        quantity: 0,
      };

      current.quantity += Math.max(0, Number(item.quantity) || 0);
      totals.set(key, current);
    });
  });

  return Array.from(totals.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5)
    .map((item) => {
      const product = productLookup.get(item.key) || products.find((candidate) => candidate.name === item.name);

      return {
        name: product?.name || item.name,
        image: product?.image || "/images/mirchi.png",
        sku: product?.sku || buildSku(product?.slug || item.name),
        sales: `${item.quantity} sold`,
      };
    });
}

function buildLowStockProducts(products = [], inventoryRows = []) {
  const productLookup = new Map(
    products.map((product) => [product.name, product])
  );

  return inventoryRows
    .filter((item) => item.status === "Low Stock" || item.status === "Out Of Stock" || item.status === "Out of Stock")
    .sort((left, right) => left.availableStock - right.availableStock)
    .slice(0, 5)
    .map((item) => ({
      name: item.product,
      stock: `${item.availableStock} left`,
      tone: item.availableStock <= 0 ? "danger" : "warning",
      image: productLookup.get(item.product)?.image || "/images/mirchi.png",
    }));
}

function buildRecentOrders(orders = []) {
  return orders.slice(0, 5);
}

function buildNewCustomers(users = []) {
  return users.slice(0, 5).map((user) => ({
    name: user.name,
    city: user.city || "Location pending",
    joined: formatJoinedLabel(user.createdAt),
  }));
}

export function buildDashboardData(products = [], users = [], orders = [], reviews = []) {
  const inventoryRows = buildInventoryRows(products, orders);
  const paidOrders = orders.filter(isPaidOrder);
  const totalRevenue = paidOrders.reduce((total, order) => total + Math.max(0, Number(order.amount) || 0), 0);
  const deliveredOrders = orders.filter(
    (item) => String(item.status || "").trim().toLowerCase() === "delivered"
  ).length;
  const revenueTrend = buildDailyRevenueSeries(orders, 0, 7);
  const previousRevenueTrend = buildDailyRevenueSeries(orders, 7, 7);
  const orderVolume = buildDailyOrderSeries(orders, 7);

  return {
    dashboardStats: [
      {
        id: "revenue",
        label: "Revenue",
        value: formatPrice(totalRevenue),
        note: `${reviews.length} review${reviews.length === 1 ? "" : "s"} recorded`,
        change: `${paidOrders.length} paid orders`,
        tone: "green",
        points: revenueTrend.map((item) => item.value),
      },
      {
        id: "orders",
        label: "Orders",
        value: String(orders.length),
        note: `${orders.filter((item) => item.status === "Pending").length} pending right now`,
        change: `${orders.filter((item) => isWithinDays(item.createdAt, 7)).length} this week`,
        tone: "amber",
        points: orderVolume.map((item) => item.total),
      },
      {
        id: "customers",
        label: "Customers",
        value: String(users.length),
        note: `${users.filter((item) => isWithinDays(item.createdAt, 7)).length} new this week`,
        change: `${users.filter((item) => isWithinDays(item.lastLoginAt, 30)).length} active recently`,
        tone: "blue",
        points: buildDailyOrderSeries(
          users.map((item) => ({
            createdAt: item.createdAt,
          })),
          7
        ).map((item) => item.total),
      },
      {
        id: "deliveries",
        label: "Deliveries",
        value: String(deliveredOrders),
        note: `${inventoryRows.filter((item) => item.status === "Low Stock").length} low-stock SKU alerts`,
        change: `${orders.filter((item) => item.status === "Shipped").length} shipped`,
        tone: "orange",
        points: buildDailyOrderSeries(
          orders.filter((item) => item.status === "Delivered"),
          7
        ).map((item) => item.total),
      },
    ],
    revenueTrend,
    previousRevenueTrend,
    orderVolume,
    topSellingProducts: buildTopSellingProducts(products, orders),
    lowStockProducts: buildLowStockProducts(products, inventoryRows),
    recentOrders: buildRecentOrders(orders),
    newCustomers: buildNewCustomers(users),
  };
}
