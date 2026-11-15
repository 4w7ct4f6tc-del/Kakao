'use client';
// Shared pieces of the owner's design: top bar (menu · KAkAo · K) and the one rounded bottom box.
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import { useLang } from '@/lib/i18n';

// Page-level colors follow the appearance (light default / dark); colors inside cards and boxes stay fixed.
export const KC = { bg: 'var(--bg)', page: 'var(--text)', top: 'var(--k-top)', brand: 'var(--k-brand)', text: 'var(--muted)', menu: 'var(--k-menu)', menuLine: 'var(--k-menu-line)', ink: '#141210', hint: '#8E8680', box: '#FBFAF9', grey: '#EBEAE8' };
export const SERIF = "'Cormorant Garamond', 'Amiri', Georgia, serif";

export function useBrand() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  return { ar, name: ar ? 'خعخعو' : 'KAkAo', mark: ar ? 'خ' : 'K' };
}

/** Black circle with K (or خ in Arabic). */
export function Mark({ size, font }: { size: number; font: number }) {
  const { ar, mark } = useBrand();
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: 'var(--k-mark-bg)', color: 'var(--k-mark-fg)', fontFamily: SERIF, fontSize: ar ? font * 0.86 : font, display: 'grid', placeItems: 'center', lineHeight: 1, flexShrink: 0 }}>
      <span style={{ transform: ar ? 'translateY(-14%)' : 'none' }}>{mark}</span>
    </span>
  );
}

