'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { RTL } from './brand';
import { api } from './api';

const STR: Record<string, Record<string, string>> = {
  en: {
    home: 'Home', builder: 'Builder', video: 'Video', settings: 'Settings', welcome: 'What do you want to build today?',
    hint: 'Write what you want… e.g. "I want an app for a clothes shop"', send: 'Send', buildThis: 'Build this app',
    q1: 'What is the shop / app name?', q2: 'Which colors do you like?', q3: 'What do you sell or offer?', next: 'Next', skip: 'Skip', back: 'Back',
    preview: 'Live preview', iLikeIt: 'I like it — Create App', consent: 'Before we create your app', terms: 'I accept the Terms of Service',
    privacy: 'I accept the Privacy Policy', payment: 'I accept the Payment terms', connect: 'Connect your app', whatsapp: 'WhatsApp number for orders',
    instagram: 'Instagram username', domain: 'Domain (optional, paid)', publish: 'Publish now', published: 'Your app is live!', copy: 'Copy', open: 'Open link',
    story: 'Write your story… we turn it into a full video', makeVideo: 'Make video', short: '30–60 sec', long: '1–3 min', storyboard: 'Storyboard',
    login: 'Sign in', google: 'Continue with Google', apple: 'Continue with Apple', facebook: 'Continue with Facebook', github: 'Continue with GitHub',
    phone: 'Phone number (with country code)', sendCode: 'Send code (SMS + WhatsApp + Email)', code: '6-digit code', verify: 'Verify', email: 'Email', password: 'Password',
    guest: 'Try without account', forgot: 'Forgot password? Smart recovery', plans: 'Plans', keys: 'My own API keys (BYOK)', integrations: 'Connections',
    save: 'Save', upgrade: 'Upgrade', free: 'Free', pro: 'Pro', ultra: 'Ultra', signOut: 'Sign out', colors: 'Colors', font: 'Font', sections: 'Sections', products: 'Products',
    addProduct: 'Add product', slow: 'Taking longer than usual…', useLocal: 'Use instant version', retry: 'Try again', newApp: 'New app', listen: 'Listen', translate: 'Translate',
  },
  ar: {
    home: 'الرئيسية', builder: 'المنشئ', video: 'فيديو', settings: 'الإعدادات', welcome: 'شنو تبي تسوي اليوم؟',
    hint: 'اكتب اللي تبيه… مثال: "أبي تطبيق لمحل ملابس"', send: 'إرسال', buildThis: 'ابنِ هذا التطبيق',
    q1: 'شنو اسم المحل / التطبيق؟', q2: 'شنو الألوان اللي تحبها؟', q3: 'شنو تبيع أو تقدم؟', next: 'التالي', skip: 'تخطي', back: 'رجوع',
    preview: 'معاينة مباشرة', iLikeIt: 'عجبني — أنشئ التطبيق', consent: 'قبل ما ننشئ تطبيقك', terms: 'أوافق على شروط الاستخدام',
    privacy: 'أوافق على سياسة الخصوصية', payment: 'أوافق على شروط الدفع', connect: 'اربط تطبيقك', whatsapp: 'رقم الواتساب للطلبات',
    instagram: 'اسم حساب انستغرام', domain: 'الدومين (اختياري، مدفوع)', publish: 'انشر الحين', published: 'تطبيقك صار شغال!', copy: 'نسخ', open: 'افتح الرابط',
    story: 'اكتب قصتك… ونحولها لفيديو كامل', makeVideo: 'سوّ الفيديو', short: '30–60 ثانية', long: '1–3 دقائق', storyboard: 'لوحة القصة',
    login: 'تسجيل الدخول', google: 'المتابعة مع Google', apple: 'المتابعة مع Apple', facebook: 'المتابعة مع Facebook', github: 'المتابعة مع GitHub',
    phone: 'رقم الهاتف (مع رمز الدولة)', sendCode: 'أرسل الرمز (SMS + واتساب + إيميل)', code: 'الرمز من 6 أرقام', verify: 'تحقق', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    guest: 'جرّب بدون حساب', forgot: 'نسيت كلمة المرور؟ استرجاع ذكي', plans: 'الباقات', keys: 'مفاتيحي الخاصة (BYOK)', integrations: 'الربط',
    save: 'حفظ', upgrade: 'ترقية', free: 'مجاني', pro: 'برو', ultra: 'ألترا', signOut: 'تسجيل الخروج', colors: 'الألوان', font: 'الخط', sections: 'الأقسام', products: 'المنتجات',
    addProduct: 'أضف منتج', slow: 'ياخذ وقت أكثر من العادة…', useLocal: 'استخدم النسخة الفورية', retry: 'حاول مرة ثانية', newApp: 'تطبيق جديد', listen: 'استمع', translate: 'ترجم',
  },
};

