'use strict';
const { admin, db } = require('./admin');

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Wrap async route handlers. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function decodeUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return await admin.auth().verifyIdToken(h.slice(7));
  } catch {
    return null;
  }
}

/** Requires a Firebase ID token. Sets req.user = decoded token. */
const requireAuth = wrap(async (req, _res, next) => {
  const user = await decodeUser(req);
  if (!user) throw new HttpError(401, 'Sign in required', 'auth');
  req.user = user;
  next();
});

/** Attaches req.user when present (guests allowed). */
const optionalAuth = wrap(async (req, _res, next) => {
  req.user = await decodeUser(req);
  next();
});

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';

/**
 * Fixed-window rate limit stored in Firestore.
 * @param {string} key unique key, e.g. `otp:+97333...`
 */
async function rateLimit(key, max, windowSec) {
  const ref = db.collection('ratelimits').doc(Buffer.from(key).toString('base64url').slice(0, 300));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nowMs = Date.now();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.resetAt < nowMs) {
      tx.set(ref, { count: 1, resetAt: nowMs + windowSec * 1000 });
      return;
    }
    if (d.count >= max) throw new HttpError(429, 'Too many attempts. Please wait a moment.', 'rate_limit');
    tx.update(ref, { count: d.count + 1 });
  });
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error', code: err.code });
}

function htmlPage(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{background:#0F0F0F;color:#fff;font-family:system-ui,Segoe UI,Tahoma,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.c{background:#fff;color:#111;border-radius:24px;padding:32px;max-width:420px;text-align:center}.l{width:64px;height:64px;background:#000;color:#fff;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:900}</style></head>
<body><div class="c"><div class="l">K</div><h2>${title}</h2><p>${body}</p></div></body></html>`;
}

module.exports = { HttpError, wrap, requireAuth, optionalAuth, rateLimit, clientIp, errorHandler, htmlPage };
