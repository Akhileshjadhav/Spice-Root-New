import { isAllowedAdminEmail } from "../config/env.js";
import { getFirebaseAdmin } from "../services/firebaseAdmin.js";
import { HttpError } from "../utils/http.js";

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token;
}

export async function getOptionalUser(request) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const { auth } = await getFirebaseAdmin();
  return auth.verifyIdToken(token);
}

export async function requireUser(request) {
  const user = await getOptionalUser(request);

  if (!user?.uid) {
    throw new HttpError(401, "Login is required.");
  }

  return user;
}

export async function requireAdmin(request) {
  const user = await requireUser(request);
  const { db } = await getFirebaseAdmin();
  const adminSnapshot = await db.collection("admins").doc(user.uid).get();
  const adminProfile = adminSnapshot.exists ? adminSnapshot.data() : null;
  const isEnvAdmin = isAllowedAdminEmail(user.email);

  if (!isEnvAdmin && !adminProfile) {
    throw new HttpError(403, "Admin access is required.");
  }

  const adminStatus = String(adminProfile?.status || "active").trim().toLowerCase();

  if (adminProfile?.status && adminStatus !== "active") {
    throw new HttpError(403, "This admin account is disabled.");
  }

  return {
    ...user,
    adminProfile: {
      uid: user.uid,
      email: user.email || "",
      name: adminProfile?.name || user.name || "Administrator",
      role: adminProfile?.role || "admin",
      status: adminProfile?.status || "active",
    },
  };
}
