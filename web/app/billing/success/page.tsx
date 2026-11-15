'use client';
import Link from 'next/link';
import { Logo, Footer } from '@/components/ui';
import { useLang } from '@/lib/i18n';

export default function Success() {
  const { lang } = useLang();
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <Logo size={72} />
      <h1 className="mt-4 text-3xl font-black">{lang === 'ar' ? 'تمت الترقية!' : 'You are upgraded!'}</h1>
      <p className="mt-2 text-white/70">{lang === 'ar' ? 'ارجع للتطبيق — كل المزايا صارت مفتوحة.' : 'Go back to the app — all features are unlocked.'}</p>
      <Link href="/" className="mt-6 inline-block rounded-2xl bg-accent px-6 py-3 font-bold">OK</Link>
      <Footer />
    </div>
  );
}