export function KTop({ band = true }: { band?: boolean }) {
  const { lang, setLang } = useLang();
  const { ar, name } = useBrand();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const go = (to: string) => { setMenu(false); router.push(to); };
  const MENU: [IconName, string, string][] = [
    ['home', ar ? 'الرئيسية' : 'Home', '/'],
    ['sparkles', ar ? 'المصنع' : 'Builder', '/builder'],
    ['film', ar ? 'الفيديو' : 'Video', '/video'],
    ['chat', ar ? 'المحادثة' : 'Talk', '/talk'],
    ['clipboard', ar ? 'القوالب' : 'Templates', '/templates'],
    ['gear', ar ? 'الإعدادات' : 'Settings', '/settings'],
    ['user', ar ? 'تسجيل الدخول' : 'Log in', '/login'],
  ];
  return (
    <>
      <header style={{ background: band ? KC.top : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px', position: 'sticky', top: 0, zIndex: 20, backdropFilter: band ? undefined : 'blur(8px)' }}>
        <button aria-label={ar ? 'القائمة' : 'Menu'} onClick={() => setMenu(true)} style={{ width: 52, height: 52, borderRadius: 999, background: KC.menu, border: `1px solid ${KC.menuLine}`, boxShadow: '0 2px 6px rgba(80,60,40,.12)', display: 'grid', placeItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={KC.page} strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 500, lineHeight: 1, color: KC.page }}>{name}</span>
        <button aria-label={ar ? 'الحساب' : 'Account'} onClick={() => go('/settings')}><Mark size={52} font={30} /></button>
      </header>
      {menu && (
        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,16,.28)', zIndex: 40 }}>
          <nav onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, width: 'min(300px, 82vw)', background: KC.bg, padding: '22px 16px', boxShadow: '0 0 30px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', gap: 4, color: KC.page }}>
            <span style={{ fontFamily: SERIF, fontSize: 30, padding: '0 10px 14px' }}>{name}</span>
            {MENU.map(([ic, label, to]) => (
              <button key={to} onClick={() => go(to)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 10px', borderRadius: 14, fontSize: 16, textAlign: 'start' }}><Icon name={ic} size={21} />{label}</button>
            ))}
            <div style={{ marginTop: 'auto', display: 'flex', gap: 8, padding: 10 }}>
              {[['ar', 'عربي'], ['en', 'English']].map(([code, label]) => (
                <button key={code} onClick={() => setLang(code)} style={{ flex: 1, padding: '10px 0', borderRadius: 999, border: `1px solid ${KC.menuLine}`, background: lang === code ? 'var(--k-mark-bg)' : 'transparent', color: lang === code ? 'var(--k-mark-fg)' : KC.page, fontSize: 14 }}>{label}</button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

/**
 * The one rounded box: + · "Type or hold to talk" · mic, and a black round button.
 * home: waveform button inside the box. build: speaker button outside, grey box.
 */
export function KBox({ variant, onSend, onVoice, plus }: { variant: 'home' | 'build'; onSend: (text: string) => void; onVoice: () => void; plus: [IconName, string, () => void][] }) {
  const { ar } = useBrand();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const send = (v = text) => { const p = v.trim(); if (p) { onSend(p); setText(''); } };

  // Hold the mic to talk: speech fills the box, releasing sends it.
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
  const ph = listening ? (ar ? 'أسمعك…' : 'Listening…') : ar ? 'اكتب أو اضغط مطولاً للكلام' : 'Type or hold to talk';
  const home = variant === 'home';

  const black = (
    <button type={home && text.trim() ? 'submit' : 'button'} aria-label={home ? (ar ? 'محادثة صوتية' : 'Voice chat') : ar ? 'صوت' : 'Voice'} onClick={() => { if (!(home && text.trim())) onVoice(); }} style={{ width: 54, height: 54, borderRadius: 999, background: home ? KC.ink : 'var(--k-mark-bg)', color: home ? '#fff' : 'var(--k-mark-fg)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: home ? undefined : '0 6px 16px rgba(0,0,0,.18)' }}>
      {home ? (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"><path d="M4 12v4M7 10v8M10 7v14M13 11v6M16 5v18M19 9v10M22 11v6M25 13v2" /></svg>
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: ar ? 'scaleX(-1)' : undefined }}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" /></svg>
      )}
    </button>
  );

  return (
    <div style={{ position: 'fixed', insetInline: 0, bottom: 0, padding: '12px 16px max(20px, env(safe-area-inset-bottom))', zIndex: 20, background: home ? 'transparent' : `linear-gradient(to top, ${KC.bg} 70%, transparent)` }}>
      {open && (
        <div style={{ maxWidth: 520, margin: '0 auto 10px', background: KC.box, borderRadius: 22, padding: 8, boxShadow: '0 8px 24px rgba(60,40,20,.12)', color: KC.ink }}>
          {plus.map(([ic, label, fn]) => (
            <button key={label} onClick={() => { setOpen(false); fn(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 14, fontSize: 15 }}><Icon name={ic} size={20} />{label}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: home ? KC.box : KC.grey, borderRadius: 999, padding: home ? 8 : 6, paddingInlineStart: home ? 10 : 6, boxShadow: home ? '0 10px 30px rgba(60,40,20,.12), 0 1px 0 rgba(255,255,255,.8) inset' : 'inset 0 1px 2px rgba(0,0,0,.05)' }}>
          <button type="button" aria-label={ar ? 'إضافة' : 'Add'} onClick={() => setOpen((v) => !v)} style={{ width: home ? 40 : 38, height: home ? 40 : 38, borderRadius: 999, display: 'grid', placeItems: 'center', color: home ? KC.hint : KC.ink, flexShrink: 0, background: home ? 'transparent' : '#E2E1DF', border: home ? 0 : '1.5px solid #9A9894' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={home ? 1.6 : 1.9} strokeLinecap="round" style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }}><path d="M12 4v16M4 12h16" /></svg>
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ph} aria-label={ar ? 'اكتب أو اضغط مطولاً للكلام' : 'Type or hold to talk'} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', fontSize: 16, color: KC.ink }} className="placeholder:text-[#8E8680]" />
          <button type="button" aria-label={ar ? 'اضغط مطولاً للكلام' : 'Hold to talk'} onPointerDown={startTalk} onPointerUp={stopTalk} onPointerLeave={() => listening && stopTalk()} style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', color: listening ? '#B4513A' : home ? '#5E5650' : '#8E8C88', flexShrink: 0, touchAction: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></svg>
          </button>
          {home && black}
        </div>
        {!home && black}
      </form>
    </div>
  );
}

export function KPage({ children }: { children: ReactNode }) {
  const { ar } = useBrand();
  return <div dir={ar ? 'rtl' : 'ltr'} style={{ background: KC.bg, color: KC.page, minHeight: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: ar ? 'Cairo, Inter, sans-serif' : 'Inter, sans-serif' }}>{children}</div>;
}

/** Inner pages (Video, Settings, Login, Talk…): same top bar and soft page, an optional title with back. */
export function KShell({ children, title, onBack }: { children: ReactNode; title?: string; onBack?: () => void }) {
  const { ar } = useBrand();
  const router = useRouter();
  return (
    <KPage>
      <KTop band={false} />
      <main className="mx-auto w-full max-w-[460px] px-4 pb-12">
        {title && (
          <div className="mb-1 mt-1 flex items-center gap-2">
            <button aria-label={ar ? 'رجوع' : 'Back'} onClick={onBack || (() => router.push('/'))} className="grid h-10 w-10 place-items-center rounded-full" style={{ color: KC.page }}>
              <Icon name="back" size={22} className={ar ? 'rotate-180' : ''} />
            </button>
            <h1 className="text-[22px] font-semibold" style={{ color: KC.page }}>{title}</h1>
          </div>
        )}
        {children}
      </main>
    </KPage>
  );
}
