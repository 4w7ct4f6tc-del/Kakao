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

export const TEMPLATES: Tpl[] = [
  { type: 'clothes', emoji: '👗', title: { ar: 'محل ملابس', en: 'Clothes Shop' }, keywords: ['ملابس', 'أزياء', 'ازياء', 'فساتين', 'عبايات', 'clothes', 'fashion', 'boutique', 'dress', 'abaya', 'بوتيك'], colors: ['#111111', '#E11D48', '#FFFFFF'], sections: ['hero', 'categories', 'products', 'offers', 'reviews', 'map', 'contact'], categories: { ar: ['نسائي', 'رجالي', 'أطفال', 'عبايات'], en: ['Women', 'Men', 'Kids', 'Abayas'] }, products: [['فستان سهرة', 'Evening Dress', 35, '👗', 0], ['عباية سوداء', 'Black Abaya', 28, '🧥', 3], ['قميص رجالي', "Men's Shirt", 12, '👔', 1], ['تيشيرت أطفال', 'Kids T-Shirt', 6, '👕', 2], ['حذاء رياضي', 'Sneakers', 22, '👟', 1], ['شنطة يد', 'Handbag', 18, '👜', 0]] },
  { type: 'restaurant', emoji: '🍔', title: { ar: 'مطعم', en: 'Restaurant' }, keywords: ['مطعم', 'منيو', 'أكل', 'اكل', 'كافيه', 'مقهى', 'قهوة', 'restaurant', 'menu', 'food', 'cafe', 'coffee', 'burger', 'pizza'], colors: ['#7C2D12', '#F59E0B', '#FFFBEB'], sections: ['hero', 'categories', 'products', 'offers', 'booking', 'reviews', 'map', 'contact'], categories: { ar: ['مقبلات', 'رئيسي', 'حلويات', 'مشروبات'], en: ['Starters', 'Mains', 'Desserts', 'Drinks'] }, products: [['برجر لحم', 'Beef Burger', 3.5, '🍔', 1], ['بيتزا', 'Pizza', 4.2, '🍕', 1], ['سلطة', 'Salad', 1.8, '🥗', 0], ['كنافة', 'Kunafa', 2, '🍰', 2], ['كرك', 'Karak Tea', 0.3, '☕', 3], ['عصير طازج', 'Fresh Juice', 1.2, '🥤', 3]] },
  { type: 'grocery', emoji: '🛒', title: { ar: 'بقالة', en: 'Grocery' }, keywords: ['بقالة', 'سوبرماركت', 'خضار', 'فواكه', 'grocery', 'supermarket', 'market'], colors: ['#166534', '#84CC16', '#F7FEE7'], sections: ['hero', 'categories', 'products', 'offers', 'map', 'contact'], categories: { ar: ['خضار', 'فواكه', 'ألبان', 'مخبوزات'], en: ['Vegetables', 'Fruits', 'Dairy', 'Bakery'] }, products: [['طماط', 'Tomatoes', 0.6, '🍅', 0], ['تفاح', 'Apples', 0.9, '🍎', 1], ['حليب', 'Milk', 0.5, '🥛', 2], ['خبز', 'Bread', 0.2, '🍞', 3]] },
  { type: 'salon', emoji: '💇', title: { ar: 'صالون', en: 'Salon' }, keywords: ['صالون', 'حلاق', 'تجميل', 'سبا', 'salon', 'barber', 'beauty', 'spa', 'nails'], colors: ['#831843', '#F472B6', '#FDF2F8'], sections: ['hero', 'products', 'booking', 'reviews', 'map', 'contact'], categories: { ar: ['شعر', 'أظافر', 'مكياج'], en: ['Hair', 'Nails', 'Makeup'] }, products: [['قص شعر', 'Haircut', 5, '💇', 0], ['صبغة', 'Hair Color', 20, '🎨', 0], ['مناكير', 'Manicure', 8, '💅', 1], ['مكياج سهرة', 'Evening Makeup', 25, '💄', 2]] },
  { type: 'school', emoji: '🏫', title: { ar: 'مدرسة / معهد', en: 'School' }, keywords: ['مدرسة', 'معهد', 'دورات', 'تعليم', 'school', 'academy', 'courses', 'tutor'], colors: ['#1E3A8A', '#FBBF24', '#EFF6FF'], sections: ['hero', 'categories', 'products', 'booking', 'reviews', 'contact', 'about'], categories: { ar: ['لغات', 'برمجة', 'رياضيات'], en: ['Languages', 'Coding', 'Math'] }, products: [['دورة إنجليزي', 'English Course', 45, '📘', 0], ['دورة برمجة', 'Coding Course', 60, '💻', 1], ['تقوية رياضيات', 'Math Tutoring', 30, '📐', 2]] },
  { type: 'gym', emoji: '🏋️', title: { ar: 'نادي رياضي', en: 'Gym' }, keywords: ['جيم', 'نادي', 'رياضة', 'لياقة', 'gym', 'fitness', 'yoga'], colors: ['#0F172A', '#22C55E', '#F8FAFC'], sections: ['hero', 'products', 'booking', 'reviews', 'map', 'contact'], categories: { ar: ['اشتراكات', 'تدريب شخصي', 'مكملات'], en: ['Memberships', 'Personal training', 'Supplements'] }, products: [['اشتراك شهري', 'Monthly Pass', 25, '🎟️', 0], ['مدرب شخصي', 'Personal Trainer', 15, '🏋️', 1], ['بروتين', 'Protein', 18, '🥤', 2]] },
  { type: 'realestate', emoji: '🏠', title: { ar: 'عقارات', en: 'Real Estate' }, keywords: ['عقار', 'عقارات', 'شقق', 'فلل', 'real estate', 'apartment', 'villa', 'property'], colors: ['#1F2937', '#0EA5E9', '#F9FAFB'], sections: ['hero', 'categories', 'products', 'booking', 'map', 'contact'], categories: { ar: ['للبيع', 'للإيجار', 'تجاري'], en: ['For sale', 'For rent', 'Commercial'] }, products: [['شقة غرفتين', '2BR Apartment', 350, '🏢', 1], ['فيلا', 'Villa', 180000, '🏡', 0], ['محل تجاري', 'Shop Space', 600, '🏬', 2]] },
  { type: 'booking', emoji: '📅', title: { ar: 'حجوزات / عيادة', en: 'Booking / Clinic' }, keywords: ['حجز', 'عيادة', 'موعد', 'دكتور', 'booking', 'clinic', 'appointment', 'doctor', 'dentist'], colors: ['#0E7490', '#06B6D4', '#ECFEFF'], sections: ['hero', 'products', 'booking', 'reviews', 'map', 'contact'], categories: { ar: ['استشارة', 'فحص', 'متابعة'], en: ['Consultation', 'Checkup', 'Follow-up'] }, products: [['استشارة', 'Consultation', 15, '🩺', 0], ['فحص شامل', 'Full Checkup', 40, '🧪', 1], ['تنظيف أسنان', 'Teeth Cleaning', 20, '🦷', 1]] },
  { type: 'portfolio', emoji: '🎨', title: { ar: 'معرض أعمال', en: 'Portfolio' }, keywords: ['معرض', 'أعمالي', 'مصور', 'مصمم', 'portfolio', 'photographer', 'designer', 'freelancer'], colors: ['#18181B', '#A855F7', '#FAFAFA'], sections: ['hero', 'products', 'reviews', 'contact', 'about'], categories: { ar: ['تصوير', 'تصميم', 'فيديو'], en: ['Photography', 'Design', 'Video'] }, products: [['جلسة تصوير', 'Photo Session', 50, '📸', 0], ['تصميم شعار', 'Logo Design', 40, '✏️', 1], ['مونتاج فيديو', 'Video Editing', 70, '🎬', 2]] },
  { type: 'chat', emoji: '💬', title: { ar: 'تطبيق دردشة', en: 'Chat App' }, keywords: ['دردشة', 'شات', 'محادثة', 'chat', 'messenger', 'community'], colors: ['#111827', '#16A34A', '#F3F4F6'], sections: ['hero', 'products', 'contact', 'about'], categories: { ar: ['عام', 'مجموعات'], en: ['General', 'Groups'] }, products: [['غرفة عامة', 'Public Room', 0, '💬', 0], ['مجموعة خاصة', 'Private Group', 1, '🔒', 1]] },
];

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
