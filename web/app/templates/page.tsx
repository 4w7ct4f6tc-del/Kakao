'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PreviewApp, { PhoneFrame } from '@/components/PreviewApp';
import { Shell } from '@/components/ui';
import { localDesign, TEMPLATES } from '@/lib/design';
import { useLang } from '@/lib/i18n';

/** Every template from templates/<name>/template.json, live and clickable. */
export default function Templates() {
  const { lang } = useLang();
  const router = useRouter();
  const l = lang === 'ar' ? 'ar' : 'en';
  const [active, setActive] = useState(TEMPLATES[0].type);
  const tpl = TEMPLATES.find((t) => t.type === active)!;
  const prompt = l === 'ar' ? `أبي تطبيق ${tpl.title.ar}` : `I want a ${tpl.title.en} app`;
  const [design, setDesign] = useState(() => localDesign(prompt, lang));
  useEffect(() => setDesign(localDesign(prompt, lang)), [prompt, lang]);
  return (
    <Shell>
      <div className="py-4">
        <h1 className="mb-1 text-2xl font-extrabold">{l === 'ar' ? 'القوالب' : 'Templates'}</h1>
        <p className="mb-4 text-sm text-muted">
          {l === 'ar' ? 'كل قالب فيه: الرئيسية، المنتجات، البحث، السلة، إتمام الطلب، الطلب عبر واتساب، الخريطة، التقييمات، ولوحة الإدارة.' : 'Every template has: Home, Products, Search, Cart, Checkout, WhatsApp order, Map, Reviews and an Admin Panel.'}
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.type} onClick={() => setActive(t.type)} className={`rounded-xl border px-3 py-1.5 text-sm ${active === t.type ? 'border-accent bg-accent' : 'border-[#444]'}`}>
              {t.emoji} {t.title[l]}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-4">
          <PhoneFrame><PreviewApp key={active + lang} d={design} onChange={setDesign} /></PhoneFrame>
          <button onClick={() => router.push(`/builder?prompt=${encodeURIComponent(prompt)}`)} className="w-full max-w-sm rounded-2xl bg-accent py-4 text-lg font-bold">
            ✨ {l === 'ar' ? 'استخدم هذا القالب' : 'Use this template'}
          </button>
        </div>
      </div>
    </Shell>
  );
}
