import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountJson) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_PATH is not set in environment variables."
  );
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  throw new Error(`Failed to parse service account JSON: ${error.message}`);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const db = admin.firestore();
export const adminSdkFirebase = admin;
