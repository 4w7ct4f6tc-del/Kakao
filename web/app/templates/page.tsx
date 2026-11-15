'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PreviewApp, { PhoneFrame } from '@/components/PreviewApp';
import { Btn, Card, Shell } from '@/components/ui';
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
      <Card>
        <h1 className="text-lg font-extrabold">{l === 'ar' ? 'القوالب' : 'Templates'}</h1>
        <p className="mt-1 text-sm text-black/60">
          {l === 'ar' ? 'كل قالب فيه: الرئيسية، المنتجات، البحث، السلة، إتمام الطلب، الطلب عبر واتساب، الخريطة، التقييمات، ولوحة الإدارة.' : 'Every template: Home, Products, Search, Cart, Checkout, WhatsApp order, Map, Reviews, Admin Panel.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.type} onClick={() => setActive(t.type)} className={`rounded-full px-3.5 py-2 text-sm font-bold ${active === t.type ? 'bg-black text-white' : 'bg-[#E5E5E5] text-black'}`}>
              {t.title[l]}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <PhoneFrame><PreviewApp key={active + lang} d={design} onChange={setDesign} /></PhoneFrame>
        <Btn v="green" onClick={() => router.push(`/builder?prompt=${encodeURIComponent(prompt)}`)} icon="sparkles">{l === 'ar' ? 'استخدم هذا القالب' : 'Use this template'}</Btn>
      </Card>
    </Shell>
  );
}
