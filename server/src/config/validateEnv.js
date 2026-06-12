import { config } from "./env.js";

function isLocalOrigin(origin) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin);
}

export function getDeploymentReadiness() {
  const firebaseAdminConfigured = Boolean(
    config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey
  );
  const razorpayConfigured = Boolean(config.razorpay.keyId);
  const adminAllowlistConfigured = config.adminEmails.length > 0;
  const clientOriginConfigured = config.clientOrigins.some(
    (origin) => origin && !isLocalOrigin(origin)
  );

  return {
    firebaseAdminConfigured,
    razorpayConfigured,
    adminAllowlistConfigured,
    clientOriginConfigured,
    ready:
      firebaseAdminConfigured &&
      razorpayConfigured &&
      adminAllowlistConfigured &&
      (config.nodeEnv !== "production" || clientOriginConfigured),
  };
}

export function validateProductionEnvironment() {
  if (config.nodeEnv !== "production") {
    return;
  }

  const missing = [];

  if (!config.firebase.projectId) {
    missing.push("FIREBASE_ADMIN_PROJECT_ID");
  }

  if (!config.firebase.clientEmail) {
    missing.push("FIREBASE_ADMIN_CLIENT_EMAIL");
  }

  if (!config.firebase.privateKey) {
    missing.push("FIREBASE_ADMIN_PRIVATE_KEY");
  }

  if (!config.firebase.storageBucket) {
    missing.push("FIREBASE_STORAGE_BUCKET");
  }

  if (!config.razorpay.keyId) {
    missing.push("RAZORPAY_KEY_ID");
  }

  if (!config.razorpay.mockMode && !config.razorpay.keySecret) {
    missing.push("RAZORPAY_KEY_SECRET");
  }

  if (config.adminEmails.length === 0) {
    missing.push("ADMIN_EMAILS");
  }

  if (config.clientOrigins.length === 0 || config.clientOrigins.every(isLocalOrigin)) {
    missing.push("CLIENT_ORIGIN (must be your deployed client URL, not localhost)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Server production environment is incomplete. Set: ${missing.join(", ")}. See server/.env.example and DEPLOYMENT.md.`
    );
  }
}
