'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { admin, db, env, now, apiUrl } = require('../lib/admin');
const { HttpError, wrap, requireAuth, rateLimit, clientIp, htmlPage } = require('../lib/http');
const { otpCode, shortCode, randomId, sha256, signState, verifyState } = require('../lib/crypto');
const { sendCodeEverywhere, sendEmail } = require('../lib/notify');
const { findUser, findOrCreateByPhone, normalizePhone, isEmail, mask, ensureUser } = require('../lib/users');

const r = express.Router();
const OTP_TTL = 10 * 60 * 1000;

const customToken = (uid) => admin.auth().createCustomToken(uid);

// ---------------------------------------------------------------- OTP helpers
async function issueOtp(key, meta = {}) {
  const code = otpCode();
  await db.collection('otp').doc(sha256(key)).set({
    hash: await bcrypt.hash(code, 10),
    expiresAt: Date.now() + OTP_TTL,
    attempts: 0,
    ...meta,
  });
  return code;
}

async function checkOtp(key, code) {
  const ref = db.collection('otp').doc(sha256(key));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(400, 'Code expired. Send a new one.', 'otp_expired');
  const d = snap.data();
  if (d.expiresAt < Date.now()) {
    await ref.delete();
    throw new HttpError(400, 'Code expired. Send a new one.', 'otp_expired');
  }
  if (d.attempts >= 5) {
    await ref.delete();
    throw new HttpError(429, 'Too many attempts. Send a new code.', 'rate_limit');
  }
  if (!(await bcrypt.compare(String(code || ''), d.hash))) {
    await ref.update({ attempts: d.attempts + 1 });
    throw new HttpError(400, 'Wrong code', 'otp_wrong');
  }
  await ref.delete();
  return d;
}

const devCode = (code) => (env('DEV_SHOW_OTP') === 'true' ? { devCode: code } : {});

// ---------------------------------------------------------------- Phone OTP login
r.post('/otp/send', wrap(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const email = isEmail(req.body.email) ? req.body.email.trim().toLowerCase() : null;
  if (!/^\+\d{7,15}$/.test(phone)) throw new HttpError(400, 'Enter phone with country code, e.g. +973...', 'bad_phone');
  await rateLimit(`otp:${phone}`, 5, 600);
  await rateLimit(`otpip:${clientIp(req)}`, 20, 3600);
  const code = await issueOtp(`login:${phone}`, { phone, email });
  const sentVia = await sendCodeEverywhere({ phone, email, code, lang: req.body.lang });
  if (!sentVia.length && env('DEV_SHOW_OTP') !== 'true') throw new HttpError(503, 'Messaging not configured', 'not_configured');
  res.json({ sentVia, ...devCode(code) });
}));

r.post('/otp/verify', wrap(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  await rateLimit(`otpv:${phone}`, 10, 600);
  const d = await checkOtp(`login:${phone}`, req.body.code);
  const user = await findOrCreateByPhone(phone, d.email);
  await ensureUser(user.uid);
  res.json({ token: await customToken(user.uid) });
}));

// ---------------------------------------------------------------- Recovery: OTP to all channels on file
r.post('/recovery/otp/send', wrap(async (req, res) => {
  const id = String(req.body.identifier || '').trim();
  await rateLimit(`rec:${id}`, 5, 600);
  const user = await findUser(id);
  // Same response whether or not the account exists (no account enumeration).
  if (!user) return res.json({ sentVia: [] });
  const code = await issueOtp(`recover:${user.uid}`);
  const sentVia = await sendCodeEverywhere({ phone: user.phoneNumber, email: user.email, code, lang: req.body.lang });
  res.json({ sentVia: sentVia.map((c) => `${c} ${mask(c === 'Email' ? user.email : user.phoneNumber)}`), ...devCode(code) });
}));

r.post('/recovery/otp/verify', wrap(async (req, res) => {
  const user = await findUser(req.body.identifier);
  if (!user) throw new HttpError(400, 'Wrong code', 'otp_wrong');
  await rateLimit(`recv:${user.uid}`, 10, 600);
  await checkOtp(`recover:${user.uid}`, req.body.code);
  res.json({ token: await customToken(user.uid) });
}));

