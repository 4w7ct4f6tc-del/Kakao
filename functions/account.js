'use strict';
const express = require('express');
const { db, env, now, apiUrl } = require('./lib/admin');
const { HttpError, wrap, requireAuth, htmlPage } = require('./lib/http');
const { encrypt, decrypt, signState, verifyState } = require('./lib/crypto');
const { ensureUser, getPlan, isPaid } = require('./lib/users');

const r = express.Router();

// ---------------------------------------------------------------- Profile
r.get('/me', requireAuth, wrap(async (req, res) => {
  const u = await ensureUser(req.user.uid);
  res.json({ ...u, createdAt: u.createdAt?.toDate?.().toISOString?.() || null });
}));

r.post('/me/prefs', requireAuth, wrap(async (req, res) => {
  const allowed = {};
  if (typeof req.body.language === 'string') allowed.language = req.body.language.slice(0, 8);
  if (typeof req.body.aiChoice === 'string') allowed.aiChoice = req.body.aiChoice.slice(0, 20);
  if (typeof req.body.name === 'string') allowed.name = req.body.name.slice(0, 80);
  await db.collection('users').doc(req.user.uid).set(allowed, { merge: true });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- BYOK keys
const BYOK = ['openai', 'anthropic', 'gemini', 'meta', 'elevenlabs'];

r.get('/keys', requireAuth, wrap(async (req, res) => {
  const snap = await db.collection('users').doc(req.user.uid).collection('private').doc('keys').get();
  const data = snap.exists ? snap.data() : {};
  res.json({ keys: Object.fromEntries(BYOK.map((k) => [k, !!data[k]])) });
}));

r.post('/keys', requireAuth, wrap(async (req, res) => {
  const { provider, key } = req.body;
  if (!BYOK.includes(provider)) throw new HttpError(400, 'Unknown provider');
  const ref = db.collection('users').doc(req.user.uid).collection('private').doc('keys');
  if (!key) {
    const { FieldValue } = require('firebase-admin/firestore');
    await ref.set({ [provider]: FieldValue.delete() }, { merge: true });
  } else {
    await ref.set({ [provider]: encrypt(String(key).trim()) }, { merge: true });
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Integrations (OAuth 2.0 + API keys)
const G = 'https://accounts.google.com/o/oauth2/v2/auth';
const GT = 'https://oauth2.googleapis.com/token';
const FB = 'https://www.facebook.com/v21.0/dialog/oauth';
const FBT = 'https://graph.facebook.com/v21.0/oauth/access_token';

const OAUTH = {
  google: {
    auth: G, token: GT, id: 'GOOGLE_OAUTH_CLIENT_ID', secret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    scopes: ['openid', 'email', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/calendar.events'],
    extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    revoke: async (t) => fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token || t.access_token)}`, { method: 'POST' }),
  },
  youtube: {
    auth: G, token: GT, id: 'GOOGLE_OAUTH_CLIENT_ID', secret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
    extra: { access_type: 'offline', prompt: 'consent' },
    revoke: async (t) => fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token || t.access_token)}`, { method: 'POST' }),
  },
  firebase: {
    auth: G, token: GT, id: 'GOOGLE_OAUTH_CLIENT_ID', secret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform'],
    extra: { access_type: 'offline', prompt: 'consent' },
    revoke: async (t) => fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh_token || t.access_token)}`, { method: 'POST' }),
  },
  facebook: {
    auth: FB, token: FBT, id: 'FACEBOOK_APP_ID', secret: 'FACEBOOK_APP_SECRET', sep: ',',
    scopes: ['public_profile', 'pages_show_list', 'pages_manage_posts'],
    revoke: async (t) => fetch(`https://graph.facebook.com/me/permissions?access_token=${t.access_token}`, { method: 'DELETE' }),
  },
  instagram: {
    auth: FB, token: FBT, id: 'FACEBOOK_APP_ID', secret: 'FACEBOOK_APP_SECRET', sep: ',',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    revoke: async (t) => fetch(`https://graph.facebook.com/me/permissions?access_token=${t.access_token}`, { method: 'DELETE' }),
  },
  whatsapp: {
    auth: FB, token: FBT, id: 'FACEBOOK_APP_ID', secret: 'FACEBOOK_APP_SECRET', sep: ',',
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging', 'business_management'],
    revoke: async (t) => fetch(`https://graph.facebook.com/me/permissions?access_token=${t.access_token}`, { method: 'DELETE' }),
  },
  github: {
    auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token',
    id: 'GITHUB_OAUTH_CLIENT_ID', secret: 'GITHUB_OAUTH_CLIENT_SECRET', scopes: ['repo', 'workflow'],
    revoke: async (t) => fetch(`https://api.github.com/applications/${env('GITHUB_OAUTH_CLIENT_ID')}/grant`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${Buffer.from(`${env('GITHUB_OAUTH_CLIENT_ID')}:${env('GITHUB_OAUTH_CLIENT_SECRET')}`).toString('base64')}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kakao' },
      body: JSON.stringify({ access_token: t.access_token }),
    }),
  },
  stripe: {
    auth: 'https://connect.stripe.com/oauth/authorize', token: 'https://connect.stripe.com/oauth/token',
    id: 'STRIPE_CONNECT_CLIENT_ID', secret: 'STRIPE_SECRET_KEY', scopes: ['read_write'],
    revoke: async (t) => fetch('https://connect.stripe.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env('STRIPE_CONNECT_CLIENT_ID'), stripe_user_id: t.stripe_user_id || '' }),
    }),
  },
  vercel: {
    auth: `https://vercel.com/integrations/${env('VERCEL_INTEGRATION_SLUG', 'YOUR_INTEGRATION_SLUG')}/new`, token: 'https://api.vercel.com/v2/oauth/access_token',
    id: 'VERCEL_CLIENT_ID', secret: 'VERCEL_CLIENT_SECRET', scopes: [],
  },
  tiktok: {
    auth: 'https://www.tiktok.com/v2/auth/authorize/', token: 'https://open.tiktokapis.com/v2/oauth/token/',
    id: 'TIKTOK_CLIENT_KEY', secret: 'TIKTOK_CLIENT_SECRET', scopes: ['user.info.basic', 'video.upload'], sep: ',', clientIdParam: 'client_key',
    revoke: async (t) => fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), token: t.access_token }),
    }),
  },
  supabase: {
    auth: 'https://api.supabase.com/v1/oauth/authorize', token: 'https://api.supabase.com/v1/oauth/token',
    id: 'SUPABASE_OAUTH_CLIENT_ID', secret: 'SUPABASE_OAUTH_CLIENT_SECRET', scopes: [], basicAuth: true,
  },
};

