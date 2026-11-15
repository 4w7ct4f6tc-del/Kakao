'use client';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Button, Input, Shell } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { useLang } from '@/lib/i18n';

const INTEGRATIONS: [string, string, 'oauth' | 'apikey'][] = [
  ['google', '🟢 Google (Drive, Sheets, Maps, Gmail, Calendar)', 'oauth'], ['youtube', '▶️ YouTube', 'oauth'], ['facebook', '📘 Facebook', 'oauth'],
  ['instagram', '📸 Instagram', 'oauth'], ['whatsapp', '💬 WhatsApp Business', 'oauth'], ['github', '🐙 GitHub', 'oauth'], ['stripe', '💳 Stripe', 'oauth'],
  ['vercel', '▲ Vercel', 'oauth'], ['tiktok', '🎵 TikTok', 'oauth'], ['supabase', '🟩 Supabase', 'oauth'], ['firebase', '🔥 Firebase', 'oauth'],
  ['cloudflare', '☁️ Cloudflare', 'apikey'], ['render', '🚀 Render', 'apikey'], ['telegram', '✈️ Telegram', 'apikey'], ['twilio', '📱 Twilio', 'apikey'],
  ['sendgrid', '✉️ SendGrid', 'apikey'], ['benefitpay', '🇧🇭 BenefitPay', 'apikey'], ['paypal', '🅿️ PayPal', 'apikey'],
];
const BYOK = [['openai', 'OpenAI'], ['anthropic', 'Anthropic Claude'], ['gemini', 'Google Gemini'], ['meta', 'Meta Llama (Groq)'], ['elevenlabs', 'ElevenLabs']];

export default function Settings() {
  const { t, lang } = useLang();
  const [me, setMe] = useState<any>(null);
  const [connected, setConnected] = useState<Record<string, any>>({});
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  const load = () => {
    api('/me').then(setMe).catch(() => {});
    api<{ connected: Record<string, any> }>('/integrations').then((r) => setConnected(r.connected)).catch(() => {});
    api<{ keys: Record<string, boolean> }>('/keys').then((r) => setKeys(r.keys)).catch(() => {});
  };
  useEffect(() => { load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, []);

  const run = async (fn: () => Promise<any>) => { try { setMsg(''); await fn(); load(); } catch (e) { setMsg(friendly(e, lang)); } };

  const plans = [
    ['pro', t('pro'), '$9.99'],
    ['ultra', t('ultra'), '$24.99'],
  ];

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-8 py-4">
        <section className="rounded-3xl bg-white p-5 text-black">
          <b className="text-lg">{me?.name || me?.email || me?.phone || t('guest')}</b>
          <p className="text-black/60">{t('plans')}: {t(me?.plan || 'free')}</p>
          {!me && <Link href="/login" className="mt-2 inline-block rounded-xl bg-black px-4 py-2 text-white">{t('login')}</Link>}
        </section>
        {msg && <p className="text-sm text-muted">{msg}</p>}

        <section>
          <h2 className="mb-3 text-xl font-extrabold">{t('plans')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {plans.map(([id, name, price]) => (
              <div key={id} className={`rounded-3xl p-5 ${id === 'ultra' ? 'bg-white text-black' : 'bg-surface'}`}>
                <div className="flex justify-between text-xl font-black"><span>{name}</span><span>{price}</span></div>
                <Button accent onClick={() => run(async () => { const r = await api<{ url: string }>('/payments/checkout', { plan: id, method: 'stripe' }); location.href = r.url; })}>Card • Apple Pay • Google Pay</Button>
                <Button onClick={() => run(async () => { const r = await api<{ url: string }>('/payments/checkout', { plan: id, method: 'benefitpay' }); location.href = r.url; })}>BenefitPay 🇧🇭</Button>
                <Button onClick={() => run(async () => { const r = await api<{ url: string }>('/payments/checkout', { plan: id, method: 'paypal' }); location.href = r.url; })}>PayPal</Button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-extrabold">{t('integrations')}</h2>
          {INTEGRATIONS.map(([id, name, kind]) => (
            <div key={id} className="mb-2 flex items-center justify-between rounded-2xl bg-surface p-3">
              <span>{name} {connected[id] && <span className="text-accent">✓</span>}</span>
              {connected[id] ? (
                <button className="rounded-xl border border-white/30 px-3 py-1.5" onClick={() => run(() => api('/integrations/disconnect', { provider: id }))}>Disconnect</button>
              ) : (
                <button className="rounded-xl bg-accent px-3 py-1.5 font-bold" onClick={() => run(async () => {
                  if (kind === 'oauth') { const r = await api<{ url: string }>('/integrations/start', { provider: id }); window.open(r.url, '_blank'); }
                  else { const key = prompt('API key / token'); if (key) await api('/integrations/apikey', { provider: id, key }); }
                })}>Connect</button>
              )}
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-extrabold">{t('keys')}</h2>
          {BYOK.map(([id, name]) => (
            <div key={id} className="mb-2 flex items-center gap-2 rounded-2xl bg-surface p-3">
              <span className="w-40 shrink-0">{name} {keys[id] && <span className="text-accent">✓</span>}</span>
              <Input type="password" value={draft[id] || ''} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })} />
              <button className="rounded-xl bg-accent px-3 py-2 font-bold" onClick={() => run(async () => { await api('/keys', { provider: id, key: draft[id] }); setDraft({ ...draft, [id]: '' }); })}>{t('save')}</button>
            </div>
          ))}
        </section>

        {auth?.currentUser && <Button onClick={() => auth && signOut(auth).then(() => location.reload())}>{t('signOut')}</Button>}
      </div>
    </Shell>
  );
}
