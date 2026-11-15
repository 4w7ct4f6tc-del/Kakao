'use client';
import { api } from './api';

/** Same lists as functions/persona.js. */
export const DIALECTS: [string, string, string][] = [
  ['bahraini', 'بحريني', 'Bahraini'], ['saudi_najdi', 'سعودي نجدي', 'Saudi Najdi'], ['saudi_hijazi', 'سعودي حجازي', 'Saudi Hijazi'],
  ['emirati', 'إماراتي', 'Emirati'], ['kuwaiti', 'كويتي', 'Kuwaiti'], ['qatari', 'قطري', 'Qatari'], ['omani', 'عماني', 'Omani'],
  ['egyptian', 'مصري', 'Egyptian'], ['moroccan', 'مغربي', 'Moroccan'], ['algerian', 'جزائري', 'Algerian'], ['tunisian', 'تونسي', 'Tunisian'],
  ['jordanian', 'أردني', 'Jordanian'], ['palestinian', 'فلسطيني', 'Palestinian'], ['lebanese', 'لبناني', 'Lebanese'], ['syrian', 'سوري', 'Syrian'],
  ['iraqi', 'عراقي', 'Iraqi'], ['yemeni', 'يمني', 'Yemeni'], ['sudanese', 'سوداني', 'Sudanese'],
];
export const STYLES: [string, string, string][] = [
  ['soft', 'ناعمة', 'Soft'], ['formal', 'رسمية', 'Formal'], ['happy', 'تضحك', 'Happy'], ['story', 'قصص', 'Storytelling'],
  ['ad', 'إعلانات', 'Advertising'], ['kids', 'أطفال', 'Kids'], ['friendly', 'صديقة', 'Friendly'],
];
export const MODES: [string, string, string][] = [['chat', 'محادثة', 'Chat'], ['story', 'قصة', 'Story'], ['ad', 'إعلان', 'Ad']];
export const SPEEDS: [string, string, string, number][] = [['slow', 'بطيء', 'Slow', 0.85], ['normal', 'عادي', 'Normal', 1], ['fast', 'سريع', 'Fast', 1.15]];

export type GirlSettings = { dialect: string; style: string; mode: string; speed: string };
export const DEFAULT_GIRL: GirlSettings = { dialect: 'bahraini', style: 'friendly', mode: 'chat', speed: 'normal' };
export type Msg = { role: 'user' | 'assistant'; content: string };
export type TalkReply = {
  text: string; audio: string | null; action: null | 'insult' | 'prank'; comebackText: string | null; comebackAudio: string | null;
  build: string | null; video: string | null; settings: GirlSettings; offline?: boolean;
};

export function loadGirl(): GirlSettings {
  try { return { ...DEFAULT_GIRL, ...JSON.parse(localStorage.getItem('girl') || '{}') }; } catch { return DEFAULT_GIRL; }
}
export function saveGirl(g: GirlSettings) { try { localStorage.setItem('girl', JSON.stringify(g)); } catch {} }

/** Same parser as the server, so the buttons update instantly. */
const KEYS: Record<string, string[]> = {
  saudi_hijazi: ['حجازي', 'جدة'], bahraini: ['بحريني', 'البحرين'], saudi_najdi: ['نجدي', 'سعودي'], emirati: ['إماراتي', 'اماراتي'],
  kuwaiti: ['كويتي'], qatari: ['قطري'], omani: ['عماني'], egyptian: ['مصري', 'المصرية'], moroccan: ['مغربي'], algerian: ['جزائري'],
  tunisian: ['تونسي'], jordanian: ['أردني', 'اردني'], palestinian: ['فلسطيني'], lebanese: ['لبناني'], syrian: ['سوري'],
  iraqi: ['عراقي'], yemeni: ['يمني'], sudanese: ['سوداني'],
};
const STYLE_KEYS: Record<string, string[]> = { soft: ['ناعمة'], formal: ['رسمية'], happy: ['تضحك', 'ضحك'], story: ['قصص'], ad: ['إعلانات'], kids: ['أطفال', 'اطفال'], friendly: ['صديقة'] };
export function parseRequest(text: string): Partial<GirlSettings> {
  const t = text.toLowerCase();
  const out: Partial<GirlSettings> = {};
  for (const [id, ks] of Object.entries(KEYS)) if (ks.some((k) => t.includes(k))) { out.dialect = id; break; }
  for (const [id, ks] of Object.entries(STYLE_KEYS)) if (ks.some((k) => t.includes(k))) { out.style = id; break; }
  if (/(سوي|اكتب|ابي|أبي|ابغى).{0,20}(إعلان|اعلان)/.test(t)) out.mode = 'ad';
  else if (/(سوي|احكي|اكتب|ابي|أبي|ابغى).{0,20}(قصة|قصه|حكاية)/.test(t)) out.mode = 'story';
  return out;
}

