export function normalizeLabel(value, fallback = "") {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || fallback;
}

export function normalizeStatus(value, fallback = "Pending") {
  const normalizedValue = normalizeLabel(value, fallback)
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  return normalizedValue.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toMillis(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value || 0);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

export function toPlainTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
