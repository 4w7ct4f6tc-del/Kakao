import Link from 'next/link';

export const metadata = { title: 'Terms • Privacy • Payment — KAkAo' };

/** Template legal text — have it reviewed by a lawyer before launch. */
export default function Legal() {
  return (
    <div className="prose prose-invert mx-auto max-w-3xl px-6 py-10 leading-8">
      <h1 className="text-3xl font-black">Terms of Service</h1>
      <p>KAkAo is operated by K.A Familia Global Company (B.K.A Famy). By using the app you agree to use it lawfully, to own or have rights to the content and images you upload, and not to build apps that impersonate others or sell illegal goods.</p>
      <h2 className="mt-8 text-2xl font-bold">Privacy Policy</h2>
      <p>We store your account (name, email, phone), your app designs, chats and generated media in Google Firebase. Third-party tokens you connect are encrypted (AES-256-GCM) and used only for the scopes you approve; you can disconnect at any time from Settings. Messages you send to AI models are processed by the provider you choose (OpenAI, Anthropic, Google, Meta). We do not sell personal data. Contact us to delete your data.</p>
      <h2 className="mt-8 text-2xl font-bold">Payment Terms</h2>
      <p>Paid plans (Pro, Ultra) are billed monthly through Stripe (card, Apple Pay, Google Pay), BenefitPay (via Tap Payments) or PayPal. You can cancel anytime; access continues until the end of the paid period. Domains, if purchased, are billed separately by the registrar.</p>
      <hr className="my-8 border-white/20" />
      <h1 className="text-3xl font-black" dir="rtl">الشروط • الخصوصية • الدفع</h1>
      <p dir="rtl">يتم تشغيل خعخعو بواسطة K.A Familia Global Company. باستخدامك للتطبيق توافق على الاستخدام القانوني وامتلاك حقوق المحتوى والصور التي ترفعها. نخزن بيانات حسابك وتصاميمك في Firebase، وتُشفّر مفاتيح الربط ولا تُستخدم إلا للصلاحيات التي وافقت عليها، ويمكنك الفصل في أي وقت. الاشتراكات شهرية عبر Stripe أو BenefitPay أو PayPal ويمكن إلغاؤها في أي وقت.</p>
      <Link href="/" className="mt-8 inline-block text-accent underline">← KAkAo</Link>
    </div>
  );
}
