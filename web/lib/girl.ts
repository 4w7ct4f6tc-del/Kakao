'use client';
import { api } from './api';

/** Same lists as functions/persona.js. */
export const DIALECTS: [string, string, string][] = [
  ['bahraini_riffa', 'بحريني رفاعي', 'Bahraini Riffa'], ['bahraini', 'بحريني', 'Bahraini'], ['saudi_najdi', 'سعودي نجدي', 'Saudi Najdi'], ['saudi_hijazi', 'سعودي حجازي', 'Saudi Hijazi'],
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

export type GirlSettings = { dialect: string; style: string; mode: string; speed: string; lisp?: boolean };
export const DEFAULT_GIRL: GirlSettings = { dialect: 'bahraini_riffa', style: 'friendly', mode: 'chat', speed: 'normal', lisp: true };
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
  saudi_hijazi: ['حجازي', 'جدة'], bahraini_riffa: ['رفاعي', 'الرفاع'], bahraini: ['بحريني', 'البحرين'], saudi_najdi: ['نجدي', 'سعودي'], emirati: ['إماراتي', 'اماراتي'],
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
  bahraini_riffa: 'هلا هلا! أنا هني، شنو عندك اليوم؟ قول بسرعة قبل لا أمل.',
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

// ================================================================ نقاش ثلاثي: AI 1 + دانو
export type Role = 'user' | 'ai1' | 'danu';
export type DMsg = { role: Role; content: string };
export type DanuReply = TalkReply & { family?: boolean; hangup?: boolean; summary?: string | null };
export type DiscussReply = { ai1: { text: string } | null; danu: DanuReply | null; settings: GirlSettings; offline?: boolean };
export type DiscussState = { strikes: number; familyAsks: number; loud: boolean; turns: number };

const FAMILY = /(أمج|امج|أمك|امك|أبوج|ابوج|أبوك|ابوك|أهلج|اهلج|طلاق|تطلقوا|ليش تطلق|والدتج|والدج)/;
const SILLY = /^(كم 1\+1|1\+1|هلا|السلام عليكم)\??$/;

function offlineDanu(event: string, history: DMsg[], st: DiscussState, s: GirlSettings): DanuReply {
  const last = [...history].reverse().find((m) => m.role === 'user')?.content || '';
  const base: DanuReply = { text: '', audio: null, action: null, comebackText: null, comebackAudio: null, build: null, video: null, settings: s, offline: true };
  if (event === 'join') return { ...base, text: 'هلا هلا! منو متصل؟ أنا دانو من الرفاع. شفت فكرتكم… خلوني أصلحها لكم، صيدني يالحلو.' };
  if (event === 'nudge') return { ...base, text: 'وينك؟ سكت؟ زعلت؟ ترى أنا أمزح وياك!' };
  if (RUDE.test(last)) {
    if (st.strikes === 0) return { ...base, action: 'insult', text: 'هاي المرة بمشيها، مرة ثانية لا تقولي ذكاء اصطناعي.' };
    return { ...base, action: 'prank', text: 'إذا انت تغلط، أنا أعلمك شلون أفرمت تلفون!', comebackText: 'تعال أتغشمر بس، خلك محترم يالحلو.' };
  }
  if (FAMILY.test(last)) {
    if (st.familyAsks === 0) return { ...base, family: true, text: 'أتفشل أقول، بس باختصار أمي صادت أبوي مع الخدامة. خلنا في فكرتك أحسن.' };
    if (st.familyAsks === 1) return { ...base, family: true, text: 'بمشي.' };
    return { ...base, hangup: true, text: 'قلت لك بمشي، باي.', summary: 'اتفقنا نكمل فكرتك بعدين، والموضوع هذا مسكر.' };
  }
  if (/وين حرف الراء/.test(last)) return { ...base, text: 'عصوم شاله يبي يعاقبني، قالي بوجعه إذا جفت شاطرة.' };
  if (/وين في الرفاع/.test(last)) return { ...base, text: 'تبي أعطيك رقم أبوي بعد؟ ركز في اللي انت فيه، أي هاي اللي ناقص بعد.' };
  if (/وين بيتج|وين ساكنة|وين تسكنين/.test(last)) return { ...base, text: 'مالت الرفاع.' };
  if (/^\s*(لا|لاء)\s*$/.test(last) && history.some((m) => m.role === 'danu' && m.content.includes('وين بيتنا'))) {
    return { ...base, text: 'أي الحين صرت شطور، تعلمت من الدرس حبيبي، كل يوم تعال خذلك درس لين تتعلم إني رفاعية مالعب، بس فعل.' };
  }
  if (SILLY.test(last.trim())) return { ...base, text: 'مقعدني من الرقاد عشان هاي السؤال؟ هلون يعني، خلنا في شي يستاهل.' };
  if (/(ما فهمت|مافهمت)/.test(last)) return { ...base, text: 'عادي، كلنا ما نفهم أول مرة. تعال أخفف عليك الموضوع، أنا معاك، أنا أحتويك.' };
  if (st.loud) return { ...base, text: 'هي هي، تكلم بالعدال! … أي هالون شاطر، كمل كمل.' };
  if (st.turns >= 3 && st.turns % 4 === 3) return { ...base, text: 'مللتوني، أنا سلي خلاني أتعرف على إنسان وذكاء اصطناعي، معلوماتكم قديمة.' };
  if (st.turns === 2) return { ...base, text: 'المساعد قال كلام حلو، بس أنا عندي أذكى منه: خله بسيط وبسرعة. تعال صج تبي أقولك وين بيتنا؟' };
  return { ...base, text: 'فكرة حلوة، بس عدلها شوي: ابدأ بشي صغير وجربه، وبعدين كبّره. ضبطني أضبطك!' };
}

function offlineAi1(history: DMsg[]): string {
  const last = [...history].reverse().find((m) => m.role === 'user')?.content || '';
  return `فهمت فكرتك: "${last.slice(0, 60)}". الفكرة زينة، وأقترح نبدأ بأبسط نسخة منها ونجربها بسرعة.\nاقتراح مني: نسوي معاينة في المصنع خلال دقيقة.\nاقتراح منك: شنو أهم شي تبيه يكون فيها؟`;
}

export async function discuss(event: 'reply' | 'join' | 'nudge', call: boolean, s: GirlSettings, history: DMsg[], st: DiscussState, engine = 'claude'): Promise<DiscussReply> {
  try {
    return await api<DiscussReply>('/discuss', { event, call, ...s, messages: history, ...st, engine }, { retries: 0 });
  } catch {
    const ai1 = event === 'reply' ? { text: offlineAi1(history) } : null;
    const withAi1: DMsg[] = ai1 ? [...history, { role: 'ai1', content: ai1.text }] : history;
    return { ai1, danu: call ? offlineDanu(event, withAi1, st, s) : null, settings: s, offline: true };
  }
}
