'use strict';
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) {
  const opts = {};
  if (process.env.STORAGE_BUCKET) opts.storageBucket = process.env.STORAGE_BUCKET;
  // On Render (outside Google Cloud) pass the service account JSON as one env var.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) opts.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  initializeApp(Object.keys(opts).length ? opts : undefined);
}

/** Small facade so routes can call admin.auth() / admin.storage(). */
// Auth is loaded on first use: its token library needs require(ESM), which some hosts lack.
const admin = { auth: () => require('firebase-admin/auth').getAuth(), storage: () => getStorage() };

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const env = (name, fallback = '') => {
  const v = process.env[name];
  return v && !v.startsWith('YOUR_') ? v : fallback;
};

const now = () => FieldValue.serverTimestamp();

/** Public base URL of this API (used for OAuth redirects / magic links). */
const apiUrl = () => env('PUBLIC_API_URL', 'http://localhost:5001/YOUR_PROJECT/us-central1/api');
const webUrl = () => env('WEB_BASE_URL', 'http://localhost:3000');

async function uploadBuffer(path, buffer, contentType) {
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  await file.save(buffer, { contentType, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 5 });
  return url;
}

/**
 * True when Firebase is configured (on Firebase/Google Cloud, or a service account is given).
 * Without it the API still serves chat, Danu, the builder and voice for guests;
 * sign-in, saved apps and payments need Firebase.
 */
const firebaseReady = !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_CONFIG || process.env.GCLOUD_PROJECT || process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIRESTORE_EMULATOR_HOST);

module.exports = { admin, db, env, now, apiUrl, webUrl, uploadBuffer, firebaseReady };