/** Services without third-party OAuth: the user pastes a key/token. */
const APIKEY = ['cloudflare', 'render', 'telegram', 'twilio', 'sendgrid', 'benefitpay', 'paypal', 'openai', 'anthropic', 'gemini', 'elevenlabs'];

r.get('/integrations', requireAuth, wrap(async (req, res) => {
  const q = await db.collection('integrations').where('userId', '==', req.user.uid).get();
  const connected = {};
  q.docs.forEach((d) => {
    const x = d.data();
    connected[x.provider] = { connectedAt: x.connectedAt?.toDate?.().toISOString() || null, scopes: x.scopes || [] };
  });
  res.json({ connected });
}));

async function assertIntegrationAllowed(uid, provider) {
  const plan = await getPlan(uid);
  if (isPaid(plan)) return;
  const q = await db.collection('integrations').where('userId', '==', uid).get();
  const others = q.docs.filter((d) => d.data().provider !== provider);
  if (others.length >= 1) throw new HttpError(402, 'Free plan includes 1 connection', 'plan');
}

r.post('/integrations/start', requireAuth, wrap(async (req, res) => {
  const provider = req.body.provider;
  const p = OAUTH[provider];
  if (!p) throw new HttpError(400, 'Unknown provider');
  await assertIntegrationAllowed(req.user.uid, provider);
  const clientId = env(p.id);
  if (!clientId) throw new HttpError(503, `${p.id} missing in functions/.env`, 'not_configured');
  const params = new URLSearchParams({
    [p.clientIdParam || 'client_id']: clientId,
    redirect_uri: `${apiUrl()}/integrations/callback`,
    response_type: 'code',
    state: signState({ uid: req.user.uid, provider }),
    ...(p.scopes.length ? { scope: p.scopes.join(p.sep || ' ') } : {}),
    ...(p.extra || {}),
  });
  res.json({ url: `${p.auth}?${params}` });
}));

