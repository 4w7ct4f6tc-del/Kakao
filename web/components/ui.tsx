'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand } from '@/lib/brand';
import { useLang } from '@/lib/i18n';

export function Logo({ size = 40 }: { size?: number }) {
  const { lang } = useLang();
  return (
    <div
      className="inline-flex items-center justify-center rounded-[22%] border border-[#2A2A2A] bg-black font-black text-white"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {Brand.letter(lang)}
    </div>
  );
}

/** Logo + ONE brand name — never both. */
export function Header() {
  const { lang } = useLang();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-bg/90 py-3 backdrop-blur">
      <Logo size={32} />
      <span className="text-xl font-extrabold">{Brand.name(lang)}</span>
    </header>
  );
}

export function Footer() {
  const { lang } = useLang();
  return <p className="py-6 text-center text-xs text-muted">{Brand.footer(lang)}</p>;
}

export function Button({ children, onClick, accent, disabled, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; accent?: boolean; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`my-1.5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[17px] font-bold transition disabled:opacity-40 ${accent ? 'bg-accent text-white hover:brightness-110' : 'border border-[#2A2A2A] bg-black text-white hover:bg-[#151515]'} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-2xl bg-surface px-4 py-4 text-white outline-none placeholder:text-muted focus:ring-2 focus:ring-accent ${props.className || ''}`} />;
}

export function BottomNav() {
  const { t } = useLang();
  const path = usePathname();
  const items = [
    ['/', '🏠', t('home')],
    ['/builder', '✨', t('builder')],
    ['/video', '🎬', t('video')],
    ['/settings', '⚙️', t('settings')],
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex bg-black pb-[env(safe-area-inset-bottom)]">
      {items.map(([href, icon, label]) => (
        <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${path === href ? 'text-accent' : 'text-white/80'}`}>
          <span className="text-lg">{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-6xl pb-24">
      <Header />
      <main className="px-4">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
