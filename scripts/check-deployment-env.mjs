import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        return values;
      }

      const [key, ...valueParts] = trimmed.split("=");
      values[key] = valueParts.join("=").replace(/^"|"$/g, "");
      return values;
    }, {});
}

function checkKeys(label, env, keys) {
  const missing = keys.filter((key) => !String(env[key] || "").trim());

  if (missing.length > 0) {
    console.error(`[${label}] missing: ${missing.join(", ")}`);
    return false;
  }

  console.log(`[${label}] ok (${keys.length} required keys present)`);
  return true;
}

const clientEnv = {
  ...parseEnvFile(path.join(rootDir, "client", ".env")),
  ...parseEnvFile(path.join(rootDir, "client", ".env.local")),
  ...process.env,
};

const serverEnv = {
  ...parseEnvFile(path.join(rootDir, "server", ".env")),
  ...process.env,
};

const clientOk = checkKeys("client", clientEnv, [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_API_URL",
  "VITE_ADMIN_EMAILS",
]);

const serverOk = checkKeys("server", serverEnv, [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
  "ADMIN_EMAILS",
  "CLIENT_ORIGIN",
  "RAZORPAY_KEY_ID",
]);

if (!clientOk || !serverOk) {
  console.error("\nCopy client/.env.example and server/.env.example, then fill in values. See DEPLOYMENT.md.");
  process.exit(1);
}

console.log("\nDeployment env check passed for local files.");
