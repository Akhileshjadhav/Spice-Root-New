import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^"|"$/g, "").replace(/\\n/g, "\n");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(serverRoot, ".env"));

function readCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const isProduction = (process.env.NODE_ENV || "development") === "production";

function readServerEnv(primaryKey, fallbackKey = "") {
  const primary = String(process.env[primaryKey] || "").trim();

  if (primary || isProduction || !fallbackKey) {
    return primary;
  }

  return String(process.env[fallbackKey] || "").trim();
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT || 3001),
  clientOrigins: readCsv(process.env.CLIENT_ORIGIN || "http://localhost:5173"),
  adminEmails: readCsv(
    readServerEnv("ADMIN_EMAILS", "VITE_ADMIN_EMAILS")
  ).map((email) => email.toLowerCase()),
  firebase: {
    projectId: readServerEnv("FIREBASE_ADMIN_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"),
    clientEmail: readServerEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
    privateKey: readServerEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    storageBucket: readServerEnv("FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"),
  },
  razorpay: {
    keyId: readServerEnv("RAZORPAY_KEY_ID", "VITE_RAZORPAY_KEY_ID"),
    keySecret: readServerEnv("RAZORPAY_KEY_SECRET"),
    mockMode: String(process.env.RAZORPAY_MOCK_MODE ?? "true").toLowerCase() !== "false",
    allowLive: String(process.env.ALLOW_LIVE_RAZORPAY || "false").toLowerCase() === "true",
  },
};

export function isAllowedAdminEmail(email) {
  return Boolean(email) && config.adminEmails.includes(String(email).trim().toLowerCase());
}
