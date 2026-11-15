'use strict';
const express = require('express');
const { spawn } = require('child_process');
const OpenAI = require('openai').default;
const { toFile } = require('openai');
const { env } = require('./lib/admin');
const { HttpError, wrap, optionalAuth, requireAuth, rateLimit, clientIp } = require('./lib/http');
const { getKey } = require('./ai');
const { getPlan, isPaid } = require('./lib/users');

const r = express.Router();

/**
 * Real human voices. Every accent has a male and a female voice.
 * ElevenLabs IDs are configurable: open ElevenLabs → Voice Library, search
 * "Gulf Arabic" / "Khaleeji" / "Bahraini", add the voice and paste its ID into
 * ELEVENLABS_VOICE_BAHRAINI_MALE / _FEMALE. Until then the multilingual voices
 * speak Arabic and OpenAI is instructed to use the Bahraini dialect.
 */
const NATURAL = 'Sound like a real, warm person talking to a friend: natural rhythm, small pauses, relaxed and friendly. Never sound robotic or like an announcer.';
const VOICES = {
  bahraini: {
    eleven: { male: () => env('ELEVENLABS_VOICE_BAHRAINI_MALE', env('ELEVENLABS_VOICE_BAHRAINI')), female: () => env('ELEVENLABS_VOICE_BAHRAINI_FEMALE', env('ELEVENLABS_VOICE_BAHRAINI')) },
    openai: { male: 'ash', female: 'coral' },
    instructions: `Speak in the Bahraini Gulf Arabic dialect (لهجة بحرينية خليجية), with a natural Bahraini accent and intonation. ${NATURAL}`,
  },
  en_us: {
    eleven: { male: () => env('ELEVENLABS_VOICE_EN_US_MALE', env('ELEVENLABS_VOICE_MALE', 'pNInz6obpgDQGcFmaJgB')), female: () => env('ELEVENLABS_VOICE_EN_US_FEMALE', env('ELEVENLABS_VOICE_EN_US', '21m00Tcm4TlvDq8ikWAM')) },
    openai: { male: 'ash', female: 'coral' },
    instructions: `Speak with a natural American English accent. ${NATURAL}`,
  },
  en_uk: {
    eleven: { male: () => env('ELEVENLABS_VOICE_EN_UK_MALE', env('ELEVENLABS_VOICE_EN_UK', 'JBFqnCBsd6RMkjVDRZzb')), female: () => env('ELEVENLABS_VOICE_EN_UK_FEMALE', 'Xb7hH8MSUJpSbSDYk0k2') },
    openai: { male: 'fable', female: 'sage' },
    instructions: `Speak with a natural British English accent. ${NATURAL}`,
  },
  fr: {
    eleven: { male: () => env('ELEVENLABS_VOICE_FR_MALE', env('ELEVENLABS_VOICE_MALE', 'pNInz6obpgDQGcFmaJgB')), female: () => env('ELEVENLABS_VOICE_FR_FEMALE', env('ELEVENLABS_VOICE_FEMALE', 'EXAVITQu4vr4xnSDxMaL')) },
    openai: { male: 'ash', female: 'nova' },
    instructions: `Speak natural French with a native French accent. ${NATURAL}`,
  },
  hi: {
    eleven: { male: () => env('ELEVENLABS_VOICE_HI_MALE', env('ELEVENLABS_VOICE_MALE', 'pNInz6obpgDQGcFmaJgB')), female: () => env('ELEVENLABS_VOICE_HI_FEMALE', env('ELEVENLABS_VOICE_FEMALE', 'EXAVITQu4vr4xnSDxMaL')) },
    openai: { male: 'ash', female: 'shimmer' },
    instructions: `Speak natural Hindi with a native Indian accent. ${NATURAL}`,
  },
};
const DEFAULT_ELEVEN = { male: () => env('ELEVENLABS_VOICE_MALE', 'pNInz6obpgDQGcFmaJgB'), female: () => env('ELEVENLABS_VOICE_FEMALE', 'EXAVITQu4vr4xnSDxMaL') };

/** Offline language guess from the script / common words. */
function detectLang(text) {
  const t = String(text || '');
  if (/[؀-ۿ]/.test(t)) return 'ar';
  if (/[ऀ-ॿ]/.test(t)) return 'hi';
  if (/\b(le|la|les|je|bonjour|merci|avec|vous|est)\b/i.test(t)) return 'fr';
  return 'en';
}

/**
 * Which accent to use. "auto" (default) follows the language of the text:
 * Arabic → Bahraini, English → US (or UK if chosen), French, Hindi.
 * Legacy values "male"/"female" mean auto + that gender.
 */
