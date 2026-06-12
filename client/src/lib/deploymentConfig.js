const REQUIRED_PUBLIC_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_API_URL",
];

export function validateClientDeploymentConfig() {
  if (!import.meta.env.PROD) {
    return;
  }

  const missing = REQUIRED_PUBLIC_ENV.filter((key) => !String(import.meta.env[key] || "").trim());

  if (missing.length > 0) {
    throw new Error(
      `Client production build is missing: ${missing.join(", ")}. Set them in Vercel (or client/.env) before deploying.`
    );
  }

  const apiUrl = String(import.meta.env.VITE_API_URL || "").trim();

  if (/localhost|127\.0\.0\.1/i.test(apiUrl) && !import.meta.env.VITE_ALLOW_LOCAL_PROD) {
    throw new Error("VITE_API_URL must point to your deployed Render API URL in production, not localhost (unless VITE_ALLOW_LOCAL_PROD=true is set).");
  }
}
