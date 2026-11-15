import templatesJson from './templates.json';

// Same JSON design schema as the Flutter app (app/lib/models/app_design.dart)
// and the backend (functions/src/routes/builder.js).

export type Product = { id: string; name: string; price: number; category: string; emoji: string; image: string; description?: string };
export type Contact = { whatsapp: string; instagram: string; phone: string; address: string; email?: string };
export type Design = {
  id: string;
  name: string;
  type: string;
  tagline: string;
  colors: { primary: string; secondary: string; background: string; text: string };
  font: string;
  logoEmoji: string;
  heroImage: string;
  language: string;
  currency: string;
  sections: string[];
  categories: string[];
  products: Product[];
  contact: Contact;
  domain: string;
  status: 'draft' | 'live';
};

export const ALL_SECTIONS = ['hero', 'categories', 'products', 'offers', 'booking', 'reviews', 'map', 'contact', 'about'];

type Tpl = {
  type: string;
  emoji: string;
  title: { ar: string; en: string };
  keywords: string[];
  colors: [string, string, string];
  sections: string[];
  categories: { ar: string[]; en: string[] };
  products: [string, string, number, string, number][]; // ar, en, price, emoji, catIndex
};

// Generated from templates/<name>/template.json by `node templates/sync.js`.
export const TEMPLATES = templatesJson as unknown as Tpl[];

const COLOR_WORDS: Record<string, string> = {
  'أسود': '#111111', 'اسود': '#111111', black: '#111111', 'أبيض': '#FFFFFF', 'ابيض': '#FFFFFF', white: '#FFFFFF',
  'أحمر': '#DC2626', 'احمر': '#DC2626', red: '#DC2626', 'أزرق': '#2563EB', 'ازرق': '#2563EB', blue: '#2563EB', 'كحلي': '#1E3A8A', navy: '#1E3A8A',
  'أخضر': '#16A34A', 'اخضر': '#16A34A', green: '#16A34A', 'أصفر': '#EAB308', 'اصفر': '#EAB308', yellow: '#EAB308',
  'ذهبي': '#C9A227', gold: '#C9A227', 'وردي': '#EC4899', 'زهري': '#EC4899', pink: '#EC4899', 'بنفسجي': '#7C3AED', purple: '#7C3AED',
  'برتقالي': '#EA580C', orange: '#EA580C', 'بني': '#7C2D12', brown: '#7C2D12', 'رمادي': '#6B7280', gray: '#6B7280', grey: '#6B7280',
  'بيج': '#E7D7C1', beige: '#E7D7C1', 'فضي': '#C0C0C0', silver: '#C0C0C0', 'تركوازي': '#14B8A6', turquoise: '#14B8A6', teal: '#14B8A6',
};

export function extractColors(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const [w, h] of Object.entries(COLOR_WORDS)) if (t.includes(w) && !out.includes(h)) out.push(h);
  for (const m of text.match(/#[0-9a-fA-F]{6}/g) || []) if (!out.includes(m.toUpperCase())) out.push(m.toUpperCase());
  return out;
}

export function detectType(text: string): string {
  const t = text.toLowerCase();
  let best = TEMPLATES[0];
  let score = 0;
  for (const tpl of TEMPLATES) {
    const s = tpl.keywords.filter((k) => t.includes(k)).length;
    if (s > score) { best = tpl; score = s; }
  }
  return best.type;
}

export function looksLikeAppRequest(text: string) {
  const t = text.toLowerCase();
  return /(تطبيق|موقع|متجر|app|application|website|site|store|shop)/.test(t) && /(أبي|ابي|أبغى|ابغى|أريد|اريد|ودي|سوي|انشئ|أنشئ|want|need|build|make|create)/.test(t);
}

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
};

/** Instant local design (offline fallback, same logic as Flutter). */
export function localDesign(prompt: string, lang: string, name = '', colorsText = '', sell = ''): Design {
  const tpl = TEMPLATES.find((x) => x.type === detectType(`${prompt} ${sell}`)) || TEMPLATES[0];
  const l = lang === 'ar' ? 'ar' : 'en';
  let [primary, secondary, background] = tpl.colors;
  const cs = extractColors(`${colorsText} ${prompt}`);
  if (cs.length) {
    primary = cs[0];
    if (cs[1]) secondary = cs[1];
    if (primary === '#FFFFFF') { background = '#FFFFFF'; primary = cs[1] || '#111111'; secondary = cs[2] || tpl.colors[1]; }
  }
  const cats = tpl.categories[l];
  let products: Product[] = tpl.products.map((p, i) => ({ id: `p${i}`, name: l === 'ar' ? p[0] : p[1], price: p[2], emoji: p[3], category: cats[Math.min(p[4], cats.length - 1)], image: '' }));
  const items = sell.split(/[,،\n]|\s+و\s*|\s+and\s+/).map((s) => s.trim()).filter((s) => s && s.length < 40);
  if (items.length >= 2) products = items.map((n, i) => ({ id: `u${i}`, name: n, price: 5 + i * 2, emoji: tpl.emoji, category: cats[i % cats.length], image: '' }));
  const appName = name.trim() || tpl.title[l];
  return {
    id: String(Date.now()), name: appName, type: tpl.type,
    tagline: l === 'ar' ? `أهلاً بك في ${appName}` : `Welcome to ${appName}`,
    colors: { primary, secondary, background, text: isDark(background) ? '#FFFFFF' : '#111111' },
    font: l === 'ar' ? 'Cairo' : 'Inter', logoEmoji: tpl.emoji, heroImage: '', language: lang, currency: l === 'ar' ? 'BHD' : 'USD',
    sections: tpl.sections, categories: cats, products, contact: { whatsapp: '', instagram: '', phone: '', address: '' }, domain: '', status: 'draft',
  };
}