function resolveVoice({ voice = 'auto', gender = 'female', text, lang }) {
  let g = gender === 'male' ? 'male' : 'female';
  let v = String(voice || 'auto');
  if (v === 'male' || v === 'female') { g = v; v = 'auto'; }
  if (v.startsWith('clone:')) return { accent: 'clone', gender: g, cloneId: v.slice(6) };
  const l = String(lang || '').slice(0, 2) || detectLang(text);
  const textLang = detectLang(text);
  if (v === 'auto' || !VOICES[v]) {
    const spoken = textLang === 'en' && l !== 'en' ? l : textLang;
    v = spoken === 'ar' ? 'bahraini' : spoken === 'fr' ? 'fr' : spoken === 'hi' ? 'hi' : 'en_us';
  }
  return { accent: v, gender: g };
}

/** Remove what makes TTS sound robotic: markdown, emojis, URLs, list markers. */
function cleanForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*[-*•#>]+\s*/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_~#|]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ')
    .trim()
    .slice(0, 2500);
}

async function elevenTts(key, voiceId, text, speed) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: env('ELEVENLABS_MODEL', 'eleven_multilingual_v2'),
      // Lower stability + some style = more human expression; speaker boost = clearer voice.
      voice_settings: { stability: 0.38, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed || 1)) },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openaiTts(key, voiceName, instructions, text, speed) {
  const client = new OpenAI({ apiKey: key });
  const model = env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts');
  const resp = await client.audio.speech.create({
    model,
    voice: voiceName,
    input: text,
    speed: Math.min(2, Math.max(0.5, speed || 1)),
    response_format: 'mp3',
    ...(model.includes('gpt') ? { instructions } : {}),
  });
  return Buffer.from(await resp.arrayBuffer());
}

/** Speed outside ElevenLabs' 0.7–1.2 range + pitch: ffmpeg atempo / asetrate, tempo kept. */
function postProcess(buf, { pitch = 1, extraTempo = 1 }) {
  const p = Number(pitch) || 1;
  const tempo = Number(extraTempo) || 1;
  if (Math.abs(p - 1) < 0.02 && Math.abs(tempo - 1) < 0.02) return Promise.resolve(buf);
  const ffmpeg = require('ffmpeg-static');
  const filters = [];
  if (Math.abs(p - 1) >= 0.02) filters.push(`asetrate=44100*${p.toFixed(3)}`, 'aresample=44100');
  let t = tempo / (Math.abs(p - 1) >= 0.02 ? p : 1);
  while (t > 2) { filters.push('atempo=2'); t /= 2; }
  while (t < 0.5) { filters.push('atempo=0.5'); t /= 0.5; }
  filters.push(`atempo=${t.toFixed(4)}`);
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ['-i', 'pipe:0', '-af', filters.join(','), '-f', 'mp3', 'pipe:1']);
    const out = [];
    proc.stdout.on('data', (d) => out.push(d));
    proc.on('close', (code) => resolve(code === 0 && out.length ? Buffer.concat(out) : buf));
    proc.on('error', () => resolve(buf));
    proc.stdin.on('error', () => {});
    proc.stdin.end(buf);
  });
}

/** Shared TTS (also used by video jobs). Returns { audio: Buffer, accent, gender, provider }. */
async function synthesize({ uid, text, voice = 'auto', gender = 'female', speed = 1, pitch = 1, provider = 'elevenlabs', lang }) {
  const plan = await getPlan(uid);
  const clean = cleanForSpeech(text);
  if (!clean) throw new HttpError(400, 'Nothing to say', 'empty');
  const v = resolveVoice({ voice, gender, text: clean, lang });
  const preset = VOICES[v.accent] || VOICES.en_us;
  const sp = Math.min(2, Math.max(0.5, Number(speed) || 1));
  const eleven = await getKey(uid, 'elevenlabs');
  const openai = await getKey(uid, 'openai');

  const tryEleven = async () => {
    if (!eleven.key || (!isPaid(plan) && !eleven.byok)) throw new Error('elevenlabs unavailable');
    const id = v.cloneId || preset.eleven[v.gender]() || DEFAULT_ELEVEN[v.gender]();
    const elevenSpeed = Math.min(1.2, Math.max(0.7, sp));
    const audio = await elevenTts(eleven.key, id, clean, elevenSpeed);
    return postProcess(audio, { pitch, extraTempo: sp / elevenSpeed });
  };
  const tryOpenai = async () => {
    if (!openai.key) throw new Error('openai unavailable');
    const audio = await openaiTts(openai.key, preset.openai[v.gender], preset.instructions, clean, sp);
    return postProcess(audio, { pitch });
  };
  // A cloned voice only exists on ElevenLabs.
  const order = v.cloneId ? [tryEleven, tryOpenai] : provider === 'openai' ? [tryOpenai, tryEleven] : [tryEleven, tryOpenai];
  let lastErr;
  for (const fn of order) {
    try {
      const audio = await fn();
      return { audio, accent: v.accent, gender: v.gender, provider: fn === tryEleven ? 'elevenlabs' : 'openai' };
    } catch (e) {
      lastErr = e;
      console.warn('[tts]', fn.name, e.message);
    }
  }
  throw new HttpError(503, `Real voice needs ELEVENLABS_API_KEY or OPENAI_API_KEY (${lastErr && lastErr.message})`, 'not_configured');
}

