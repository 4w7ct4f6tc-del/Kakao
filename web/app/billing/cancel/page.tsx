'use client';
import Link from 'next/link';
import { Logo, Footer } from '@/components/ui';
import { useLang } from '@/lib/i18n';

export default function Cancel() {
  const { lang } = useLang();
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <Logo size={72} />
      <h1 className="mt-4 text-2xl font-black">{lang === 'ar' ? 'ما تم الدفع' : 'Payment not completed'}</h1>
      <p className="mt-2 text-white/70">{lang === 'ar' ? 'تقدر تجرب BenefitPay أو PayPal أو البطاقة.' : 'You can try BenefitPay, PayPal or card.'}</p>
      <Link href="/settings" className="mt-6 inline-block rounded-2xl bg-accent px-6 py-3 font-bold">{lang === 'ar' ? 'الباقات' : 'Plans'}</Link>
      <Footer />
    </div>
  );
}
