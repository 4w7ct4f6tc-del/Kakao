'use strict';
const express = require('express');
const { db, env, now } = require('../lib/admin');
const { HttpError, wrap, optionalAuth, rateLimit, clientIp } = require('../lib/http');
const { routeChat, aiJson } = require('../lib/ai');
const { getPlan } = require('../lib/users');

const r = express.Router();

/** POST /ai/chat {engine, messages[], lang, chatId?, image?} */
r.post('/ai/chat', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  const plan = await getPlan(uid);
  // Free = unlimited chat, protected from abuse by a generous per-minute limit.
  await rateLimit(`chat:${uid || clientIp(req)}`, plan === 'free' ? 30 : 120, 60);
  const image = req.body.image ? { data: String(req.body.image), mime: req.body.mime || 'image/jpeg' } : null;
  const out = await routeChat({ uid, engine: req.body.engine, messages: req.body.messages, lang: req.body.lang, image });
  if (uid) {
    const chatId = req.body.chatId || `${uid}_default`;
    const msgs = (req.body.messages || []).slice(-40).map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 4000) }));
    msgs.push({ role: 'assistant', content: out.text.slice(0, 4000), engine: out.engine });
    db.collection('chats').doc(chatId).set({ userId: uid, aiUsed: out.engine, language: req.body.lang || 'auto', messages: msgs, updatedAt: now() }, { merge: true })
      .catch((e) => console.warn('chat save failed', e.message));
  }
  res.json(out);
}));

// ---------------------------------------------------------------- Translation (DeepL -> Google -> LLM)
async function translateText(text, target, uid) {
  const deepl = env('DEEPL_API_KEY');
  if (deepl) {
    const host = deepl.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const r2 = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${deepl}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], target_lang: target.toUpperCase().replace('EN', 'EN-US') }),
    });
    if (r2.ok) return (await r2.json()).translations[0].text;
  }
  const google = env('GOOGLE_TRANSLATE_API_KEY');
  if (google) {
    const r2 = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${google}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target, format: 'text' }),
    });
    if (r2.ok) return (await r2.json()).data.translations[0].translatedText;
  }
  const out = await routeChat({
    uid,
    engine: 'chatgpt',
    system: `Translate the user's text into language code "${target}". Output only the translation.`,
    messages: [{ role: 'user', content: text }],
  });
  return out.text.trim();
}

r.post('/translate', optionalAuth, wrap(async (req, res) => {
  const text = String(req.body.text || '').slice(0, 8000);
  const target = String(req.body.target || 'en').slice(0, 8);
  if (!text) throw new HttpError(400, 'text required');
  res.json({ text: await translateText(text, target, req.user && req.user.uid) });
}));

/** UI strings for any language: {target, texts: {key: english}} -> {texts: {key: translated}}. Cached in Firestore. */
r.post('/translate/batch', wrap(async (req, res) => {
  const target = String(req.body.target || '').replace(/[^a-zA-Z-]/g, '').slice(0, 8);
  const texts = req.body.texts || {};
  if (!target) throw new HttpError(400, 'target required');
  const cacheRef = db.collection('i18n').doc(target);
  const cached = await cacheRef.get();
  if (cached.exists && Object.keys(cached.data().texts || {}).length >= Object.keys(texts).length) {
    return res.json({ texts: cached.data().texts });
  }
  const { data } = await aiJson({
    engine: 'chatgpt',
    prompt: `Translate the VALUES of this JSON object from English into the language with code "${target}". Keep keys, keep brand names (KAkAo, Google, Apple, WhatsApp, ChatGPT, Claude, Gemini, Meta AI) unchanged. Return the JSON object only.\n${JSON.stringify(texts)}`,
  });
  await cacheRef.set({ texts: data, updatedAt: now() });
  res.json({ texts: data });
}));

module.exports = r;
module.exports.translateText = translateText;
