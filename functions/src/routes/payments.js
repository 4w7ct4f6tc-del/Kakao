'use strict';
const express = require('express');
const { db, env, now, apiUrl, webUrl } = require('../lib/admin');
const { HttpError, wrap, requireAuth } = require('../lib/http');
const { setPlan } = require('../lib/users');

const r = express.Router();

const PRICES = {
  pro: { usd: Number(env('PRICE_PRO_USD', '9.99')), bhd: Number(env('PRICE_PRO_BHD', '3.900')) },
  ultra: { usd: Number(env('PRICE_ULTRA_USD', '24.99')), bhd: Number(env('PRICE_ULTRA_BHD', '9.900')) },
};

function stripe() {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) throw new HttpError(503, 'STRIPE_SECRET_KEY missing', 'not_configured');
  return require('stripe')(key);
}

async function record(uid, plan, amount, currency, method, status, ref) {
  const doc = db.collection('payments').doc(String(ref).replace(/\//g, '_'));
  await doc.set({ id: doc.id, userId: uid, plan, amount, currency, method, status, updatedAt: now() }, { merge: true });
}

async function paypalToken() {
  const id = env('PAYPAL_CLIENT_ID');
  const secret = env('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new HttpError(503, 'PayPal not configured', 'not_configured');
  const base = env('PAYPAL_BASE_URL', 'https://api-m.paypal.com');
  const r2 = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  return { base, token: (await r2.json()).access_token };
}

/** POST /payments/checkout {plan, method: stripe|benefitpay|paypal} -> {url} */
r.post('/payments/checkout', requireAuth, wrap(async (req, res) => {
  const { plan, method } = req.body;
  const uid = req.user.uid;
  if (!PRICES[plan]) throw new HttpError(400, 'Unknown plan');
  const success = `${webUrl()}/billing/success?plan=${plan}`;
  const cancel = `${webUrl()}/billing/cancel`;

  if (method === 'stripe') {
    // Card + Apple Pay + Google Pay (wallets are enabled automatically in Stripe Checkout).
    const priceId = env(plan === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_ULTRA');
    const session = await stripe().checkout.sessions.create({
      mode: priceId ? 'subscription' : 'payment',
      line_items: [priceId
        ? { price: priceId, quantity: 1 }
        : { quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(PRICES[plan].usd * 100), product_data: { name: `KAkAo ${plan}` } } }],
      success_url: success,
      cancel_url: cancel,
      client_reference_id: uid,
      metadata: { uid, plan },
      ...(priceId ? { subscription_data: { metadata: { uid, plan } } } : {}),
      customer_email: req.user.email || undefined,
    });
    await record(uid, plan, PRICES[plan].usd, 'USD', 'stripe', 'pending', session.id);
    return res.json({ url: session.url });
  }

  if (method === 'benefitpay') {
    // BenefitPay (Bahrain) through Tap Payments' BENEFIT source.
    const key = env('TAP_SECRET_KEY');
    if (!key) throw new HttpError(503, 'TAP_SECRET_KEY missing', 'not_configured');
    const r2 = await fetch('https://api.tap.company/v2/charges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: PRICES[plan].bhd,
        currency: 'BHD',
        customer: { first_name: req.user.name || 'KAkAo', email: req.user.email || undefined },
        source: { id: 'src_bh.benefit' },
        metadata: { uid, plan },
        redirect: { url: success },
        post: { url: `${apiUrl()}/payments/tap/webhook` },
        description: `KAkAo ${plan}`,
      }),
    });
    const d = await r2.json();
    if (!d.transaction?.url) throw new HttpError(502, `Tap: ${JSON.stringify(d.errors || d).slice(0, 200)}`);
    await record(uid, plan, PRICES[plan].bhd, 'BHD', 'benefitpay', 'pending', d.id);
    return res.json({ url: d.transaction.url });
  }

  if (method === 'paypal') {
    const { base, token } = await paypalToken();
    const r2 = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ custom_id: `${uid}|${plan}`, description: `KAkAo ${plan}`, amount: { currency_code: 'USD', value: PRICES[plan].usd.toFixed(2) } }],
        application_context: { return_url: `${apiUrl()}/payments/paypal/return`, cancel_url: cancel, brand_name: 'KAkAo' },
      }),
    });
    const d = await r2.json();
    const approve = (d.links || []).find((l) => l.rel === 'approve');
    if (!approve) throw new HttpError(502, 'PayPal order failed');
    await record(uid, plan, PRICES[plan].usd, 'USD', 'paypal', 'pending', d.id);
    return res.json({ url: approve.href });
  }

  throw new HttpError(400, 'Unknown payment method');
}));

// ---------------------------------------------------------------- Webhooks
r.post('/payments/stripe/webhook', wrap(async (req, res) => {
  const s = stripe();
  let event;
  try {
    event = s.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], env('STRIPE_WEBHOOK_SECRET'));
  } catch (e) {
    throw new HttpError(400, `Webhook signature: ${e.message}`);
  }
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed') {
    const { uid, plan } = obj.metadata || {};
    if (uid && plan) {
      await setPlan(uid, plan);
      await record(uid, plan, (obj.amount_total || 0) / 100, (obj.currency || 'usd').toUpperCase(), 'stripe', 'paid', obj.id);
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const { uid } = obj.metadata || {};
    if (uid) await setPlan(uid, 'free');
  }
  res.json({ received: true });
}));

/** Tap posts the charge; we re-fetch it from Tap to verify before upgrading. */
r.post('/payments/tap/webhook', wrap(async (req, res) => {
  const id = req.body.id;
  const r2 = await fetch(`https://api.tap.company/v2/charges/${id}`, { headers: { Authorization: `Bearer ${env('TAP_SECRET_KEY')}` } });
  const charge = await r2.json();
  const { uid, plan } = charge.metadata || {};
  if (charge.status === 'CAPTURED' && uid && plan) {
    await setPlan(uid, plan);
    await record(uid, plan, charge.amount, charge.currency, 'benefitpay', 'paid', charge.id);
  }
  res.json({ ok: true });
}));

r.get('/payments/paypal/return', wrap(async (req, res) => {
  const { base, token } = await paypalToken();
  const r2 = await fetch(`${base}/v2/checkout/orders/${req.query.token}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const d = await r2.json();
  const custom = d.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id || d.purchase_units?.[0]?.custom_id || '';
  const [uid, plan] = custom.split('|');
  if (d.status === 'COMPLETED' && uid && plan) {
    await setPlan(uid, plan);
    await record(uid, plan, 0, 'USD', 'paypal', 'paid', d.id);
    return res.redirect(`${webUrl()}/billing/success?plan=${plan}`);
  }
  res.redirect(`${webUrl()}/billing/cancel`);
}));

module.exports = r;
