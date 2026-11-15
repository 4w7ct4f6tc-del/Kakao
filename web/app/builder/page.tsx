'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Suspense, useEffect, useRef, useState } from 'react';
import PreviewApp, { PhoneFrame } from '@/components/PreviewApp';
import { Btn, Card, Input, Shell, TextArea } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { ALL_SECTIONS, type Design, localDesign, TEMPLATES } from '@/lib/design';
import { useLang } from '@/lib/i18n';
import { loadGirl, parseRequest, playVoice, talk } from '@/lib/girl';

const PALETTE = ['#111111', '#FFFFFF', '#DC2626', '#E11D48', '#EC4899', '#7C3AED', '#2563EB', '#1E3A8A', '#0EA5E9', '#14B8A6', '#16A34A', '#84CC16', '#EAB308', '#C9A227', '#EA580C', '#7C2D12', '#6B7280', '#E7D7C1', '#FFFBEB', '#0F172A'];
const FONTS = ['Cairo', 'Tajawal', 'Inter'];
const SECTION_NAMES: Record<string, [string, string]> = { hero: ['الواجهة', 'Hero'], categories: ['الأقسام', 'Categories'], products: ['المنتجات', 'Products'], offers: ['العروض', 'Offers'], booking: ['الحجز', 'Booking'], reviews: ['التقييمات', 'Reviews'], map: ['الخريطة', 'Map'], contact: ['التواصل', 'Contact'], about: ['من نحن', 'About'] };
const AIS: [string, string][] = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['meta', 'Meta'], ['gemini', 'Gemini']];
type Step = 'build' | 'consent' | 'connect' | 'done';

