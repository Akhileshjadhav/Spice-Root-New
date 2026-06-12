import { doc, setDoc } from "firebase/firestore";
import { db, serverTimestamp } from "../firebase";
import { subscribeSafely } from "./firestoreSubscriptions";

const SETTINGS_DOC_ID = "general";

export const DEFAULT_STORE_SETTINGS = {
  storeName: "Spice Root",
  storeEmail: "hello@spiceroot.com",
  storePhone: "+91 98765 43210",
  paymentGateway: "Razorpay",
  autoRefunds: "Disabled",
  codLimit: "Rs 3,000",
  freeShippingThreshold: "Rs 999",
  defaultSla: "2-4 business days",
  returnWindow: "7 days",
};

export const STORE_SETTINGS_SECTIONS = [
  {
    title: "Store Settings",
    fields: [
      { key: "storeName", label: "Store Name" },
      { key: "storeEmail", label: "Store Email" },
      { key: "storePhone", label: "Store Phone" },
    ],
  },
  {
    title: "Payment Settings",
    fields: [
      { key: "paymentGateway", label: "Gateway" },
      { key: "autoRefunds", label: "Auto Refunds" },
      { key: "codLimit", label: "COD Limit" },
    ],
  },
  {
    title: "Delivery Settings",
    fields: [
      { key: "freeShippingThreshold", label: "Free Shipping Threshold" },
      { key: "defaultSla", label: "Default SLA" },
      { key: "returnWindow", label: "Return Window" },
    ],
  },
];

function normalizeStoreSettings(record = {}) {
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...Object.fromEntries(
      Object.entries(record).filter(([key, value]) => key in DEFAULT_STORE_SETTINGS && typeof value === "string")
    ),
  };
}

export function subscribeToStoreSettings(onSettings, onError) {
  return subscribeSafely(doc(db, "storeSettings", SETTINGS_DOC_ID), (snapshot) => {
    onSettings(snapshot.exists() ? normalizeStoreSettings(snapshot.data()) : { ...DEFAULT_STORE_SETTINGS });
  }, onError);
}

export async function saveStoreSettings(values = {}) {
  const payload = normalizeStoreSettings(values);

  await setDoc(
    doc(db, "storeSettings", SETTINGS_DOC_ID),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return payload;
}
