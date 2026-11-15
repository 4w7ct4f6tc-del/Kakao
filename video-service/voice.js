'use strict';
/**
 * voice.js — real narration: ElevenLabs (primary) -> OpenAI TTS (fallback).
 * Returns an MP3 Buffer, or null when no voice key is configured
 * (assemble.js then makes a silent scene with on-screen subtitles).
 */
const env = (k, d = '') => (process.env[k] && !process.env[k].startsWith('YOUR_') ? process.env[k] : d);

const VOICES = {
  male: { eleven: 'ELEVENLABS_VOICE_MALE', def: 'pNInz6obpgDQGcFmaJgB', openai: 'onyx' },
  female: { eleven: 'ELEVENLABS_VOICE_FEMALE', def: 'EXAVITQu4vr4xnSDxMaL', openai: 'nova' },
  bahraini: { eleven: 'ELEVENLABS_VOICE_BAHRAINI', def: '', openai: 'shimmer', instructions: 'Speak in a warm Bahraini Gulf Arabic accent.' },
  en_us: { eleven: 'ELEVENLABS_VOICE_EN_US', def: '21m00Tcm4TlvDq8ikWAM', openai: 'alloy' },
  en_uk: { eleven: 'ELEVENLABS_VOICE_EN_UK', def: 'JBFqnCBsd6RMkjVDRZzb', openai: 'fable' },
};

async function elevenlabs(text, voice, speed) {
  const key = env('ELEVENLABS_API_KEY');
  const preset = VOICES[voice] || VOICES.female;
  const id = String(voice).startsWith('clone:') ? voice.slice(6) : env(preset.eleven, preset.def);
  if (!key || !id) throw new Error('elevenlabs not configured');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: env('ELEVENLABS_MODEL', 'eleven_multilingual_v2'),
      voice_settings: { stability: 0.45, similarity_boost: 0.8, speed: Math.min(1.2, Math.max(0.7, speed)) },
    }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function openaiTts(text, voice, speed) {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('openai not configured');
  const preset = VOICES[voice] || VOICES.female;
  const model = env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice: preset.openai, input: text, speed, ...(preset.instructions && model.includes('gpt') ? { instructions: preset.instructions } : {}) }),
  });
  if (!r.ok) throw new Error(`openai tts ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function narrate(text, { voice = 'female', speed = 1 } = {}) {
  for (const fn of [elevenlabs, openaiTts]) {
    try {
      return await fn(String(text).slice(0, 2500), voice, speed);
    } catch (e) {
      console.warn('[voice]', fn.name, e.message);
    }
  }
  return null;
}

module.exports = { narrate, VOICES };
