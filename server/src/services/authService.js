import { isAllowedAdminEmail } from "../config/env.js";
import { HttpError } from "../utils/http.js";
import { getFirebaseAdmin } from "./firebaseAdmin.js";

export async function ensureAdminProfile(user) {
  if (!isAllowedAdminEmail(user.email)) {
    throw new HttpError(403, "This email is not allowed to receive admin access.");
  }

  const { db, FieldValue } = await getFirebaseAdmin();
  const adminRef = db.collection("admins").doc(user.uid);
  const snapshot = await adminRef.get();
  const payload = {
    uid: user.uid,
    email: String(user.email || "").trim().toLowerCase(),
    name: user.name || snapshot.data()?.name || "Administrator",
    role: "admin",
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!snapshot.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await adminRef.set(payload, { merge: true });

  return {
    uid: user.uid,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    status: payload.status,
    createdAt: payload.createdAt || snapshot.data()?.createdAt || null,
  };
}