// ---------------------------------------------------------------- Recovery: magic link
r.post('/recovery/magic', wrap(async (req, res) => {
  const email = String(req.body.email || req.body.identifier || '').trim().toLowerCase();
  await rateLimit(`magic:${email}`, 3, 600);
  const id = randomId(32);
  const secret = randomId(32);
  const user = isEmail(email) ? await findUser(email) : null;
  await db.collection('magic').doc(id).set({
    uid: user ? user.uid : null,
    secretHash: sha256(secret),
    status: 'pending',
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  if (user) {
    const link = `${apiUrl()}/auth/magic?id=${id}&t=${secret}`;
    await sendEmail(
      email,
      'Sign in to KAkAo',
      `Tap to sign in: ${link}\nThis link expires in 15 minutes.`,
      `<div style="font-family:system-ui;text-align:center;padding:24px"><h2>KAkAo</h2><p><a href="${link}" style="background:#16A34A;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700">Sign in / تسجيل الدخول</a></p><p style="color:#666">15 min</p></div>`,
    ).catch((e) => console.warn('magic email failed', e.message));
  }
  res.json({ id });
}));

r.get('/auth/magic', wrap(async (req, res) => {
  const ref = db.collection('magic').doc(String(req.query.id || ''));
  const snap = await ref.get();
  const d = snap.exists ? snap.data() : null;
  if (!d || d.expiresAt < Date.now() || d.secretHash !== sha256(req.query.t) || !d.uid) {
    return res.status(400).send(htmlPage('Link expired / الرابط منتهي', 'Request a new link from the app.'));
  }
  await ref.update({ status: 'approved' });
  res.send(htmlPage('✅ Done / تم', 'Go back to the app — you are signed in.<br>ارجع للتطبيق — تم تسجيل دخولك.'));
}));

r.get('/recovery/magic/poll', wrap(async (req, res) => {
  const ref = db.collection('magic').doc(String(req.query.id || ''));
  const snap = await ref.get();
  if (!snap.exists) return res.json({ status: 'unknown' });
  const d = snap.data();
  if (d.expiresAt < Date.now()) return res.json({ status: 'expired' });
  if (d.status !== 'approved') return res.json({ status: d.status });
  await ref.delete(); // one-time
  res.json({ status: 'approved', token: await customToken(d.uid) });
}));

// ---------------------------------------------------------------- Recovery: approval from another device
r.post('/recovery/approval/request', wrap(async (req, res) => {
  const id = String(req.body.identifier || '').trim();
  await rateLimit(`appr:${id}`, 5, 600);
  const user = await findUser(id);
  const reqId = randomId(32);
  const code = shortCode();
  await db.collection('approvals').doc(reqId).set({
    uid: user ? user.uid : null,
    code,
    status: 'pending',
    deviceName: String(req.body.deviceName || 'New device').slice(0, 60),
    ip: clientIp(req),
    createdAt: now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  res.json({ id: reqId, code });
}));

r.get('/recovery/approval/poll', wrap(async (req, res) => {
  const ref = db.collection('approvals').doc(String(req.query.id || ''));
  const snap = await ref.get();
  if (!snap.exists) return res.json({ status: 'unknown' });
  const d = snap.data();
  if (d.expiresAt < Date.now()) return res.json({ status: 'expired' });
  if (d.status === 'denied') return res.json({ status: 'denied' });
  if (d.status !== 'approved' || !d.uid) return res.json({ status: 'pending' });
  await ref.delete();
  res.json({ status: 'approved', token: await customToken(d.uid) });
}));

// ---------------------------------------------------------------- Recovery: trusted device (biometric)
r.post('/recovery/device', wrap(async (req, res) => {
  const deviceId = String(req.body.deviceId || '');
  await rateLimit(`dev:${deviceId}`, 10, 600);
  const snap = await db.collection('devices').doc(sha256(deviceId)).get();
  if (!snap.exists || !(await bcrypt.compare(String(req.body.deviceSecret || ''), snap.data().secretHash))) {
    throw new HttpError(403, 'This device is not trusted yet. Use another recovery option.', 'untrusted');
  }
  await snap.ref.update({ lastSeen: now() });
  res.json({ token: await customToken(snap.data().uid) });
}));

// ---------------------------------------------------------------- Recovery: smart questions
const normalizeAnswer = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

r.post('/recovery/questions/get', wrap(async (req, res) => {
  const user = await findUser(req.body.identifier);
  if (!user) return res.json({ questions: [] });
  const snap = await db.collection('users').doc(user.uid).collection('private').doc('security').get();
  res.json({ questions: snap.exists ? snap.data().questions || [] : [] });
}));

r.post('/recovery/questions/verify', wrap(async (req, res) => {
  const user = await findUser(req.body.identifier);
  if (!user) throw new HttpError(400, 'Wrong answers', 'wrong');
  await rateLimit(`q:${user.uid}`, 5, 3600);
  const snap = await db.collection('users').doc(user.uid).collection('private').doc('security').get();
  const hashes = snap.exists ? snap.data().answerHashes || [] : [];
  const answers = req.body.answers || [];
  if (!hashes.length) throw new HttpError(400, 'No questions set', 'wrong');
  for (let i = 0; i < hashes.length; i++) {
    if (!(await bcrypt.compare(normalizeAnswer(answers[i]), hashes[i]))) throw new HttpError(400, 'Wrong answers', 'wrong');
  }
  res.json({ token: await customToken(user.uid) });
}));

r.post('/security/questions', requireAuth, wrap(async (req, res) => {
  const questions = (req.body.questions || []).map((q) => String(q).slice(0, 200)).slice(0, 3);
  const answers = (req.body.answers || []).slice(0, 3);
  if (questions.length !== 3 || answers.some((a) => normalizeAnswer(a).length < 2)) throw new HttpError(400, 'Fill all 3 answers');
  const answerHashes = await Promise.all(answers.map((a) => bcrypt.hash(normalizeAnswer(a), 10)));
  await db.collection('users').doc(req.user.uid).collection('private').doc('security').set({ questions, answerHashes, updatedAt: now() });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Change password after recovery
r.post('/auth/set-password', requireAuth, wrap(async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters', 'weak');
  await admin.auth().updateUser(req.user.uid, { password }); // Firebase stores a salted scrypt hash
  await admin.auth().revokeRefreshTokens(req.user.uid); // sign out stolen sessions
  res.json({ ok: true, token: await customToken(req.user.uid) });
}));

// ---------------------------------------------------------------- Devices
r.post('/devices/register', requireAuth, wrap(async (req, res) => {
  const deviceId = String(req.body.deviceId || '');
  if (deviceId.length < 8) throw new HttpError(400, 'bad device');
  await db.collection('devices').doc(sha256(deviceId)).set({
    uid: req.user.uid,
    name: String(req.body.name || 'Device').slice(0, 60),
    secretHash: await bcrypt.hash(String(req.body.deviceSecret || ''), 10),
    lastSeen: now(),
  });
  res.json({ ok: true });
}));

r.get('/devices', requireAuth, wrap(async (req, res) => {
  const q = await db.collection('devices').where('uid', '==', req.user.uid).get();
  res.json({
    devices: q.docs.map((d) => ({ id: d.id, name: d.data().name, lastSeen: d.data().lastSeen?.toDate?.().toISOString() || '' })),
  });
}));

r.post('/devices/remove', requireAuth, wrap(async (req, res) => {
  const ref = db.collection('devices').doc(String(req.body.deviceId || ''));
  const snap = await ref.get();
  if (snap.exists && snap.data().uid === req.user.uid) await ref.delete();
  res.json({ ok: true });
}));

r.get('/devices/approvals', requireAuth, wrap(async (req, res) => {
  const q = await db.collection('approvals').where('uid', '==', req.user.uid).where('status', '==', 'pending').get();
  res.json({
    approvals: q.docs
      .filter((d) => d.data().expiresAt > Date.now())
      .map((d) => ({ id: d.id, code: d.data().code, deviceName: d.data().deviceName, ip: d.data().ip })),
  });
}));

r.post('/devices/approvals/decide', requireAuth, wrap(async (req, res) => {
  const ref = db.collection('approvals').doc(String(req.body.id || ''));
  const snap = await ref.get();
  if (!snap.exists || snap.data().uid !== req.user.uid) throw new HttpError(404, 'Not found');
  await ref.update({ status: req.body.approve ? 'approved' : 'denied' });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Desktop OAuth bridge (Windows)
const BRIDGE = {
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    id: 'GOOGLE_OAUTH_CLIENT_ID',
    secret: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
  github: {
    auth: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    id: 'GITHUB_OAUTH_CLIENT_ID',
    secret: 'GITHUB_OAUTH_CLIENT_SECRET',
  },
  facebook: {
    auth: 'https://www.facebook.com/v21.0/dialog/oauth',
    token: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scope: 'email,public_profile',
    id: 'FACEBOOK_APP_ID',
    secret: 'FACEBOOK_APP_SECRET',
  },
  apple: {
    auth: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    scope: 'name email',
    id: 'APPLE_SERVICES_ID',
  },
};

/** Apple client_secret = ES256 JWT signed with the .p8 key. */
function appleClientSecret() {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: env('APPLE_KEY_ID') })).toString('base64url');
  const t = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: env('APPLE_TEAM_ID'), iat: t, exp: t + 3600, aud: 'https://appleid.apple.com', sub: env('APPLE_SERVICES_ID'),
  })).toString('base64url');
  const key = env('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

r.get('/auth/bridge/start', wrap(async (req, res) => {
  const p = BRIDGE[req.query.provider];
  const nonce = String(req.query.nonce || '');
  if (!p || nonce.length < 16) throw new HttpError(400, 'bad request');
  const clientId = env(p.id);
  if (!clientId) return res.status(503).send(htmlPage('Not configured', `${p.id} is missing in functions/.env`));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${apiUrl()}/auth/bridge/callback`,
    response_type: 'code',
    scope: p.scope,
    state: signState({ nonce, provider: req.query.provider }),
  });
  if (req.query.provider === 'apple') params.set('response_mode', 'form_post');
  if (req.query.provider === 'google') params.set('prompt', 'select_account');
  res.redirect(`${p.auth}?${params}`);
}));

async function bridgeCallback(req, res) {
  const q = { ...req.query, ...req.body };
  const st = verifyState(q.state);
  if (!st || !q.code) return res.status(400).send(htmlPage('Expired', 'Please try again from the app.'));
  const p = BRIDGE[st.provider];
  const body = new URLSearchParams({
    client_id: env(p.id),
    client_secret: st.provider === 'apple' ? appleClientSecret() : env(p.secret),
    code: q.code,
    redirect_uri: `${apiUrl()}/auth/bridge/callback`,
    grant_type: 'authorization_code',
  });
  const tr = await fetch(p.token, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const tok = await tr.json();
  if (!tr.ok || tok.error) return res.status(400).send(htmlPage('Sign-in failed', 'Please try again.'));

  let profile = {};
  if (st.provider === 'google') {
    profile = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
    profile = { id: profile.sub, email: profile.email, name: profile.name, photo: profile.picture, verified: profile.email_verified };
  } else if (st.provider === 'github') {
    const h = { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': 'kakao-app' };
    const u = await (await fetch('https://api.github.com/user', { headers: h })).json();
    const emails = await (await fetch('https://api.github.com/user/emails', { headers: h })).json().catch(() => []);
    const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
    profile = { id: String(u.id), email: primary ? primary.email : null, name: u.name || u.login, photo: u.avatar_url, verified: !!primary };
  } else if (st.provider === 'facebook') {
    const u = await (await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tok.access_token}`)).json();
    profile = { id: u.id, email: u.email, name: u.name, photo: u.picture?.data?.url, verified: !!u.email };
  } else if (st.provider === 'apple') {
    const claims = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString());
    profile = { id: claims.sub, email: claims.email, verified: claims.email_verified === true || claims.email_verified === 'true' };
  }

  let user = null;
  if (profile.email && profile.verified) {
    try { user = await admin.auth().getUserByEmail(profile.email.toLowerCase()); } catch {}
  }
  const uid = user ? user.uid : `${st.provider}:${profile.id}`;
  if (!user) {
    try {
      user = await admin.auth().getUser(uid);
    } catch {
      user = await admin.auth().createUser({
        uid,
        displayName: profile.name || undefined,
        photoURL: profile.photo || undefined,
        email: profile.email && profile.verified ? profile.email.toLowerCase() : undefined,
        emailVerified: !!profile.verified,
      });
    }
  }
  await ensureUser(user.uid);
  await db.collection('authBridge').doc(sha256(st.nonce)).set({ token: await customToken(user.uid), expiresAt: Date.now() + 5 * 60 * 1000 });
  res.send(htmlPage('✅ Signed in / تم تسجيل الدخول', 'Return to the KAkAo app.<br>ارجع للتطبيق.'));
}

r.get('/auth/bridge/callback', wrap(bridgeCallback));
r.post('/auth/bridge/callback', express.urlencoded({ extended: false }), wrap(bridgeCallback));

r.get('/auth/bridge/poll', wrap(async (req, res) => {
  const ref = db.collection('authBridge').doc(sha256(String(req.query.nonce || '')));
  const snap = await ref.get();
  if (!snap.exists || snap.data().expiresAt < Date.now()) return res.json({ status: 'pending' });
  await ref.delete();
  res.json({ status: 'ok', token: snap.data().token });
}));

module.exports = r;
