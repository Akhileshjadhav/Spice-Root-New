import {
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeSafely } from "./firestoreSubscriptions";
import { recordAdminLog } from "./adminLogs";

const COUPONS_COLLECTION = "coupons";
const BANNERS_COLLECTION = "banners";

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeStatus(value, fallback = "Active") {
  const normalizedValue = String(value || fallback)
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  return normalizedValue.replace(/\b\w/g, (character) => character.toUpperCase());
}

function toDateInput(value) {
  if (!value) {
    return "";
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatDate(value) {
  const dateInput = toDateInput(value);

  if (!dateInput) {
    return "Always";
  }

  return new Date(`${dateInput}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function normalizeCoupon(record = {}) {
  const code = String(record.code || record.id || "").trim().toUpperCase();
  const discountValue = toNumber(record.discountValue ?? record.discount, 0);
  const type = record.type || "Percentage";
  const usageCount = toNumber(record.usageCount ?? record.usage, 0);
  const usageLimit = toNumber(record.usageLimit, 0);
  const expiresAt = record.expiresAt || record.expires || "";
  const expiresInput = toDateInput(expiresAt);
  const isExpired = expiresInput ? new Date(`${expiresInput}T23:59:59`).getTime() < Date.now() : false;
  const status = isExpired && normalizeStatus(record.status) === "Active" ? "Expired" : normalizeStatus(record.status);
  const discountLabel = type === "Percentage" ? `${discountValue}%` : `Rs. ${discountValue}`;

  return {
    id: record.id || code,
    code,
    title: record.title || code || "Offer",
    description: record.description || "",
    discountValue,
    discount: discountLabel,
    type,
    minOrderValue: toNumber(record.minOrderValue, 0),
    usageCount,
    usageLimit,
    usage: usageLimit ? `${usageCount}/${usageLimit}` : String(usageCount),
    expiresAt,
    expiresInput,
    expires: formatDate(expiresAt),
    status,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

export function normalizeBanner(record = {}) {
  return {
    id: record.id || "",
    title: record.title || "Offer Banner",
    subtitle: record.subtitle || "",
    eyebrow: record.eyebrow || "Special Offer",
    buttonText: record.buttonText || "Shop Now",
    buttonLink: record.buttonLink || "/products",
    couponCode: String(record.couponCode || "").trim().toUpperCase(),
    location: record.location || "Offers Page",
    imageUrl: record.imageUrl || record.image || "/images/home-light.png",
    status: normalizeStatus(record.status || (record.isActive === false ? "Inactive" : "Active")),
    sortOrder: toNumber(record.sortOrder, 0),
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

export function subscribeToCoupons(onCoupons, onError) {
  return subscribeSafely(
    collection(db, COUPONS_COLLECTION),
    (snapshot) => {
      const coupons = snapshot.docs
        .map((item) => normalizeCoupon({ id: item.id, ...item.data() }))
        .sort((left, right) => left.code.localeCompare(right.code));
      onCoupons(coupons);
    },
    onError
  );
}

export function subscribeToBanners(onBanners, onError) {
  return subscribeSafely(
    collection(db, BANNERS_COLLECTION),
    (snapshot) => {
      const banners = snapshot.docs
        .map((item) => normalizeBanner({ id: item.id, ...item.data() }))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
      onBanners(banners);
    },
    onError
  );
}

export async function saveCoupon(values) {
  const code = String(values.code || "").trim().toUpperCase();

  if (!code) {
    throw new Error("Coupon code is required.");
  }

  const couponRef = doc(db, COUPONS_COLLECTION, values.id || code);
  await setDoc(
    couponRef,
    {
      code,
      title: values.title || code,
      description: values.description || "",
      discountValue: toNumber(values.discountValue, 0),
      type: values.type || "Percentage",
      minOrderValue: toNumber(values.minOrderValue, 0),
      usageCount: toNumber(values.usageCount, 0),
      usageLimit: toNumber(values.usageLimit, 0),
      expiresAt: values.expiresAt || "",
      status: values.status || "Active",
      updatedAt: serverTimestamp(),
      ...(values.id ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  await recordAdminLog({
    section: "Offers & CMS",
    action: values.id ? "Coupon updated" : "Coupon created",
    target: code,
    details: values.title || code,
  });
}

export async function deleteCoupon(couponId) {
  await deleteDoc(doc(db, COUPONS_COLLECTION, couponId));
  await recordAdminLog({
    section: "Offers & CMS",
    action: "Coupon deleted",
    target: couponId,
  });
}

export async function saveBanner(values) {
  const bannerRef = values.id ? doc(db, BANNERS_COLLECTION, values.id) : doc(collection(db, BANNERS_COLLECTION));
  await setDoc(
    bannerRef,
    {
      title: values.title || "Offer Banner",
      subtitle: values.subtitle || "",
      eyebrow: values.eyebrow || "Special Offer",
      buttonText: values.buttonText || "Shop Now",
      buttonLink: values.buttonLink || "/products",
      couponCode: String(values.couponCode || "").trim().toUpperCase(),
      location: values.location || "Offers Page",
      imageUrl: String(values.imageUrl || "/images/home-light.png").trim(),
      status: normalizeStatus(values.status),
      sortOrder: toNumber(values.sortOrder, 0),
      updatedAt: serverTimestamp(),
      ...(values.id ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  await recordAdminLog({
    section: "Offers & CMS",
    action: values.id ? "Banner updated" : "Banner created",
    target: values.title || "Offer Banner",
    details: values.location || "Offers Page",
  });
}

export async function deleteBanner(bannerId) {
  await deleteDoc(doc(db, BANNERS_COLLECTION, bannerId));
  await recordAdminLog({
    section: "Offers & CMS",
    action: "Banner deleted",
    target: bannerId,
  });
}

export function getActiveCoupons(coupons = []) {
  return coupons.filter((coupon) => normalizeStatus(coupon.status) === "Active");
}

export function findApplicableCoupon(coupons = [], code = "", subtotal = 0) {
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  return (
    coupons.find((coupon) => {
      const expiresTime = coupon.expiresInput
        ? new Date(`${coupon.expiresInput}T23:59:59`).getTime()
        : Infinity;
      const usageAvailable = !coupon.usageLimit || coupon.usageCount < coupon.usageLimit;

      return (
        coupon.code === normalizedCode &&
        coupon.status === "Active" &&
        expiresTime >= Date.now() &&
        subtotal >= coupon.minOrderValue &&
        usageAvailable
      );
    }) || null
  );
}

export function calculateCouponDiscount(coupon, subtotal = 0, deliveryCharge = 0) {
  if (!coupon) {
    return 0;
  }

  if (coupon.type === "Percentage") {
    return Math.min(subtotal, Math.round((subtotal * coupon.discountValue) / 100));
  }

  if (coupon.type === "Free Delivery") {
    return Math.min(deliveryCharge, coupon.discountValue || deliveryCharge);
  }

  return Math.min(subtotal, coupon.discountValue);
}

export async function markCouponUsed(couponId) {
  if (!couponId) {
    return;
  }

  await updateDoc(doc(db, COUPONS_COLLECTION, couponId), {
    usageCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}
