'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand } from '@/lib/brand';
import { useLang } from '@/lib/i18n';
import Icon, { type IconName } from './Icon';

/*
 * KAKAO design (copied from the owner's design):
 *  background #0F0F0F · white cards r=22 p=16 max-w 460 centered · black buttons
 *  green #16A34A approve button · grey secondary buttons · white text on dark, black on cards
 *  Cairo (Arabic) / Inter (English) · one screen = one task · big buttons
 */

export function Logo({ size = 44 }: { size?: number }) {
  const { lang } = useLang();
  return (
    <div className="inline-flex shrink-0 items-center justify-center rounded-[12px] bg-black font-black text-white" style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {Brand.letter(lang)}
    </div>
  );
}

/** Top: logo + name + "B.K.A Famy" on the start side, language button on the other side. */
export function Header() {
  const { lang, setLang, t } = useLang();
  return (
    <header className="pt-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <div className="text-xl font-extrabold">{Brand.name(lang)}</div>
            <div className="text-[11px] text-white/60">{Brand.company}</div>
          </div>
        </div>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="rounded-full bg-[#222] px-3.5 py-2 text-sm font-bold text-white"
          aria-label="Language"
        >
          <span className={lang === 'ar' ? 'text-white' : 'text-white/50'}>عربي</span>
          <span className="mx-1.5 text-white/30">|</span>
          <span className={lang !== 'ar' ? 'text-white' : 'text-white/50'}>English</span>
        </button>
      </div>
      <p className="mt-3 text-center text-sm text-white/75">{t('tagline')}</p>
    </header>
  );
}

/** 4 tabs in one row — selected white, others dark grey. */
export function Tabs() {
  const { t } = useLang();
  const path = usePathname();
  const items: [string, string][] = [
    ['/login', t('tabLogin')],
    ['/builder', t('tabBuilder')],
    ['/video', t('tabVideo')],
    ['/settings', t('tabSettings')],
  ];
  const active = path === '/' ? '/builder' : path;
  return (
    <nav className="mt-4 grid grid-cols-4 gap-2">
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-[14px] py-3 text-center text-[15px] font-bold transition ${active === href ? 'bg-white text-black' : 'bg-[#2A2A2A] text-white'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Footer() {
  const { lang } = useLang();
  return <p className="py-6 text-center text-xs text-white/50">{Brand.footer(lang)}</p>;
}

/** White rounded card (22px), 16px padding. Black text inside. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mt-4 rounded-[22px] bg-white p-4 text-black ${className}`}>{children}</section>;
}

type Variant = 'black' | 'green' | 'grey';
const V: Record<Variant, string> = {
  black: 'bg-black text-white',
  green: 'bg-[#16A34A] text-white',
  grey: 'bg-[#E5E5E5] text-black',
};

export function Btn({ children, onClick, v = 'black', disabled, className = '', icon }: { children: ReactNode; onClick?: () => void; v?: Variant; disabled?: boolean; className?: string; icon?: IconName }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mt-2.5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[14px] px-4 text-[17px] font-bold transition active:scale-[0.99] disabled:opacity-40 ${V[v]} ${className}`}
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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`mt-2.5 w-full rounded-[14px] border border-[#DDD] bg-white px-4 py-3.5 text-[16px] text-black outline-none placeholder:text-black/40 focus:border-black ${props.className || ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`mt-2.5 w-full resize-none rounded-[14px] border border-[#DDD] bg-white px-4 py-3.5 text-[16px] text-black outline-none placeholder:text-black/40 focus:border-black ${props.className || ''}`} />;
}

/** One centered column, max 460px: header, tabs, the screen, footer. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[460px] px-4">
      <Header />
      <Tabs />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