export function detectLang(text: string): string | null {
  const t = text.trim();
  if (t.length < 3) return null;
  if (/[پچژگ]/.test(t)) return 'fa';
  if (/[ٹڈڑںے]/.test(t)) return 'ur';
  if (/[؀-ۿ]/.test(t)) return 'ar';
  if (/[ऀ-ॿ]/.test(t)) return 'hi';
  if (/[ঀ-৿]/.test(t)) return 'bn';
  if (/[぀-ヿ]/.test(t)) return 'ja';
  if (/[一-鿿]/.test(t)) return 'zh';
  if (/[가-힯]/.test(t)) return 'ko';
  if (/[Ѐ-ӿ]/.test(t)) return 'ru';
  const l = t.toLowerCase();
  if (/\b(le|la|les|je|bonjour|merci|avec)\b/.test(l)) return 'fr';
  if (/\b(hola|gracias|quiero|para)\b/.test(l)) return 'es';
  if (/\b(und|ich|nicht|danke|hallo)\b/.test(l)) return 'de';
  if (/\b(merhaba|istiyorum|için)\b/.test(l)) return 'tr';
  return 'en';
}

const SWITCH: Record<string, string[]> = {
  ar: ['عربي', 'arabic'], en: ['انجليزي', 'إنجليزي', 'english'], fr: ['فرنسي', 'french', 'français'], es: ['اسباني', 'spanish', 'español'],
  de: ['الماني', 'ألماني', 'german'], tr: ['تركي', 'turkish'], hi: ['هندي', 'hindi'], ur: ['اوردو', 'urdu'], fa: ['فارسي', 'persian'], zh: ['صيني', 'chinese'], ru: ['روسي', 'russian'],
};

type Ctx = { lang: string; setLang: (l: string) => void; t: (k: string) => string; observe: (text: string) => void; rtl: boolean };
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => k, observe: () => {}, rtl: false });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState('en');
  const [dyn, setDyn] = useState<Record<string, string>>({});

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('lang'); } catch {}
    setLangState(saved || (navigator.language || 'en').slice(0, 2));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    try { localStorage.setItem('lang', lang); } catch {}
    if (!STR[lang]) {
      api<{ texts: Record<string, string> }>('/translate/batch', { target: lang, texts: STR.en }).then((r) => setDyn(r.texts)).catch(() => setDyn({}));
    }
  }, [lang]);

  const t = useCallback((k: string) => STR[lang]?.[k] || dyn[k] || STR.en[k] || k, [lang, dyn]);
  const observe = useCallback((text: string) => {
    const low = text.toLowerCase();
    if (/(تكلم|تحدث|اكتب|speak|talk|reply in|parle|habla)/.test(low)) {
      for (const [code, words] of Object.entries(SWITCH)) if (words.some((w) => low.includes(w))) return setLangState(code);
    }
    const d = detectLang(text);
    if (d && d !== lang && text.trim().length >= 6) setLangState(d);
  }, [lang]);

  return <LangCtx.Provider value={{ lang, setLang: setLangState, t, observe, rtl: RTL.includes(lang) }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
