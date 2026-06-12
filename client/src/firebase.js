import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

function normalizeStorageBucket(value) {
  return String(value || "")
    .trim()
    .replace(/^gs:\/\//, "")
    .replace(/^https?:\/\/[^/]+\/v0\/b\//, "")
    .replace(/\/.*$/, "");
}

const adminEmailAllowlist = String(import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const storageBucket = normalizeStorageBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (Object.values(firebaseConfig).some((value) => !value)) {
  const message =
    "Firebase environment variables are missing. Add them to client/.env before using auth and Firestore.";

  if (import.meta.env.PROD) {
    throw new Error(message);
  }

  console.warn(message);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
  localCache: memoryLocalCache(),
});
const storage = storageBucket ? getStorage(app, `gs://${storageBucket}`) : getStorage(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

export {
  adminEmailAllowlist,
  app,
  auth,
  db,
  storage,
  googleProvider,
  serverTimestamp,
};
