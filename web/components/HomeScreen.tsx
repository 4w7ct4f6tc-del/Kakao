'use client';
// Home: the owner's exact design — soft #F5F5F4, round menu, KAkAo, black K, one rounded box at the bottom.
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import { useLang } from '@/lib/i18n';

const C = { bg: '#F5F5F4', top: '#EDE7E1', ink: '#141210', brand: '#8C6A5A', text: '#6E625B', hint: '#8E8680', box: '#FBFAF9', menu: '#EADFD6', menuLine: '#D9CBBF' };
const SERIF = "'Cormorant Garamond', 'Amiri', Georgia, serif";

export default function HomeScreen() {
  const { lang, setLang } = useLang();
  const ar = lang === 'ar';
  const router = useRouter();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [plus, setPlus] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const file = useRef<HTMLInputElement>(null);

  const go = (to: string) => { setMenu(false); setPlus(false); router.push(to); };
  const send = (v = text) => { const p = v.trim(); if (p) go(`/builder?prompt=${encodeURIComponent(p)}`); };

  // Hold the mic to talk: speech becomes text in the box, release sends it.
  function startTalk() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = ar ? 'ar-BH' : 'en-US';
    r.interimResults = true;
    let said = '';
    r.onresult = (e: any) => { said = Array.from(e.results).map((x: any) => x[0].transcript).join(' '); setText(said); };
    r.onend = () => { setListening(false); if (said.trim()) send(said); };
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  }
  const stopTalk = () => { try { rec.current?.stop(); } catch {} };

  const L = {
    name: ar ? 'خعخعو' : 'KAkAo',
    mark: ar ? 'خ' : 'K',
    l1: ar ? 'شنو فكرتك؟' : 'What is your idea?',
    l2: ar ? 'اكتبها، وأنا أبنيها لك.' : 'Write it, I will build it for you.',
    ph: listening ? (ar ? 'أسمعك…' : 'Listening…') : ar ? 'اكتب أو اضغط مطولاً للكلام' : 'Type or hold to talk',
  };
  const MENU: [IconName, string, string][] = [
    ['sparkles', ar ? 'المصنع' : 'Builder', '/builder'],
    ['film', ar ? 'الفيديو' : 'Video', '/video'],
    ['chat', ar ? 'المحادثة' : 'Talk', '/talk'],
    ['clipboard', ar ? 'القوالب' : 'Templates', '/templates'],
    ['gear', ar ? 'الإعدادات' : 'Settings', '/settings'],
    ['user', ar ? 'تسجيل الدخول' : 'Log in', '/login'],
  ];
  const PLUS: [IconName, string, () => void][] = [
    ['camera', ar ? 'الكاميرا' : 'Camera', () => file.current?.click()],
    ['clipboard', ar ? 'القوالب' : 'Templates', () => go('/templates')],
    ['film', ar ? 'قصة إلى فيديو' : 'Story to video', () => go('/video')],
  ];

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ background: C.bg, color: C.ink, minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: ar ? 'Cairo, Inter, sans-serif' : 'Inter, sans-serif' }}>
      {/* Top */}
      <header style={{ background: C.top, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px', position: 'sticky', top: 0, zIndex: 20 }}>
        <button aria-label={ar ? 'القائمة' : 'Menu'} onClick={() => setMenu(true)} style={{ width: 52, height: 52, borderRadius: 999, background: C.menu, border: `1px solid ${C.menuLine}`, boxShadow: '0 2px 6px rgba(80,60,40,.12)', display: 'grid', placeItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 500, lineHeight: 1 }}>{L.name}</span>
        <button aria-label={ar ? 'الحساب' : 'Account'} onClick={() => go('/settings')} style={{ width: 52, height: 52, borderRadius: 999, background: C.ink, color: '#fff', fontFamily: SERIF, fontSize: ar ? 26 : 30, display: 'grid', placeItems: 'center', lineHeight: 1 }}><span style={{ transform: ar ? 'translateY(-14%)' : 'none' }}>{L.mark}</span></button>
      </header>

      {/* Center */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 16px 140px' }}>
        <div style={{ width: 128, height: 128, borderRadius: 999, background: C.ink, color: '#F5F5F4', fontFamily: SERIF, fontSize: ar ? 70 : 82, display: 'grid', placeItems: 'center', lineHeight: 1 }}><span style={{ transform: ar ? 'translateY(-14%)' : 'none' }}>{L.mark}</span></div>
        <h1 style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 500, lineHeight: 1.05, marginTop: 22 }}>{L.name}</h1>
        <p style={{ color: C.brand, fontSize: 19, marginTop: 10 }}>B.K.A Famy</p>
        <p style={{ color: C.text, fontSize: 14, marginTop: 20, lineHeight: 1.65 }}>{L.l1}<br />{L.l2}</p>
      </main>

      {/* Bottom: one rounded box */}
      <div style={{ position: 'fixed', insetInline: 0, bottom: 0, padding: '0 16px max(20px, env(safe-area-inset-bottom))', zIndex: 20 }}>
        {plus && (
          <div style={{ maxWidth: 520, margin: '0 auto 10px', background: C.box, borderRadius: 22, padding: 8, boxShadow: '0 8px 24px rgba(60,40,20,.12)' }}>
            {PLUS.map(([ic, label, fn]) => (
              <button key={label} onClick={fn} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 14, color: C.ink, fontSize: 15 }}><Icon name={ic} size={20} />{label}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, background: C.box, borderRadius: 999, padding: '8px 8px', paddingInlineStart: 10, boxShadow: '0 10px 30px rgba(60,40,20,.12), 0 1px 0 rgba(255,255,255,.8) inset' }}>
          <button type="button" aria-label={ar ? 'إضافة' : 'Add'} onClick={() => setPlus((v) => !v)} style={{ width: 40, height: 40, borderRadius: 999, display: 'grid', placeItems: 'center', color: C.hint, flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ transform: plus ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}><path d="M12 4v16M4 12h16" /></svg>
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L.ph} aria-label={L.ph} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 16, color: C.ink }} className="placeholder:text-[#8E8680]" />
          <button type="button" aria-label={ar ? 'اضغط مطولاً للكلام' : 'Hold to talk'} onPointerDown={startTalk} onPointerUp={stopTalk} onPointerLeave={() => listening && stopTalk()} style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: listening ? '#B4513A' : '#5E5650', flexShrink: 0, touchAction: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></svg>
          </button>
          <button type={text.trim() ? 'submit' : 'button'} aria-label={text.trim() ? (ar ? 'ابنِ' : 'Build') : ar ? 'محادثة صوتية' : 'Voice chat'} onClick={() => { if (!text.trim()) go('/talk'); }} style={{ width: 54, height: 54, borderRadius: 999, background: C.ink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"><path d="M4 12v4M7 10v8M10 7v14M13 11v6M16 5v18M19 9v10M22 11v6M25 13v2" /></svg>
          </button>
        </form>
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={() => go('/builder?prompt=' + encodeURIComponent(ar ? 'تطبيق من الصورة' : 'App from my photo'))} />
      </div>

      {/* Menu */}
      {menu && (
        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.28)', zIndex: 40 }}>
          <nav onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, width: 'min(300px, 82vw)', background: C.bg, padding: '22px 16px', boxShadow: '0 0 30px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: SERIF, fontSize: 30, padding: '0 10px 14px' }}>{L.name}</span>
            {MENU.map(([ic, label, to]) => (
              <button key={to} onClick={() => go(to)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 10px', borderRadius: 14, fontSize: 16, color: C.ink, textAlign: 'start' }}><Icon name={ic} size={21} />{label}</button>
            ))}
            <div style={{ marginTop: 'auto', display: 'flex', gap: 8, padding: 10 }}>
              {[['ar', 'عربي'], ['en', 'English']].map(([code, label]) => (
                <button key={code} onClick={() => setLang(code)} style={{ flex: 1, padding: '10px 0', borderRadius: 999, border: `1px solid ${C.menuLine}`, background: lang === code ? C.ink : 'transparent', color: lang === code ? '#fff' : C.ink, fontSize: 14 }}>{label}</button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