r.post('/voice/tts', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  const plan = await getPlan(uid);
  // Real voice is a paid feature; free users get a daily taste so they can hear it.
  if (!isPaid(plan)) await rateLimit(`ttsfree:${uid || clientIp(req)}`, 15, 86400);
  else await rateLimit(`tts:${uid}`, 60, 60);
  const out = await synthesize({
    uid,
    text: req.body.text,
    voice: req.body.voice,
    gender: req.body.gender,
    speed: req.body.speed,
    pitch: req.body.pitch,
    provider: req.body.provider,
    lang: req.body.lang,
  });
  res.json({ audio: out.audio.toString('base64'), mime: 'audio/mpeg', accent: out.accent, gender: out.gender, provider: out.provider });
}));

const LANG_CODES = { arabic: 'ar', english: 'en', french: 'fr', hindi: 'hi', urdu: 'ur', spanish: 'es', german: 'de', turkish: 'tr', persian: 'fa', chinese: 'zh', russian: 'ru', bengali: 'bn', indonesian: 'id', japanese: 'ja', korean: 'ko', italian: 'it', portuguese: 'pt' };

r.post('/voice/stt', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  await rateLimit(`stt:${uid || clientIp(req)}`, 30, 60);
  const { key } = await getKey(uid, 'openai');
  if (!key) throw new HttpError(503, 'Speech-to-text needs OPENAI_API_KEY', 'not_configured');
  const client = new OpenAI({ apiKey: key });
  const file = await toFile(Buffer.from(String(req.body.audio || ''), 'base64'), `audio.${req.body.format || 'm4a'}`);
  const out = await client.audio.transcriptions.create({ file, model: env('OPENAI_STT_MODEL', 'whisper-1'), response_format: 'verbose_json' });
  const lang = String(out.language || '').toLowerCase();
  res.json({ text: out.text, lang: LANG_CODES[lang] || lang.slice(0, 2) });
}));

/** Instant voice clone — requires explicit consent + Ultra (or own ElevenLabs key). */
r.post('/voice/clone', requireAuth, wrap(async (req, res) => {
  if (req.body.consent !== true) throw new HttpError(400, 'Consent required', 'consent');
  const plan = await getPlan(req.user.uid);
  const { key, byok } = await getKey(req.user.uid, 'elevenlabs');
  if (plan !== 'ultra' && !byok) throw new HttpError(402, 'Voice clone is an Ultra feature', 'plan');
  if (!key) throw new HttpError(503, 'ELEVENLABS_API_KEY missing', 'not_configured');
  const form = new FormData();
  form.append('name', `${String(req.body.name || 'My voice').slice(0, 40)} (${req.user.uid.slice(0, 6)})`);
  form.append('description', 'Cloned with owner consent in KAKAO');
  const mime = /^audio\/(mp4|m4a|webm|ogg|mpeg|wav)/.test(req.body.mime || '') ? req.body.mime : 'audio/mp4';
  const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[mime.split(';')[0]] || 'm4a';
  const bytes = Buffer.from(String(req.body.audio || ''), 'base64');
  if (bytes.length < 20000) throw new HttpError(400, 'Recording too short — record about 30 seconds', 'short');
  form.append('files', new Blob([bytes], { type: mime }), `sample.${ext}`);
  form.append('remove_background_noise', 'true');
  const r2 = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!r2.ok) throw new HttpError(502, `Clone failed: ${(await r2.text()).slice(0, 200)}`);
  res.json({ voiceId: (await r2.json()).voice_id });
}));

module.exports = r;
Object.assign(module.exports, { synthesize, resolveVoice, cleanForSpeech, detectLang });
