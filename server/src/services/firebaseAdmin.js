import admin from "firebase-admin";
import { config } from "../config/env.js";
import { HttpError } from "../utils/http.js";

let cachedAdmin;

export async function getFirebaseAdmin() {
  if (cachedAdmin) {
    return cachedAdmin;
  }

  if (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) {
    throw new HttpError(500, "Firebase Admin credentials are missing in server environment.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
      storageBucket: config.firebase.storageBucket,
    });
  }

  cachedAdmin = {
    app: admin.app(),
    auth: admin.auth(),
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue,
  };

  return cachedAdmin;
}
