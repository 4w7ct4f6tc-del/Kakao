'use strict';
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) {
  initializeApp(process.env.STORAGE_BUCKET ? { storageBucket: process.env.STORAGE_BUCKET } : undefined);
}

/** Small facade so routes can call admin.auth() / admin.storage(). */
const admin = { auth: () => getAuth(), storage: () => getStorage() };

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

module.exports = { admin, db, env, now, apiUrl, webUrl, uploadBuffer };
