'use strict';
const express = require('express');
const { spawn } = require('child_process');
const OpenAI = require('openai').default;
const { toFile } = require('openai');
const { env } = require('../lib/admin');
const { HttpError, wrap, optionalAuth, requireAuth, rateLimit, clientIp } = require('../lib/http');
const { getKey } = require('../lib/ai');
const { getPlan, isPaid } = require('../lib/users');

const r = express.Router();

/**
 * Voice presets. ElevenLabs voice IDs are configurable — pick voices in your
 * ElevenLabs Voice Library (e.g. a Gulf/Bahraini Arabic voice) and paste the IDs.
 */
const VOICES = {
  male: { eleven: () => env('ELEVENLABS_VOICE_MALE', 'pNInz6obpgDQGcFmaJgB'), openai: 'onyx' },
  female: { eleven: () => env('ELEVENLABS_VOICE_FEMALE', 'EXAVITQu4vr4xnSDxMaL'), openai: 'nova' },
  bahraini: { eleven: () => env('ELEVENLABS_VOICE_BAHRAINI', 'YOUR_BAHRAINI_VOICE_ID'), openai: 'shimmer', instructions: 'Speak in a warm Bahraini Gulf Arabic accent.' },
  en_us: { eleven: () => env('ELEVENLABS_VOICE_EN_US', '21m00Tcm4TlvDq8ikWAM'), openai: 'alloy' },
  en_uk: { eleven: () => env('ELEVENLABS_VOICE_EN_UK', 'JBFqnCBsd6RMkjVDRZzb'), openai: 'fable' },
  fr: { eleven: () => env('ELEVENLABS_VOICE_FR', 'EXAVITQu4vr4xnSDxMaL'), openai: 'nova', instructions: 'Speak French.' },
  hi: { eleven: () => env('ELEVENLABS_VOICE_HI', 'EXAVITQu4vr4xnSDxMaL'), openai: 'nova', instructions: 'Speak Hindi.' },
};

async function elevenTts(key, voiceId, text, speed) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: env('ELEVENLABS_MODEL', 'eleven_multilingual_v2'),
      voice_settings: { stability: 0.45, similarity_boost: 0.8, speed: Math.min(1.2, Math.max(0.7, speed || 1)) },
    }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openaiTts(key, preset, text, speed) {
  const client = new OpenAI({ apiKey: key });
  const model = env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts');
  const resp = await client.audio.speech.create({
    model,
    voice: preset.openai,
    input: text,
    speed: Math.min(2, Math.max(0.5, speed || 1)),
    ...(preset.instructions && model.includes('gpt') ? { instructions: preset.instructions } : {}),
  });
  return Buffer.from(await resp.arrayBuffer());
}

/** Pitch shift without changing tempo (ffmpeg asetrate + atempo). */
function shiftPitch(buf, pitch) {
  if (!pitch || Math.abs(pitch - 1) < 0.02) return Promise.resolve(buf);
  const ffmpeg = require('ffmpeg-static');
  return new Promise((resolve) => {
    const p = spawn(ffmpeg, ['-i', 'pipe:0', '-af', `asetrate=44100*${pitch},aresample=44100,atempo=${(1 / pitch).toFixed(4)}`, '-f', 'mp3', 'pipe:1']);
    const out = [];
    p.stdout.on('data', (d) => out.push(d));
    p.on('close', (code) => resolve(code === 0 && out.length ? Buffer.concat(out) : buf));
    p.on('error', () => resolve(buf));
    p.stdin.on('error', () => {});
    p.stdin.end(buf);
  });
}

/** Shared TTS (also used by the video pipeline). Returns MP3 buffer. */
async function synthesize({ uid, text, voice = 'female', speed = 1, pitch = 1, provider = 'elevenlabs' }) {
  const plan = await getPlan(uid);
  const preset = VOICES[voice] || VOICES.female;
  const eleven = await getKey(uid, 'elevenlabs');
  const openai = await getKey(uid, 'openai');
  let audio;
  const tryEleven = async () => {
    if (!eleven.key || (!isPaid(plan) && !eleven.byok)) throw new Error('elevenlabs unavailable');
    const id = String(voice).startsWith('clone:') ? voice.slice(6) : preset.eleven();
    if (id.startsWith('YOUR_')) throw new Error('voice id not set');
    return elevenTts(eleven.key, id, text, speed);
  };
  const tryOpenai = async () => {
    if (!openai.key) throw new Error('openai unavailable');
    return openaiTts(openai.key, preset, text, speed);
  };
  const order = provider === 'openai' ? [tryOpenai, tryEleven] : [tryEleven, tryOpenai];
  let lastErr;
  for (const fn of order) {
    try {
      audio = await fn();
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!audio) throw new HttpError(503, `Voice not available: ${lastErr && lastErr.message}`, 'not_configured');
  return shiftPitch(audio, pitch);
}

r.post('/voice/tts', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  const plan = await getPlan(uid);
  // Real voice is a paid feature; free users get a small daily taste.
  if (!isPaid(plan)) await rateLimit(`ttsfree:${uid || clientIp(req)}`, 15, 86400);
  else await rateLimit(`tts:${uid}`, 60, 60);
  const text = String(req.body.text || '').slice(0, 2500);
  if (!text) throw new HttpError(400, 'text required');
  const audio = await synthesize({ uid, text, voice: req.body.voice, speed: Number(req.body.speed) || 1, pitch: Number(req.body.pitch) || 1, provider: req.body.provider });
  res.json({ audio: audio.toString('base64'), mime: 'audio/mpeg' });
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
  form.append('files', new Blob([Buffer.from(String(req.body.audio || ''), 'base64')], { type: 'audio/mp4' }), 'sample.m4a');
  const r2 = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!r2.ok) throw new HttpError(502, `Clone failed: ${(await r2.text()).slice(0, 200)}`);
  res.json({ voiceId: (await r2.json()).voice_id });
}));

module.exports = r;
module.exports.synthesize = synthesize;
