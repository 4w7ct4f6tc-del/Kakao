'use strict';
const express = require('express');
const OpenAI = require('openai').default;
const { env, uploadBuffer } = require('../lib/admin');
const { HttpError, wrap, optionalAuth, requireAuth, rateLimit, clientIp } = require('../lib/http');
const { aiJson, getKey, routeChat } = require('../lib/ai');
const { getPlan, isPaid } = require('../lib/users');
const { randomId } = require('../lib/crypto');
const { normalizeDesign, DESIGN_SCHEMA_HINT } = require('./builder');

const r = express.Router();

/** POST /vision/analyze {image(base64), mime, mode: buildApp|translate|document|idCard, lang} */
r.post('/vision/analyze', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  const plan = await getPlan(uid);
  await rateLimit(`vision:${uid || clientIp(req)}`, isPaid(plan) ? 60 : 5, isPaid(plan) ? 3600 : 86400);
  const image = { data: String(req.body.image || ''), mime: req.body.mime || 'image/jpeg' };
  if (!image.data) throw new HttpError(400, 'image required');
  const lang = req.body.lang || 'en';
  const mode = req.body.mode;

  if (mode === 'buildApp') {
    const { data } = await aiJson({
      uid,
      engine: 'gemini',
      image,
      prompt: `Look at this photo (a shop front, business card, restaurant menu, product, or sign). Detect: business name, business type, brand colors (hex), products/services with prices, phone, Instagram, address.
Build an app design JSON in language "${lang}" using exactly this schema:
${DESIGN_SCHEMA_HINT}
Use the real names and prices you can read. If something is not visible, invent sensible defaults matching the business.`,
    });
    const design = normalizeDesign(data, { lang });
    return res.json({ design, text: `${design.name} • ${design.type}` });
  }

  if (mode === 'idCard') {
    const { data } = await aiJson({
      uid,
      engine: 'chatgpt',
      image,
      prompt: 'Extract fields from this ID card / business card for a signup form. Return JSON {"name":"","idNumber":"","dateOfBirth":"","nationality":"","phone":"","email":"","address":""}. Leave unknown fields empty.',
    });
    const fields = Object.fromEntries(Object.entries(data || {}).filter(([, v]) => v));
    return res.json({ fields, text: Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n') });
  }

  const prompt = mode === 'translate'
    ? `Read ALL text in this image (OCR), then translate it into language code "${lang}". Output only the translation, keeping the line structure.`
    : 'Read all text in this image (OCR) exactly as written, keeping line breaks. Output only the text.';
  const out = await routeChat({ uid, engine: 'gemini', image, messages: [{ role: 'user', content: prompt }], system: 'You are a precise OCR and translation engine.' });
  res.json({ text: out.text.trim() });
}));

// ---------------------------------------------------------------- Images
async function generateImage(uid, prompt) {
  const openai = await getKey(uid, 'openai');
  if (openai.key) {
    try {
      const client = new OpenAI({ apiKey: openai.key });
      const out = await client.images.generate({ model: env('OPENAI_IMAGE_MODEL', 'gpt-image-1'), prompt, size: '1024x1024', n: 1 });
      const item = out.data[0];
      const buf = item.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
      return uploadBuffer(`ai-images/${uid || 'guest'}/${randomId(9)}.png`, buf, 'image/png');
    } catch (e) {
      console.warn('openai image failed', e.message);
    }
  }
  const gemini = await getKey(uid, 'gemini');
  if (gemini.key) {
    const model = env('IMAGEN_MODEL', 'imagen-4.0-generate-001');
    const r2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini.key },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1 } }),
    });
    if (r2.ok) {
      const d = await r2.json();
      const b64 = d.predictions?.[0]?.bytesBase64Encoded;
      if (b64) return uploadBuffer(`ai-images/${uid || 'guest'}/${randomId(9)}.png`, Buffer.from(b64, 'base64'), 'image/png');
    } else {
      console.warn('imagen failed', r2.status);
    }
  }
  throw new HttpError(503, 'Image generation needs OPENAI_API_KEY or GEMINI_API_KEY', 'not_configured');
}

r.post('/images/generate', requireAuth, wrap(async (req, res) => {
  const plan = await getPlan(req.user.uid);
  await rateLimit(`img:${req.user.uid}`, isPaid(plan) ? 100 : 5, 86400);
  const prompt = String(req.body.prompt || '').slice(0, 1000);
  if (!prompt) throw new HttpError(400, 'prompt required');
  res.json({ url: await generateImage(req.user.uid, prompt) });
}));

r.post('/images/upload', requireAuth, wrap(async (req, res) => {
  const mime = /^image\/(png|jpe?g|webp|gif)$/.test(req.body.mime) ? req.body.mime : 'image/jpeg';
  const buf = Buffer.from(String(req.body.data || ''), 'base64');
  if (!buf.length || buf.length > 8 * 1024 * 1024) throw new HttpError(400, 'Image must be under 8MB');
  const url = await uploadBuffer(`uploads/${req.user.uid}/${randomId(9)}.${mime.split('/')[1]}`, buf, mime);
  res.json({ url });
}));

module.exports = r;
module.exports.generateImage = generateImage;
