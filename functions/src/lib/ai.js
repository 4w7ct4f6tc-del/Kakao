'use strict';
const Anthropic = require('@anthropic-ai/sdk').default;
const OpenAI = require('openai').default;
const { db, env } = require('./admin');
const { decrypt } = require('./crypto');
const { getPlan } = require('./users');

/** Models are configurable via .env so they can be updated without code changes. */
const MODELS = {
  openai: () => env('OPENAI_MODEL', 'gpt-4o'),
  openaiMini: () => env('OPENAI_MODEL_MINI', 'gpt-4o-mini'),
  claudeUltra: () => env('CLAUDE_MODEL_ULTRA', 'claude-opus-5-5'),
  claudePro: () => env('CLAUDE_MODEL_PRO', 'claude-sonnet-5-5'),
  claudeBasic: () => env('CLAUDE_MODEL_BASIC', 'claude-haiku-5-5'),
  gemini: () => env('GEMINI_MODEL', 'gemini-2.5-pro'),
  geminiFlash: () => env('GEMINI_MODEL_FAST', 'gemini-2.5-flash'),
  meta: () => env('META_MODEL', 'llama-3.3-70b-versatile'),
};

const ENV_KEYS = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY', meta: 'META_LLAMA_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY' };
const ENGINE_PROVIDER = { chatgpt: 'openai', claude: 'anthropic', gemini: 'gemini', meta: 'meta' };

/** BYOK first (user's own encrypted key), then platform key. */
async function getKey(uid, provider) {
  if (uid) {
    try {
      const snap = await db.collection('users').doc(uid).collection('private').doc('keys').get();
      const enc = snap.exists ? snap.data()[provider] : null;
      if (enc) return { key: decrypt(enc), byok: true };
    } catch (e) {
      console.warn('byok read failed', e.message);
    }
  }
  return { key: env(ENV_KEYS[provider]), byok: false };
}

const SYSTEM = (lang) =>
  [
    'You are the assistant inside KAKAO, the easiest app builder in the world (brand: "KAkAo" in English, "خعخعو" in Arabic, by K.A Familia Global Company).',
    'Always reply in the same language the user writes in' + (lang && lang !== 'auto' ? ` (current UI language code: ${lang})` : '') + '. If the user asks to switch language (e.g. "تكلم فرنسي"), switch immediately.',
    'Be short, warm and practical. Use simple words. One task at a time.',
    'If something is hard or not directly possible, do not stop at a refusal of effort: offer up to 3 practical alternatives, recommend the best one and start on it. Be honest about real limits.',
    'If the user wants an app/website/store, tell them to tap "Build this app" and ask for the shop name, colors and what they sell.',
  ].join('\n');

function cleanHistory(messages) {
  const list = (messages || [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 12000) }))
    .slice(-30);
  while (list.length && list[0].role !== 'user') list.shift();
  return list;
}

// ---------------- Providers ----------------
async function callOpenAI({ key, model, messages, system, image, json }) {
  const client = new OpenAI({ apiKey: key });
  const msgs = [{ role: 'system', content: system }, ...messages];
  if (image) {
    const last = msgs[msgs.length - 1];
    last.content = [
      { type: 'text', text: last.content || 'Describe this image' },
      { type: 'image_url', image_url: { url: `data:${image.mime || 'image/jpeg'};base64,${image.data}` } },
    ];
  }
  const r = await client.chat.completions.create({
    model,
    messages: msgs,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  });
  return r.choices[0].message.content || '';
}

async function callClaude({ key, model, messages, system, image }) {
  const client = new Anthropic({ apiKey: key });
  const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
  if (image) {
    const last = msgs[msgs.length - 1];
    last.content = [
      { type: 'image', source: { type: 'base64', media_type: image.mime || 'image/jpeg', data: image.data } },
      { type: 'text', text: last.content || 'Describe this image' },
    ];
  }
  const r = await client.messages.create({ model, max_tokens: 16000, system, messages: msgs });
  if (r.stop_reason === 'refusal') throw new Error('claude refusal');
  return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function callGemini({ key, model, messages, system, image, json }) {
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  if (image) contents[contents.length - 1].parts.push({ inline_data: { mime_type: image.mime || 'image/jpeg', data: image.data } });
  const base = env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com');
  const r = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: system }] },
      ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

