'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand } from '@/lib/brand';
import { useLang } from '@/lib/i18n';
import Icon, { type IconName } from './Icon';

/*
 * KAKAO design — colors come from the appearance tokens in globals.css:
 *  light (default): white page, soft-blue K tile, serif wordmark, icon tabs, outlined buttons;
 *  dark: the first design (#0F0F0F, white cards, black buttons, green approve).
 */

export function Logo({ size = 44 }: { size?: number }) {
  const { lang } = useLang();
  return (
    <div className="inline-flex shrink-0 items-center justify-center rounded-[12px] font-light text-white" style={{ width: size, height: size, fontSize: size * 0.5, background: 'var(--tile)' }}>
      {Brand.letter(lang)}
    </div>
  );
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="text-[15px]" style={{ color: 'var(--muted)' }} aria-label="Language">
      <span style={lang === 'ar' ? { color: 'var(--text)' } : undefined}>عربي</span>
      <span className="mx-2 opacity-50">|</span>
      <span style={lang !== 'ar' ? { color: 'var(--text)' } : undefined}>English</span>
    </button>
  );
}

/** Language switch on top, then logo tile + serif name + "B.K.A Famy". */
export function Header() {
  const { lang } = useLang();
  return (
    <header className="pt-4">
      <div className="flex justify-end"><LangToggle /></div>
      <div className="mt-8 flex items-center gap-4">
        <Logo size={56} />
        <div className="leading-tight">
          <div className="k-wordmark text-[38px]" style={{ color: 'var(--text)' }}>{Brand.name(lang)}</div>
          <div className="mt-1 text-[15px] tracking-[0.06em]" style={{ color: 'var(--muted)' }}>{Brand.company}</div>
        </div>
      </div>
    </header>
  );
}

/** 4 icon tabs: Login / Builder / Video / Settings. */
export function Tabs() {
  const { t } = useLang();
  const path = usePathname();
  const items: [string, IconName, string][] = [
    ['/login', 'user', t('tabLogin')],
    ['/builder', 'sparkles', t('tabBuilder')],
    ['/video', 'videoBox', t('tabVideo')],
    ['/settings', 'gear', t('tabSettings')],
  ];
  const active = path === '/' ? '/builder' : path;
  return (
    <nav className="mt-8 grid grid-cols-4 gap-2">
      {items.map(([href, icon, label]) => {
        const on = active === href;
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-[18px] py-3 text-[15px] font-semibold transition" style={{ background: on ? 'var(--tab-on-bg)' : 'var(--tab-off-bg)', color: on ? 'var(--tab-on-fg)' : 'var(--tab-off-fg)' }}>
            <Icon name={icon} size={26} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Footer() {
  const { lang } = useLang();
  return <p className="py-8 text-center text-[13px]" style={{ color: 'var(--muted)' }}>{Brand.footer(lang)}</p>;
}

/** Section label, e.g. "SELECT AI MODEL". */
export function Label({ children }: { children: ReactNode }) {
  return <p className="k-label mb-4 mt-8 text-center">{children}</p>;
}

/** A content block: flat in light, white 22px card in dark. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mt-4 rounded-[22px] ${className}`} style={{ background: 'var(--card)', color: 'var(--card-fg)', padding: 'var(--card-pad)' }}>{children}</section>;
}

type Variant = 'black' | 'green' | 'grey';
// black = main action (soft blue in light), green = final approve, grey = secondary (outlined in light)
const V: Record<Variant, React.CSSProperties> = {
  black: { background: 'var(--primary-bg)', color: 'var(--primary-fg)', borderColor: 'var(--primary-bg)' },
  green: { background: 'var(--strong-bg)', color: 'var(--strong-fg)', borderColor: 'var(--strong-bg)' },
  grey: { background: 'var(--outline-bg)', color: 'var(--outline-fg)', borderColor: 'var(--outline-border)' },
};

export function Btn({ children, onClick, v = 'black', disabled, className = '', icon, wide = true, accentText = false }: { children: ReactNode; onClick?: () => void; v?: Variant; disabled?: boolean; className?: string; icon?: IconName; wide?: boolean; accentText?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={accentText ? { ...V[v], color: 'var(--primary-fg)' } : V[v]}
      className={`mt-2.5 flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border px-5 text-[17px] font-semibold transition active:scale-[0.99] disabled:opacity-40 ${wide ? 'w-full' : 'mx-auto w-fit'} ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/** Kept for older pages. */
export const Button = ({ children, onClick, accent, disabled }: { children: ReactNode; onClick?: () => void; accent?: boolean; disabled?: boolean }) => (
  <Btn v={accent ? 'green' : 'black'} onClick={onClick} disabled={disabled}>{children}</Btn>
);

/** Outlined pill (AI models, dialects, types…). Selected = soft blue. */
export function Pill({ on, onClick, children, icon, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; icon?: IconName; className?: string }) {
  return <button onClick={onClick} className={`k-pill ${on ? 'k-pill-on' : ''} ${className}`}>{icon && <Icon name={icon} size={18} />}{children}</button>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`mt-2.5 w-full rounded-[14px] border border-[#d6d9de] bg-white px-4 py-3.5 text-[16px] text-black outline-none placeholder:text-black/40 focus:border-[#9db8de] ${props.className || ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`mt-2.5 w-full resize-none rounded-[14px] border border-[#d6d9de] bg-white px-4 py-3.5 text-[16px] text-black outline-none placeholder:text-black/40 focus:border-[#9db8de] ${props.className || ''}`} />;
}

/** Compact header (Settings): small wordmark on one side, page title on the other. */
export function CompactHeader({ title }: { title: string }) {
  const { lang } = useLang();
  return (
    <header className="flex items-center justify-between pt-8">
      <span className="k-wordmark text-[24px]" style={{ color: 'var(--text)' }}>{Brand.name(lang)}</span>
      <span className="text-[18px] font-medium" style={{ color: 'var(--text)' }}>{title}</span>
    </header>
  );
}

/** One centered column, max 460px: header, tabs, the screen, footer. */
export function Shell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[460px] px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {title ? <CompactHeader title={title} /> : <Header />}
      <Tabs />
      {title && <hr className="mt-4" style={{ borderColor: 'var(--line)' }} />}
      <main>{children}</main>
      <Footer />
    </div>
  );
}
