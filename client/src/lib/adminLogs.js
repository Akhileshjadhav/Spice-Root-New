import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeSafely } from "./firestoreSubscriptions";

const ADMIN_LOGS_COLLECTION = "adminLogs";

function normalizeLabel(value, fallback = "") {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || fallback;
}

function getCreatedAtTime(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value || 0);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
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

export async function recordAdminLog({ section, action, target = "", adminName = "Admin", details = "" }) {
  try {
    await addDoc(collection(db, ADMIN_LOGS_COLLECTION), {
      section: normalizeLabel(section, "Admin"),
      action: normalizeLabel(action, "Updated admin section"),
      target: normalizeLabel(target),
      adminName: normalizeLabel(adminName, "Admin"),
      details: normalizeLabel(details),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Admin log write failed:", error);
  }
}

export function normalizeAdminLogRecord(record) {
  return {
    id: record.id,
    section: normalizeLabel(record.section, "Admin"),
    action: normalizeLabel(record.action, "Updated admin section"),
    target: normalizeLabel(record.target),
    adminName: normalizeLabel(record.adminName, "Admin"),
    details: normalizeLabel(record.details),
    createdAt: record.createdAt || null,
    dateTime: formatDateTime(record.createdAt),
  };
}

export function subscribeToAdminLogs(onLogs, onError) {
  return subscribeSafely(
    collection(db, ADMIN_LOGS_COLLECTION),
    (snapshot) => {
      const logs = snapshot.docs
        .map((item) => normalizeAdminLogRecord({ id: item.id, ...item.data() }))
        .sort((left, right) => getCreatedAtTime(right.createdAt) - getCreatedAtTime(left.createdAt));

      onLogs(logs);
    },
    onError
  );
}
