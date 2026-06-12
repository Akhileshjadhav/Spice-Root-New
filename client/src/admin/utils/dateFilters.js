const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom Dates" },
];

export function getRecordTime(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value || 0);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getPeriodStart(period) {
  const now = new Date();

  if (period === "daily") {
    return startOfToday();
  }

  if (period === "weekly") {
    return Date.now() - 7 * DAY_MS;
  }

  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }

  if (period === "yearly") {
    return new Date(now.getFullYear(), 0, 1).getTime();
  }

  return 0;
}

function getDateInputTime(value, endOfDay = false) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date.getTime();
}

export function isWithinDateFilters(value, period, fromDate, toDate) {
  const recordTime = getRecordTime(value);
  const hasCustomDateFilter = Boolean(fromDate || toDate);

  if (!recordTime && period === "all" && !hasCustomDateFilter) {
    return true;
  }

  if (!recordTime) {
    return false;
  }

  const periodStart = getPeriodStart(period);
  const fromTime = getDateInputTime(fromDate);
  const toTime = getDateInputTime(toDate, true);

  if (period !== "all" && period !== "custom" && recordTime < periodStart) {
    return false;
  }

  if (fromTime && recordTime < fromTime) {
    return false;
  }

  if (toTime && recordTime > toTime) {
    return false;
  }

  return true;
}
