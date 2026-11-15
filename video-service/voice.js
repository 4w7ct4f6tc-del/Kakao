'use strict';
/**
 * voice.js — real human narration: ElevenLabs (primary) -> OpenAI TTS (fallback).
 * The accent follows the story language (Arabic -> Bahraini, English -> US, French, Hindi).
 * Returns an MP3 Buffer, or null when no voice key is configured
 * (assemble.js then makes a silent scene with on-screen subtitles).
 */
const env = (k, d = '') => (process.env[k] && !process.env[k].startsWith('YOUR_') ? process.env[k] : d);

const NATURAL = 'Narrate like a real storyteller: warm, natural rhythm, small pauses, emotion where the story needs it. Never robotic.';
const VOICES = {
  bahraini: { male: ['ELEVENLABS_VOICE_BAHRAINI_MALE', 'ELEVENLABS_VOICE_BAHRAINI'], female: ['ELEVENLABS_VOICE_BAHRAINI_FEMALE', 'ELEVENLABS_VOICE_BAHRAINI'], openai: { male: 'ash', female: 'coral' }, instructions: `Speak in the Bahraini Gulf Arabic dialect with a natural Bahraini accent. ${NATURAL}` },
  en_us: { male: ['ELEVENLABS_VOICE_EN_US_MALE', 'ELEVENLABS_VOICE_MALE'], female: ['ELEVENLABS_VOICE_EN_US_FEMALE', 'ELEVENLABS_VOICE_EN_US'], openai: { male: 'ash', female: 'coral' }, instructions: `American English. ${NATURAL}` },
  en_uk: { male: ['ELEVENLABS_VOICE_EN_UK_MALE', 'ELEVENLABS_VOICE_EN_UK'], female: ['ELEVENLABS_VOICE_EN_UK_FEMALE'], openai: { male: 'fable', female: 'sage' }, instructions: `British English. ${NATURAL}` },
  fr: { male: ['ELEVENLABS_VOICE_FR_MALE'], female: ['ELEVENLABS_VOICE_FR_FEMALE'], openai: { male: 'ash', female: 'nova' }, instructions: `Native French. ${NATURAL}` },
  hi: { male: ['ELEVENLABS_VOICE_HI_MALE'], female: ['ELEVENLABS_VOICE_HI_FEMALE'], openai: { male: 'ash', female: 'shimmer' }, instructions: `Native Hindi. ${NATURAL}` },
};
const DEFAULT = { male: env('ELEVENLABS_VOICE_MALE', 'pNInz6obpgDQGcFmaJgB'), female: env('ELEVENLABS_VOICE_FEMALE', 'EXAVITQu4vr4xnSDxMaL') };

function accentFor(voice, lang, text) {
  if (VOICES[voice]) return voice;
  const l = String(lang || '').slice(0, 2) || (/[؀-ۿ]/.test(text) ? 'ar' : 'en');
  return l === 'ar' ? 'bahraini' : l === 'fr' ? 'fr' : l === 'hi' ? 'hi' : 'en_us';
}

const clean = (t) => String(t || '').replace(/[*_#`>~|]/g, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 2500);

async function elevenlabs(text, { voice, gender, accent, speed }) {
  const key = env('ELEVENLABS_API_KEY');
  const id = String(voice).startsWith('clone:') ? voice.slice(6) : (VOICES[accent][gender].map((k) => env(k)).find(Boolean) || DEFAULT[gender]);
  if (!key) throw new Error('elevenlabs not configured');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: env('ELEVENLABS_MODEL', 'eleven_multilingual_v2'),
      voice_settings: { stability: 0.38, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed)) },
    }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function openaiTts(text, { gender, accent, speed }) {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('openai not configured');
  const model = env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice: VOICES[accent].openai[gender], input: text, speed, ...(model.includes('gpt') ? { instructions: VOICES[accent].instructions } : {}) }),
  });
  if (!r.ok) throw new Error(`openai tts ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function narrate(text, { voice = 'auto', gender = 'female', speed = 1, lang } = {}) {
  const t = clean(text);
  if (!t) return null;
  let g = gender === 'male' ? 'male' : 'female';
  let v = voice;
  if (v === 'male' || v === 'female') { g = v; v = 'auto'; }
  const opts = { voice: v, gender: g, accent: accentFor(v, lang, t), speed: Number(speed) || 1 };
  for (const fn of [elevenlabs, openaiTts]) {
    try {
      return await fn(t, opts);
    } catch (e) {
      console.warn('[voice]', fn.name, e.message);
    }
  }
  return null;
}

module.exports = { narrate, accentFor };