r.get('/integrations/callback', wrap(async (req, res) => {
  const st = verifyState(req.query.state);
  if (!st) return res.status(400).send(htmlPage('Expired', 'Please try again from the app.'));
  if (req.query.error) return res.send(htmlPage('Cancelled / تم الإلغاء', 'Nothing was connected.'));
  const p = OAUTH[st.provider];
  const body = new URLSearchParams({
    [p.clientIdParam || 'client_id']: env(p.id),
    code: String(req.query.code || ''),
    redirect_uri: `${apiUrl()}/integrations/callback`,
    grant_type: 'authorization_code',
  });
  const headers = { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };
  if (p.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${env(p.id)}:${env(p.secret)}`).toString('base64')}`;
  else body.set('client_secret', env(p.secret));
  const tr = await fetch(p.token, { method: 'POST', headers, body });
  const tok = await tr.json();
  if (!tr.ok || tok.error) return res.status(400).send(htmlPage('Connection failed', String(tok.error_description || tok.error || tr.status)));
  await db.collection('integrations').doc(`${st.uid}_${st.provider}`).set({
    id: `${st.uid}_${st.provider}`,
    userId: st.uid,
    provider: st.provider,
    kind: 'oauth',
    tokenEncrypted: encrypt(JSON.stringify(tok)),
    scopes: String(tok.scope || p.scopes.join(' ')).split(/[ ,]+/).filter(Boolean).slice(0, 12),
    connectedAt: now(),
  });
  res.send(htmlPage('✅ Connected / تم الربط', 'Return to the KAkAo app. You can disconnect anytime in Settings.'));
}));

r.post('/integrations/apikey', requireAuth, wrap(async (req, res) => {
  const { provider, key, extra } = req.body;
  if (!APIKEY.includes(provider)) throw new HttpError(400, 'Unknown provider');
  if (!key || String(key).length < 8) throw new HttpError(400, 'Key looks too short');
  await assertIntegrationAllowed(req.user.uid, provider);
  await db.collection('integrations').doc(`${req.user.uid}_${provider}`).set({
    id: `${req.user.uid}_${provider}`,
    userId: req.user.uid,
    provider,
    kind: 'apikey',
    tokenEncrypted: encrypt(JSON.stringify({ key: String(key).trim(), extra: extra || {} })),
    scopes: ['api_key'],
    connectedAt: now(),
  });
  res.json({ ok: true });
}));

r.post('/integrations/disconnect', requireAuth, wrap(async (req, res) => {
  const ref = db.collection('integrations').doc(`${req.user.uid}_${req.body.provider}`);
  const snap = await ref.get();
  if (snap.exists) {
    const p = OAUTH[req.body.provider];
    if (p && p.revoke) {
      try {
        await p.revoke(JSON.parse(decrypt(snap.data().tokenEncrypted)));
      } catch (e) {
        console.warn('revoke failed', e.message);
      }
    }
    await ref.delete();
  }
  res.json({ ok: true });
}));

/** Server-side helper for other modules: get a decrypted integration token. */
async function getIntegrationToken(uid, provider) {
  const snap = await db.collection('integrations').doc(`${uid}_${provider}`).get();
  return snap.exists ? JSON.parse(decrypt(snap.data().tokenEncrypted)) : null;
}

module.exports = r;
module.exports.getIntegrationToken = getIntegrationToken;
