'use client';
import { api } from './api';
import { detectLang } from './i18n';

/** Same voice settings as the Flutter app. voice = auto | bahraini | en_us | en_uk | fr | hi | clone:<id> */
export type VoiceSettings = { voice: string; gender: 'male' | 'female'; speed: number; pitch: number; volume: number; provider: 'elevenlabs' | 'openai'; autoRead: boolean };
export const DEFAULT_VOICE: VoiceSettings = { voice: 'auto', gender: 'female', speed: 1, pitch: 1, volume: 1, provider: 'elevenlabs', autoRead: false };

export function loadVoice(): VoiceSettings {
  try {
    const raw = localStorage.getItem('voice');
    return raw ? { ...DEFAULT_VOICE, ...JSON.parse(raw) } : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export async function saveVoice(v: VoiceSettings) {
  try { localStorage.setItem('voice', JSON.stringify(v)); } catch {}
  await api('/me/prefs', { voice: v }).catch(() => {});
}

let current: HTMLAudioElement | null = null;

/**
 * Real human voice from the server (ElevenLabs / OpenAI). With followLanguage the
 * accent follows the text: Arabic → Bahraini, English → English (a cloned voice is kept).
 * Returns 'real' or 'device' (offline preview: the most natural voice on this device).
 */
export async function speak(text: string, v: VoiceSettings, opts: { lang?: string; followLanguage?: boolean } = {}): Promise<'real' | 'device'> {
  current?.pause();
  try {
    const r = await api<{ audio: string }>('/voice/tts', {
      text,
      voice: opts.followLanguage && !v.voice.startsWith('clone:') ? 'auto' : v.voice,
      gender: v.gender,
      speed: v.speed,
      pitch: v.pitch,
      provider: v.provider,
      lang: opts.lang,
    });
    current = new Audio(`data:audio/mpeg;base64,${r.audio}`);
    current.volume = v.volume;
    await current.play();
    await new Promise<void>((res) => { current!.onended = () => res(); current!.onerror = () => res(); });
    return 'real';
  } catch {
    await deviceVoice(text, v, opts.lang);
    return 'device';
  }
}

/** Offline preview only: picks the most natural ("Natural", "Neural", "Online") system voice for the language. */
function deviceVoice(text: string, v: VoiceSettings, lang?: string) {
  return new Promise<void>((res) => {
    if (typeof speechSynthesis === 'undefined') return res();
    const l = (lang || detectLang(text) || 'en').slice(0, 2);
    const voices = speechSynthesis.getVoices().filter((x) => x.lang.toLowerCase().startsWith(l));
    const score = (x: SpeechSynthesisVoice) =>
      (/natural|neural|online|premium|enhanced/i.test(x.name) ? 4 : 0) + (/BH|AE|SA|KW|QA/i.test(x.lang) ? 2 : 0) + (/google/i.test(x.name) ? 1 : 0) +
      ((v.gender === 'male') === /male|man|majed|hamed|naayf|tarik|guy|david|daniel/i.test(x.name) && !/female/i.test(x.name) ? 1 : 0);
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`>~|]/g, ''));
    u.voice = voices.sort((a, b) => score(b) - score(a))[0] || null;
    u.lang = u.voice?.lang || l;
    u.rate = v.speed;
    u.pitch = v.pitch;
    u.volume = v.volume;
    u.onend = () => res();
    u.onerror = () => res();
    speechSynthesis.speak(u);
  });
}

export const SAMPLES: Record<string, string> = {
  bahraini: 'هلا والله! شلونك؟ أنا صوتك الجديد في خعخعو. قول لي شنو تبي، وأسويه لك على طول.',
  en_us: "Hey! I'm your new voice in KAkAo. Tell me what you want to build, and I'll make it for you.",
  en_uk: "Hello! I'm your new voice in KAkAo. Tell me what you'd like to build, and I'll sort it out.",
  fr: 'Bonjour ! Je suis votre nouvelle voix. Dites-moi ce que vous voulez construire.',
  hi: 'नमस्ते! मैं आपकी नई आवाज़ हूँ। बताइए, आप क्या बनाना चाहते हैं?',
};