/** Meta Llama via any OpenAI-compatible host (Groq default, or Together / Meta Llama API). */
async function callMeta({ key, model, messages, system, json }) {
  const base = env('META_LLAMA_BASE_URL', 'https://api.groq.com/openai/v1');
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`meta ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

// ---------------- Router ----------------
function autoRoute(text, hasImage) {
  const t = String(text || '').toLowerCase();
  if (hasImage || /(صورة|صور|فيديو|image|photo|picture|video|draw|ارسم)/.test(t)) return 'gemini';
  if (/(كود|برمج|برنامج|bug|code|program|function|flutter|python|javascript|api|error|خطأ)/.test(t)) return 'claude';
  if (/(اكتب|مقال|قصة|قصيدة|إعلان|اعلان|تسويق|write|essay|story|poem|marketing|caption|email)/.test(t)) return 'chatgpt';
  return 'meta';
}

/** Which model an engine uses for a plan. null => engine locked for this plan. */
function modelFor(engine, plan, byok) {
  const paid = plan === 'pro' || plan === 'ultra';
  switch (engine) {
    case 'chatgpt':
      return paid || byok ? MODELS.openai() : null;
    case 'claude':
      if (plan === 'ultra' || byok) return MODELS.claudeUltra();
      return plan === 'pro' ? MODELS.claudePro() : MODELS.claudeBasic(); // free = basic Claude
    case 'gemini':
      return paid || byok ? MODELS.gemini() : null;
    case 'meta':
      return MODELS.meta(); // free & fast
    default:
      return null;
  }
}

const CALLERS = { chatgpt: callOpenAI, claude: callClaude, gemini: callGemini, meta: callMeta };

/**
 * Runs a chat on the requested engine, falling back to the next available
 * engine (max 3 attempts). Same history is passed to every engine, so
 * switching AI keeps the conversation.
 */
async function routeChat({ uid, engine, messages, lang, image, json = false, system }) {
  const plan = await getPlan(uid);
  const history = cleanHistory(messages);
  if (!history.length) history.push({ role: 'user', content: 'Hello' });
  let first = engine && engine !== 'auto' ? engine : autoRoute(history[history.length - 1].content, !!image);
  const order = [first, ...['claude', 'chatgpt', 'gemini', 'meta'].filter((e) => e !== first)];
  const errors = [];
  let notice;
  let attempts = 0;
  for (const e of order) {
    if (attempts >= 3) break;
    const { key, byok } = await getKey(uid, ENGINE_PROVIDER[e]);
    const model = modelFor(e, plan, byok);
    if (!key) continue;
    if (!model) {
      if (e === first) notice = 'upgrade';
      continue;
    }
    if (image && e === 'meta') continue; // text-only host
    attempts++;
    try {
      const text = await CALLERS[e]({ key, model, messages: history, system: system || SYSTEM(lang), image, json });
      if (!text || !text.trim()) throw new Error('empty');
      return { text, engine: e, model, notice: e === first ? undefined : notice || 'fallback' };
    } catch (err) {
      errors.push(`${e}: ${err.message}`);
      console.warn('[ai] engine failed', e, err.message);
    }
  }
  const error = new Error(errors.length ? 'All AI engines failed' : 'No AI keys configured');
  error.status = 503;
  error.code = errors.length ? 'ai_failed' : 'not_configured';
  error.details = errors;
  throw error;
}

/** Ask for JSON and parse it robustly. Prefers Claude (best for building apps). */
async function aiJson({ uid, prompt, system, image, engine = 'claude' }) {
  const r = await routeChat({
    uid,
    engine,
    image,
    json: true,
    system: system || 'You output ONLY valid minified JSON. No markdown, no commentary.',
    messages: [{ role: 'user', content: prompt }],
  });
  return { data: parseJson(r.text), engine: r.engine };
}

function parseJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.search(/[[{]/);
    const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error('invalid json from AI');
  }
}

module.exports = { routeChat, aiJson, parseJson, getKey, autoRoute, modelFor, MODELS, cleanHistory };