function Builder() {
  const { t, lang, observe } = useLang();
  const ar = lang === 'ar';
  const params = useSearchParams();
  const router = useRouter();
  const [ai, setAi] = useState('claude');
  const [text, setText] = useState('');
  const [design, setDesign] = useState<Design | null>(null);
  const [answers, setAnswers] = useState({ name: '', colors: '', sell: '' });
  const [busy, setBusy] = useState('');
  const [reply, setReply] = useState('');
  const [msg, setMsg] = useState('');
  const [step, setStep] = useState<Step>('build');
  const [consent, setConsent] = useState([false, false, false]);
  const [contact, setContact] = useState({ whatsapp: '', instagram: '', domain: '' });
  const [result, setResult] = useState<{ url: string; customDomain?: string; notes?: string[] } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = params.get('prompt');
    if (p) { setText(p); build(p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Instant local design first, then the selected AI improves it. */
  async function build(prompt = text, a = answers) {
    const p = prompt.trim() || t('examplePh').replace(/^[^:]+:\s*/, '');
    observe(p);
    setMsg('');
    const local = localDesign(p, lang, a.name, a.colors, a.sell);
    setDesign(local);
    setStep('build');
    setBusy('build');
    try {
      const r = await api<{ design: Design }>('/builder/generate', { prompt: p, lang, engine: ai, answers: a, base: local });
      setDesign(r.design);
    } catch { /* instant design already shown */ }
    setBusy('');
  }

  function answer(k: keyof typeof answers, v: string) {
    const a = { ...answers, [k]: v };
    setAnswers(a);
    setDesign(localDesign(text || t('examplePh'), lang, a.name, a.colors, a.sell));
  }

  /** 🔊 Real girl voice reply: dialect / type / mode come from the voice settings or from the text itself
   *  ("سوي لي إعلان لمحلي باللهجة المصرية بنت تضحك" → Egyptian, laughing, ad). */
  async function voiceReply() {
    const content = text.trim();
    if (!content) return;
    setBusy('voice');
    const asked = parseRequest(content);
    const settings = { ...loadGirl(), mode: 'chat', ...asked };
    const r = await talk('reply', settings, [{ role: 'user', content }], 0, ai);
    setReply(r.text);
    const how = await playVoice(r.audio, r.text, r.settings || settings);
    if (how === 'device') setMsg(ar ? 'معاينة بصوت جهازك — صوت البنت الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح.' : 'Device-voice preview — the real girl voice (ElevenLabs) works once keys are connected.');
    setBusy('');
  }

  async function camera(f: File) {
    setBusy('camera');
    setMsg('');
    try {
      const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(f); });
      const r = await api<{ design: Design }>('/vision/analyze', { image: data, mime: f.type || 'image/jpeg', mode: 'buildApp', lang });
      setDesign(r.design);
      setStep('build');
    } catch (e) {
      setMsg(friendly(e, lang));
      await build(text);
    }
    setBusy('');
  }

  async function publish() {
    if (!design) return;
    setBusy('publish');
    setMsg('');
    const d: Design = { ...design, contact: { ...design.contact, whatsapp: contact.whatsapp, instagram: contact.instagram }, status: 'live' };
    try {
      setResult(await api('/apps/publish', { design: d, domain: contact.domain || undefined }));
      setStep('done');
    } catch (e) {
      setMsg(friendly(e, lang));
    }
    setBusy('');
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap gap-2">
          {AIS.map(([id, name]) => (
            <button key={id} onClick={() => setAi(id)} className={`rounded-full px-4 py-2 text-sm font-bold ${ai === id ? 'bg-black text-white' : 'bg-[#E5E5E5] text-black'}`}>{name}</button>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold">{t('chosenAI')}: {AIS.find((x) => x[0] === ai)![1]}</p>
        <TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('examplePh')} />
        <Btn onClick={() => build()} disabled={busy === 'build'}>{busy === 'build' ? '…' : t('buildBtn')}</Btn>
        <div className="grid grid-cols-2 gap-2.5">
          <Btn v="grey" className="!text-[15px]" onClick={() => file.current?.click()} disabled={busy === 'camera'}>{busy === 'camera' ? '…' : t('cameraBtn')}</Btn>
          <Btn v="grey" className="!text-[15px]" onClick={voiceReply} disabled={busy === 'voice'}>{busy === 'voice' ? '…' : t('voiceBtn')}</Btn>
        </div>
        <Btn v="grey" onClick={() => router.push('/talk')}>🎤 {ar ? 'تكلم مع بنت خعخعو' : 'Talk with the KAkAo girl'}</Btn>
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && camera(e.target.files[0])} />
        {reply && <p className="mt-3 whitespace-pre-wrap rounded-[14px] bg-[#F3F3F3] p-3 leading-7">{reply}</p>}
        {msg && <p className="mt-2 text-sm text-black/60">{msg}</p>}
        {!design && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TEMPLATES.slice(0, 6).map((tpl) => (
              <button key={tpl.type} onClick={() => { const p = ar ? `أبي تطبيق ${tpl.title.ar}` : `I want a ${tpl.title.en} app`; setText(p); build(p); }} className="rounded-full bg-[#F3F3F3] px-3 py-1.5 text-xs font-semibold">{tpl.emoji} {ar ? tpl.title.ar : tpl.title.en}</button>
            ))}
          </div>
        )}
      </Card>

      {design && step === 'build' && (
        <Card>
          <h2 className="mb-3 text-center text-lg font-extrabold">{t('liveDemo')}</h2>
          <PhoneFrame><PreviewApp d={design} onChange={setDesign} /></PhoneFrame>
          <details className="mt-4 rounded-[14px] bg-[#F3F3F3] p-3">
            <summary className="cursor-pointer text-sm font-bold">{t('quickQ')}</summary>
            <Input placeholder={t('q1')} value={answers.name} onChange={(e) => answer('name', e.target.value)} />
            <Input placeholder={t('q2')} value={answers.colors} onChange={(e) => answer('colors', e.target.value)} />
            <Input placeholder={t('q3')} value={answers.sell} onChange={(e) => answer('sell', e.target.value)} />
          </details>
          <details className="mt-2.5 rounded-[14px] bg-[#F3F3F3] p-3">
            <summary className="cursor-pointer text-sm font-bold">✏️ {ar ? 'عدّل التصميم' : 'Edit the design'}</summary>
            <Input value={design.name} onChange={(e) => setDesign({ ...design, name: e.target.value })} placeholder={t('q1')} />
            {(['primary', 'secondary', 'background'] as const).map((k) => (
              <div key={k} className="mt-3">
                <p className="mb-1.5 text-xs font-bold">{{ primary: ar ? 'اللون الأساسي' : 'Main color', secondary: ar ? 'اللون الثانوي' : 'Accent color', background: ar ? 'الخلفية' : 'Background' }[k]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((c) => (
                    <button key={c} aria-label={c} onClick={() => setDesign({ ...design, colors: { ...design.colors, [k]: c, ...(k === 'background' ? { text: parseInt(c.slice(1), 16) < 0x888888 ? '#FFFFFF' : '#111111' } : {}) } })} className={`h-7 w-7 rounded-full border ${design.colors[k] === c ? 'ring-2 ring-black ring-offset-1' : 'border-black/10'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 flex gap-1.5">
              {FONTS.map((f) => <button key={f} onClick={() => setDesign({ ...design, font: f })} className={`flex-1 rounded-[10px] py-2 text-sm font-bold ${design.font === f ? 'bg-black text-white' : 'bg-white'}`} style={{ fontFamily: f }}>{f}</button>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ALL_SECTIONS.map((sec) => {
                const on = design.sections.includes(sec);
                return <button key={sec} onClick={() => setDesign({ ...design, sections: ALL_SECTIONS.filter((x) => (x === sec ? !on : design.sections.includes(x))) })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-black text-white' : 'bg-white text-black/60'}`}>{SECTION_NAMES[sec][ar ? 0 : 1]}</button>;
              })}
            </div>
            <div className="mt-3 space-y-1.5">
              {design.products.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span>{p.emoji}</span>
                  <input value={p.name} onChange={(e) => setDesign({ ...design, products: design.products.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) })} className="min-w-0 flex-1 rounded-[10px] bg-white px-2.5 py-2 text-sm outline-none" />
                  <input value={p.price} inputMode="decimal" onChange={(e) => setDesign({ ...design, products: design.products.map((x) => (x.id === p.id ? { ...x, price: Number(e.target.value) || 0 } : x)) })} className="w-20 rounded-[10px] bg-white px-2.5 py-2 text-sm outline-none" />
                  <button aria-label="delete" onClick={() => setDesign({ ...design, products: design.products.filter((x) => x.id !== p.id) })} className="px-1">🗑️</button>
                </div>
              ))}
              <button onClick={() => setDesign({ ...design, products: [...design.products, { id: `n${Date.now()}`, name: t('addProduct'), price: 1, emoji: design.logoEmoji, category: design.categories[0] || '', image: '' }] })} className="w-full rounded-[10px] bg-white py-2 text-sm font-bold">+ {t('addProduct')}</button>
            </div>
          </details>
          <Btn v="green" onClick={() => { api('/apps/save', { design }).catch(() => {}); setStep('consent'); }}>{t('approveFull')}</Btn>
        </Card>
      )}

      {step === 'consent' && (
        <Card>
          <h2 className="text-lg font-extrabold">{t('consent')}</h2>
          {[t('terms'), t('privacy'), t('payment')].map((label, i) => (
            <label key={i} className="mt-2.5 flex items-center gap-3 rounded-[14px] bg-[#F3F3F3] p-3.5 font-semibold">
              <input type="checkbox" checked={consent[i]} onChange={(e) => setConsent(consent.map((c, j) => (j === i ? e.target.checked : c)))} className="h-5 w-5 accent-[#16A34A]" />
              {label}
            </label>
          ))}
          <Btn v="green" disabled={!consent.every(Boolean)} onClick={() => setStep('connect')}>{t('next')}</Btn>
          <Btn v="grey" onClick={() => setStep('build')}>{t('back')}</Btn>
        </Card>
      )}

      {step === 'connect' && (
        <Card>
          <h2 className="text-lg font-extrabold">{t('connect')}</h2>
          <Input placeholder={`💬 ${t('whatsapp')}`} value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} />
          <Input placeholder={`📸 ${t('instagram')}`} value={contact.instagram} onChange={(e) => setContact({ ...contact, instagram: e.target.value })} />
          <Input placeholder={`🌐 ${t('domain')}`} value={contact.domain} onChange={(e) => setContact({ ...contact, domain: e.target.value })} />
          {msg && <p className="mt-2 text-sm text-black/60">{msg}</p>}
          <Btn v="green" onClick={publish} disabled={busy === 'publish'}>{busy === 'publish' ? '…' : `🚀 ${t('publish')}`}</Btn>
          <Btn v="grey" onClick={() => setStep('consent')}>{t('back')}</Btn>
        </Card>
      )}

      {step === 'done' && result && (() => {
        const link = result.customDomain ? `https://${result.customDomain}` : result.url;
        return (
          <Card className="text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-black">{t('published')}</h2>
            <div className="mx-auto my-4 w-fit"><QRCodeSVG value={link} size={190} /></div>
            <p className="break-all font-semibold text-[#16A34A]">{link}</p>
            <Btn onClick={() => window.open(link, '_blank')}>{t('open')}</Btn>
            <Btn v="grey" onClick={() => navigator.clipboard.writeText(link).catch(() => {})}>{t('copy')}</Btn>
            {(result.notes || []).map((n) => <p key={n} className="text-xs text-black/50">• {n}</p>)}
            <Btn v="grey" onClick={() => { setStep('build'); setDesign(null); setText(''); setResult(null); }}>+ {t('newApp')}</Btn>
          </Card>
        );
      })()}
    </>
  );
}

export default function BuilderPage() {
  return <Shell><Suspense fallback={null}><Builder /></Suspense></Shell>;
}
