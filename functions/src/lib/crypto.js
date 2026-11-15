'use strict';
const crypto = require('crypto');
const { env } = require('./admin');

/**
 * AES-256-GCM for integration tokens and BYOK keys.
 * ENCRYPTION_KEY = 32 random bytes, base64 (generate: `openssl rand -base64 32`).
 */
function key() {
  const k = env('ENCRYPTION_KEY');
  if (!k) throw Object.assign(new Error('ENCRYPTION_KEY missing'), { status: 500, code: 'not_configured' });
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw Object.assign(new Error('ENCRYPTION_KEY must be 32 bytes base64'), { status: 500 });
  return buf;
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

function decrypt(payload) {
  const [iv, tag, data] = String(payload).split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

const randomId = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
const otpCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const shortCode = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function hmac(data) {
  const secret = env('STATE_SECRET') || env('ENCRYPTION_KEY') || 'dev-state-secret';
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/** Signed, expiring OAuth state. */
function signState(obj, ttlSec = 900) {
  const body = Buffer.from(JSON.stringify({ ...obj, exp: Date.now() + ttlSec * 1000 })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

function verifyState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const expected = hmac(body);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const obj = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  return obj.exp > Date.now() ? obj : null;
}

module.exports = { encrypt, decrypt, randomId, otpCode, shortCode, sha256, signState, verifyState };
