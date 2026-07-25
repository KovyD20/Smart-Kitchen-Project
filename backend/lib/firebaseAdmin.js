// Firebase Admin SDK init from environment variables (deploy-friendly: no key file).
//
// Required env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
// The private key is stored single-line with literal "\n" sequences (as pasted from the
// service-account JSON), so we convert them back to real newlines here.
//
// Fail-closed: if any var is missing, `isConfigured` is false and the auth middleware
// rejects protected requests (503) instead of silently allowing them through.

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

const isConfigured = Boolean(projectId && clientEmail && rawPrivateKey);

let adminAuth = null;

if (isConfigured) {
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
  adminAuth = getAuth(app);
} else {
  console.warn(
    "[firebaseAdmin] FIREBASE_* env vars missing — protected endpoints will return 503.",
  );
}

module.exports = { adminAuth, isConfigured };
