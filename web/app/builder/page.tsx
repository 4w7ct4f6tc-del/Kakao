'use client';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Suspense, useEffect, useState } from 'react';
import PreviewApp, { PhoneFrame } from '@/components/PreviewApp';
import { Button, Input, Shell } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { ALL_SECTIONS, type Design, localDesign, TEMPLATES } from '@/lib/design';
import { useLang } from '@/lib/i18n';

type Step = 'input' | 'questions' | 'edit' | 'consent' | 'connect' | 'publishing' | 'done';
const PALETTE = ['#111111', '#FFFFFF', '#DC2626', '#E11D48', '#EC4899', '#7C3AED', '#2563EB', '#1E3A8A', '#0EA5E9', '#14B8A6', '#16A34A', '#84CC16', '#EAB308', '#C9A227', '#EA580C', '#7C2D12', '#6B7280', '#E7D7C1', '#FDF2F8', '#FFFBEB', '#EFF6FF', '#0F172A'];
const FONTS = ['Cairo', 'Tajawal', 'Inter'];

function Builder() {
  const { t, lang, observe } = useLang();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>('input');
  const [prompt, setPrompt] = useState('');
  const [answers, setAnswers] = useState(['', '', '']);
  const [q, setQ] = useState(0);
  const [design, setDesign] = useState<Design | null>(null);
  const [tab, setTab] = useState('colors');
  const [consent, setConsent] = useState([false, false, false]);
  const [contact, setContact] = useState({ whatsapp: '', instagram: '', domain: '' });
  const [result, setResult] = useState<{ url: string; customDomain?: string; notes?: string[] } | null>(null);
  const [msg, setMsg] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const p = params.get('prompt');
    if (p) { setPrompt(p); start(p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(p = prompt) {
    if (!p.trim()) return;
    observe(p);
    setDesign(localDesign(p, lang));
    setQ(0);
    setStep('questions');
  }

  function answer(v: string) {
    const a = [...answers];
    a[q] = v;
    setAnswers(a);
    setDesign(localDesign(prompt, lang, a[0], a[1], a[2]));
  }

  async function generate() {
    setGenerating(true);
    setStep('edit');
    const local = localDesign(prompt, lang, answers[0], answers[1], answers[2]);
    setDesign(local);
    try {
      const r = await api<{ design: Design }>('/builder/generate', { prompt, lang, answers: { name: answers[0], colors: answers[1], sell: answers[2] }, base: local });
      setDesign(r.design);
    } catch { /* local design already shown — instant alternative */ }
    setGenerating(false);
  }

  async function publish() {
    if (!design) return;
    const d: Design = { ...design, contact: { ...design.contact, whatsapp: contact.whatsapp, instagram: contact.instagram }, status: 'live' };
    setStep('publishing');
    try {
      const r = await api<{ url: string; customDomain?: string; notes?: string[] }>('/apps/publish', { design: d, domain: contact.domain || undefined });
      setResult(r);
      setStep('done');
    } catch (e) {
      setMsg(friendly(e, lang));
      setStep('connect');
    }
  }

  const set = (patch: Partial<Design>) => design && setDesign({ ...design, ...patch });
  const qs = [t('q1'), t('q2'), t('q3')];

  if (step === 'input') return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="mb-4 text-3xl font-extrabold">{t('welcome')}</h1>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder={t('hint')} className="w-full rounded-2xl bg-surface p-4 outline-none placeholder:text-muted" />
      <Button accent onClick={() => start()}>✨ {t('next')}</Button>
      <a href="/templates" className="mt-2 block text-center text-sm text-accent underline">{lang === 'ar' ? 'شوف كل القوالب مباشرة' : 'See all templates live'}</a>
      <div className="mt-4 flex flex-wrap gap-2">
        {TEMPLATES.map((tpl) => (
          <button key={tpl.type} onClick={() => { const p = lang === 'ar' ? `أبي تطبيق ${tpl.title.ar}` : `I want a ${tpl.title.en} app`; setPrompt(p); start(p); }} className="rounded-xl border border-[#444] px-3 py-1.5 text-sm hover:border-accent">
            {tpl.emoji} {lang === 'ar' ? tpl.title.ar : tpl.title.en}
          </button>
        ))}
      </div>
    </div>
  );

  if (step === 'questions') return (
    <div className="grid items-center gap-8 py-6 md:grid-cols-2">
      <div>
        <div className="mb-6 h-2 overflow-hidden rounded bg-surface"><div className="h-full bg-accent transition-all" style={{ width: `${((q + 1) / 3) * 100}%` }} /></div>
        <p className="text-muted">{q + 1}/3</p>
        <h2 className="mb-4 text-3xl font-extrabold">{qs[q]}</h2>
        <Input autoFocus key={q} value={answers[q]} onChange={(e) => answer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (q < 2 ? setQ(q + 1) : generate())} />
        <Button accent onClick={() => (q < 2 ? setQ(q + 1) : generate())}>{q < 2 ? t('next') : t('preview')}</Button>
        <Button onClick={() => (q < 2 ? setQ(q + 1) : generate())}>{t('skip')}</Button>
      </div>
      <div className="hidden justify-center md:flex">{design && <PhoneFrame><PreviewApp d={design} /></PhoneFrame>}</div>
    </div>
  );

  if (step === 'edit' && design) return (
    <div className="grid gap-6 py-4 md:grid-cols-2">
      <div className="flex flex-col items-center">
        <PhoneFrame><PreviewApp d={design} onChange={setDesign} /></PhoneFrame>
        {generating && <p className="mt-3 animate-pulse text-sm text-muted">AI ✨ …</p>}
      </div>
      <div>
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {['colors', 'font', 'sections', 'products'].map((x) => <button key={x} onClick={() => setTab(x)} className={`rounded-xl px-4 py-2 ${tab === x ? 'bg-accent' : 'bg-surface'}`}>{t(x)}</button>)}
        </div>
        {tab === 'colors' && (
          <div className="space-y-4">
            <Input value={design.name} onChange={(e) => set({ name: e.target.value })} />
            <Input value={design.tagline} onChange={(e) => set({ tagline: e.target.value })} />
            {(['primary', 'secondary', 'background'] as const).map((k) => (
              <div key={k}>
                <p className="mb-2 font-bold">{({ primary: lang === 'ar' ? 'اللون الأساسي' : 'Main color', secondary: lang === 'ar' ? 'اللون الثانوي' : 'Accent color', background: lang === 'ar' ? 'الخلفية' : 'Background' } as Record<string, string>)[k]}</p>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => <button key={c} onClick={() => set({ colors: { ...design.colors, [k]: c, ...(k === 'background' ? { text: parseInt(c.slice(1), 16) < 0x888888 ? '#FFFFFF' : '#111111' } : {}) } })} className={`h-8 w-8 rounded-full border ${design.colors[k] === c ? 'ring-2 ring-accent' : 'border-white/20'}`} style={{ background: c }} />)}
                  <input type="color" value={design.colors[k]} onChange={(e) => set({ colors: { ...design.colors, [k]: e.target.value.toUpperCase() } })} className="h-8 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'font' && FONTS.map((f) => <button key={f} onClick={() => set({ font: f })} className={`mb-2 block w-full rounded-xl p-3 text-start ${design.font === f ? 'bg-accent' : 'bg-surface'}`} style={{ fontFamily: f }}>{f} — Aa</button>)}
        {tab === 'sections' && ALL_SECTIONS.map((s) => (
          <label key={s} className="mb-2 flex items-center justify-between rounded-xl bg-surface p-3">
            {s}
            <input type="checkbox" checked={design.sections.includes(s)} onChange={(e) => set({ sections: ALL_SECTIONS.filter((x) => (x === s ? e.target.checked : design.sections.includes(x))) })} />
          </label>
        ))}
        {tab === 'products' && (
          <div className="space-y-2">
            {design.products.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-surface p-2">
                <span className="text-2xl">{p.emoji}</span>
                <Input value={p.name} onChange={(e) => set({ products: design.products.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) })} />
                <Input type="number" className="!w-24" value={p.price} onChange={(e) => set({ products: design.products.map((x) => (x.id === p.id ? { ...x, price: Number(e.target.value) } : x)) })} />
                <button onClick={() => set({ products: design.products.filter((x) => x.id !== p.id) })}>🗑️</button>
              </div>
            ))}
            <Button onClick={() => set({ products: [...design.products, { id: `n${Date.now()}`, name: t('addProduct'), price: 1, emoji: design.logoEmoji, category: design.categories[0] || '', image: '' }] })}>+ {t('addProduct')}</Button>
          </div>
        )}
        <Button accent onClick={() => { api('/apps/save', { design }).catch(() => {}); setStep('consent'); }}>✅ {t('iLikeIt')}</Button>
      </div>
    </div>
  );

  if (step === 'consent') return (
    <div className="mx-auto max-w-xl py-6">
      <h2 className="mb-4 text-2xl font-extrabold">{t('consent')}</h2>
      {[t('terms'), t('privacy'), t('payment')].map((label, i) => (
        <label key={i} className="mb-2 flex items-center gap-3 rounded-xl bg-surface p-4">
          <input type="checkbox" checked={consent[i]} onChange={(e) => setConsent(consent.map((c, j) => (j === i ? e.target.checked : c)))} className="h-5 w-5 accent-[#16A34A]" />
          {label}
        </label>
      ))}
      <a href="/legal" target="_blank" className="text-sm text-accent underline">Terms • Privacy • Payment</a>
      <Button accent disabled={!consent.every(Boolean)} onClick={() => setStep('connect')}>{t('next')}</Button>
      <Button onClick={() => setStep('edit')}>{t('back')}</Button>
    </div>
  );

  if (step === 'connect' || step === 'publishing') return (
    <div className="mx-auto max-w-xl space-y-3 py-6">
      <h2 className="text-2xl font-extrabold">{t('connect')}</h2>
      <Input placeholder={`💬 ${t('whatsapp')}`} value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} />
      <Input placeholder={`📸 ${t('instagram')}`} value={contact.instagram} onChange={(e) => setContact({ ...contact, instagram: e.target.value })} />
      <Input placeholder={`🌐 ${t('domain')}`} value={contact.domain} onChange={(e) => setContact({ ...contact, domain: e.target.value })} />
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button accent disabled={step === 'publishing'} onClick={publish}>{step === 'publishing' ? '…' : `🚀 ${t('publish')}`}</Button>
    </div>
  );

  if (step === 'done' && result) {
    const link = result.customDomain ? `https://${result.customDomain}` : result.url;
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-black">{t('published')}</h2>
        <div className="mx-auto my-6 w-fit rounded-3xl bg-white p-4"><QRCodeSVG value={link} size={200} /></div>
        <p className="break-all text-accent">{link}</p>
        <Button accent onClick={() => window.open(link, '_blank')}>{t('open')}</Button>
        <Button onClick={() => navigator.clipboard.writeText(link)}>{t('copy')}</Button>
        {(result.notes || []).map((n) => <p key={n} className="text-xs text-muted">• {n}</p>)}
        <Button onClick={() => { setStep('input'); setPrompt(''); setAnswers(['', '', '']); setResult(null); }}>+ {t('newApp')}</Button>
      </div>
    );
  }
  return null;
}

export default function BuilderPage() {
  return <Shell><Suspense fallback={null}><Builder /></Suspense></Shell>;
}