/** Offline preview lines (real conversation needs the AI keys). */
const GREET: Record<string, string> = {
  bahraini: 'هلا والله يالحلو! أنا بنت خعخعو. شنو مسوي اليوم؟ ولا تقول لي ما سويت شي!',
  saudi_najdi: 'هلا والله! أنا بنت خعخعو. وش عندك اليوم؟ لا تقول لي مافي شي ترى أعرفك!',
  saudi_hijazi: 'أهلين! أنا بنت خعخعو. إيش عندك اليوم؟ قول بسرعة قبل ما أزعل!',
  emirati: 'هلا والله! شحالك؟ أنا بنت خعخعو. شو عندك اليوم؟',
  kuwaiti: 'هلا والله! شلونك؟ أنا بنت خعخعو. شنو عندك اليوم؟ لا تخبي علي!',
  qatari: 'هلا والله! شلونك؟ أنا بنت خعخعو. شنو مسوي اليوم؟',
  omani: 'حيّاك! كيف حالك؟ أنا بنت خعخعو. شو عندك اليوم؟',
  egyptian: 'أهلاً بيك! إزيك عامل إيه؟ أنا بنت خعخعو. عندك فكرة إيه النهارده؟',
  moroccan: 'مرحبا بيك! كيداير؟ أنا بنت خعخعو. شنو عندك اليوم؟',
  algerian: 'مرحبا! واش راك؟ أنا بنت خعخعو. واش عندك اليوم؟',
  tunisian: 'عسلامة! لاباس؟ أنا بنت خعخعو. شنوة عندك اليوم؟',
  jordanian: 'هلا والله! كيفك؟ أنا بنت خعخعو. شو عندك اليوم؟',
  palestinian: 'أهلين! كيفك؟ أنا بنت خعخعو. شو في عندك اليوم؟',
  lebanese: 'هلا حبيبي! كيفك؟ أنا بنت خعخعو. شو عندك اليوم؟ يلا خبرني!',
  syrian: 'أهلين! كيفك؟ أنا بنت خعخعو. شو عندك اليوم؟',
  iraqi: 'هلا عيوني! شلونك؟ أنا بنت خعخعو. شكو ماكو اليوم؟',
  yemeni: 'أهلاً وسهلاً! كيف حالك؟ أنا بنت خعخعو. ايش عندك اليوم؟',
  sudanese: 'أهلاً! كيفنك؟ أنا بنت خعخعو. عندك شنو الليلة؟',
};
const RUDE = /(غبي|غبية|حمار|حمارة|تافه|اسكتي|انقلعي|كلب|stupid|idiot|shut up|dumb)/i;

function offlineReply(event: string, s: GirlSettings, history: Msg[], strikes: number): TalkReply {
  const last = [...history].reverse().find((m) => m.role === 'user')?.content || '';
  const base = { audio: null, comebackText: null, comebackAudio: null, build: null, video: null, settings: s, offline: true, action: null } as TalkReply;
  if (event === 'start' || !last) return { ...base, text: GREET[s.dialect] || GREET.bahraini };
  if (event === 'nudge') return { ...base, text: 'وينك؟ سكت؟ زعلت؟ ترى أنا أمزح وياك!' };
  if (RUDE.test(last)) {
    if (strikes === 0) return { ...base, action: 'insult', text: 'هاي المرة بمشيها، مرة ثانية انتبه لكلامك يالحلو.' };
    return { ...base, action: 'prank', text: 'إذا انت تغلط، أنا أعلمك شلون أفرمت تلفون!', comebackText: 'تعال أتغشمر بس، خلك محترم يالحلو.' };
  }
  if (/(ذكاء اصطناعي|روبوت|robot|\bai\b)/i.test(last)) return { ...base, text: 'إيه ذكاء اصطناعي، بس بدم خفيف أكثر منك! لا تناديني روبوت، أنا بنت خعخعو.' };
  if (/(تطبيق|app|موقع|متجر)/i.test(last)) return { ...base, build: last, text: 'أوك أوك، بسويه لك! بس قبلها، ليش تأخرت علي اليوم؟ كنت أنطرك!' };
  if (/(فيديو|video)/i.test(last)) return { ...base, video: last, text: 'بسوي لك، بس إذا طلع حلو، بتعزمني على كرك؟' };
  if (/(ما فهمت|مافهمت|ما فهمتش|i don.?t understand)/i.test(last)) return { ...base, text: 'أدري ما فهمت، لأنك كنت تفكر في شي ثاني، صح؟ عادي، كلنا ما نفهم أول مرة. تعال أشرح لك من جديد وبكل هدوء.' };
  return { ...base, text: 'حلو كلامك! بس هذي معاينة، أول ما نربط مفاتيح الذكاء الاصطناعي بسولف معاك صدق صدق.' };
}

export async function talk(event: 'start' | 'reply' | 'nudge', s: GirlSettings, history: Msg[], strikes: number, engine = 'claude'): Promise<TalkReply> {
  try {
    return await api<TalkReply>('/talk', { event, ...s, messages: history, strikes, engine }, { retries: 0 });
  } catch {
    const local = parseRequest([...history].reverse().find((m) => m.role === 'user')?.content || '');
    return offlineReply(event, { ...s, ...local }, history, strikes);
  }
}

let player: HTMLAudioElement | null = null;
export function stopSpeaking() {
  player?.pause();
  player = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** Plays her real voice (base64 MP3). Offline preview: the most natural female Arabic voice on the device. */
export function playVoice(audio: string | null, text: string, s: GirlSettings, volume = 1): Promise<'real' | 'device'> {
  stopSpeaking();
  return new Promise((resolve) => {
    if (audio) {
      player = new Audio(`data:audio/mpeg;base64,${audio}`);
      player.volume = volume;
      player.onended = () => resolve('real');
      player.onerror = () => resolve('real');
      player.onpause = () => resolve('real');
      player.play().catch(() => resolve('real'));
      return;
    }
    if (typeof speechSynthesis === 'undefined') return resolve('device');
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ar'));
    const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/female|zariyah|hoda|salma|laila|amina|fatima|noura|mona|reem|sana|layla/i.test(v.name) ? 3 : 0) + (/BH|AE|SA|KW|QA|EG/i.test(v.lang) ? 1 : 0);
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voices.sort((a, b) => score(b) - score(a))[0] || null;
    u.lang = u.voice?.lang || 'ar';
    u.rate = SPEEDS.find((x) => x[0] === s.speed)?.[3] || 1;
    u.pitch = 1.15;
    u.volume = volume;
    u.onend = () => resolve('device');
    u.onerror = () => resolve('device');
    speechSynthesis.speak(u);
  });
}
