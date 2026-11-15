'use strict';
const { admin, db, now } = require('./admin');
const { HttpError } = require('./http');

const PLANS = ['free', 'pro', 'ultra'];
const FREE_APP_LIMIT = 3;

/** Ensures users/{uid} exists (schema: id, name, email, phone, photo, plan, language, aiChoice, createdAt). */
async function ensureUser(uid) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  let rec = {};
  try {
    rec = await admin.auth().getUser(uid);
  } catch {}
  const data = {
    id: uid,
    name: rec.displayName || '',
    email: rec.email || '',
    phone: rec.phoneNumber || '',
    photo: rec.photoURL || '',
    plan: 'free',
    language: 'auto',
    aiChoice: 'auto',
    createdAt: now(),
  };
  await ref.set(data);
  return data;
}

async function getPlan(uid) {
  if (!uid) return 'free';
  const u = await ensureUser(uid);
  return PLANS.includes(u.plan) ? u.plan : 'free';
}

async function setPlan(uid, plan) {
  if (!PLANS.includes(plan)) throw new HttpError(400, 'bad plan');
  await db.collection('users').doc(uid).set({ plan, planUpdatedAt: now() }, { merge: true });
}

const isPaid = (plan) => plan === 'pro' || plan === 'ultra';

async function requirePaid(uid, feature) {
  const plan = await getPlan(uid);
  if (!isPaid(plan)) throw new HttpError(402, `${feature} is a paid feature`, 'plan');
  return plan;
}

const normalizePhone = (p) => String(p || '').replace(/[^\d+]/g, '').replace(/^00/, '+');
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

/** Find a Firebase Auth user by email or phone. */
async function findUser(identifier) {
  const id = String(identifier || '').trim();
  try {
    if (isEmail(id)) return await admin.auth().getUserByEmail(id.toLowerCase());
    return await admin.auth().getUserByPhoneNumber(normalizePhone(id));
  } catch {
    return null;
  }
}

async function findOrCreateByPhone(phone, email) {
  const p = normalizePhone(phone);
  try {
    return await admin.auth().getUserByPhoneNumber(p);
  } catch {
    const data = { phoneNumber: p };
    if (email && isEmail(email)) {
      try {
        await admin.auth().getUserByEmail(email);
      } catch {
        data.email = email.toLowerCase();
      }
    }
    return admin.auth().createUser(data);
  }
}

const mask = (s) => {
  const v = String(s || '');
  if (isEmail(v)) {
    const [a, b] = v.split('@');
    return `${a.slice(0, 2)}***@${b}`;
  }
  return v.length > 4 ? `${'*'.repeat(v.length - 4)}${v.slice(-4)}` : v;
};

module.exports = {
  ensureUser, getPlan, setPlan, isPaid, requirePaid, findUser, findOrCreateByPhone,
  normalizePhone, isEmail, mask, FREE_APP_LIMIT,
};
