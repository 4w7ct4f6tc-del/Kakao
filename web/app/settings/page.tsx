'use client';
import { useEffect, useState } from 'react';
import { Btn, Card, Input, Shell } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { useLang } from '@/lib/i18n';

const INTEGRATIONS: [string, string, 'oauth' | 'apikey'][] = [
  ['google', 'Google (Drive, Sheets, Maps, Gmail)', 'oauth'], ['facebook', 'Facebook', 'oauth'], ['instagram', 'Instagram', 'oauth'],
  ['whatsapp', 'WhatsApp Business', 'oauth'], ['github', 'GitHub', 'oauth'], ['stripe', 'Stripe', 'oauth'], ['vercel', 'Vercel', 'oauth'],
  ['youtube', 'YouTube', 'oauth'], ['tiktok', 'TikTok', 'oauth'], ['supabase', 'Supabase', 'oauth'], ['firebase', 'Firebase', 'oauth'],
  ['cloudflare', 'Cloudflare', 'apikey'], ['render', 'Render', 'apikey'], ['telegram', 'Telegram', 'apikey'], ['twilio', 'Twilio', 'apikey'],
  ['sendgrid', 'SendGrid', 'apikey'], ['benefitpay', 'BenefitPay', 'apikey'], ['paypal', 'PayPal', 'apikey'],
];
const BYOK: [string, string][] = [['openai', 'OpenAI (ChatGPT)'], ['anthropic', 'Anthropic (Claude)'], ['gemini', 'Google Gemini'], ['meta', 'Meta Llama'], ['elevenlabs', 'ElevenLabs']];

export default function Settings() {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [me, setMe] = useState<{ plan?: string } | null>(null);
  const [connected, setConnected] = useState<Record<string, unknown>>({});
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [voice, setVoice] = useState({ voice: 'female', speed: 1 });

  const load = () => {
    api('/me').then(setMe).catch(() => {});
    api<{ connected: Record<string, unknown> }>('/integrations').then((r) => setConnected(r.connected)).catch(() => {});
    api<{ keys: Record<string, boolean> }>('/keys').then((r) => setKeys(r.keys)).catch(() => {});
  };
  useEffect(() => { load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, []);
  const run = async (fn: () => Promise<unknown>) => { try { setMsg(''); await fn(); load(); } catch (e) { setMsg(friendly(e, lang)); } };
  const pay = (plan: string, method: string) => run(async () => { const r = await api<{ url: string }>('/payments/checkout', { plan, method }); window.location.href = r.url; });

  async function testVoice() {
    const text = ar ? 'هلا والله! هذا صوتك في التطبيق.' : 'Hello! This is your voice in the app.';
    try {
      const r = await api<{ audio: string }>('/voice/tts', { text, voice: voice.voice, speed: voice.speed, lang });
      const a = new Audio(`data:audio/mpeg;base64,${r.audio}`);
      a.playbackRate = voice.speed;
      await a.play();
    } catch {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = voice.speed;
      speechSynthesis.speak(u);
    }
  }

  return (
    <Shell>
      {msg && <p className="mt-3 text-center text-sm text-white/70">{msg}</p>}
      <Card>
        <h2 className="text-lg font-extrabold">{t('plans')}</h2>
        <p className="text-sm text-black/60">{ar ? 'باقتك' : 'Your plan'}: <b>{t(me?.plan || 'free')}</b></p>
        <div className="mt-3 rounded-[14px] bg-[#F3F3F3] p-3 text-sm">
          <b>{t('free')}</b>: {ar ? 'دردشة بلا حدود • 3 تطبيقات تجريبية • تصاميم أساسية • معاينة مباشرة • ربط موقع واحد' : 'Unlimited chat • 3 trial apps • basic designs • live preview • 1 site connection'}
        </div>
        {[['pro', '$9.99', ar ? 'تطبيقات بلا حدود • صوت حقيقي • كاميرا ذكية • كل الربط • دومين • نشر فوري' : 'Unlimited apps • real voice • smart camera • all integrations • domain • instant publish'],
          ['ultra', '$24.99', ar ? 'كل الذكاءات (ChatGPT + Claude Ultra + Gemini Pro) • أولوية قصوى • فيديو 1080p • استنساخ الصوت' : 'All AIs (ChatGPT + Claude Ultra + Gemini Pro) • Ultra priority • 1080p video • voice clone']].map(([id, price, feats]) => (
          <div key={id} className="mt-3 rounded-[14px] border border-[#E5E5E5] p-3">
            <div className="flex justify-between font-extrabold"><span>{t(id)}</span><span>{price}</span></div>
            <p className="mt-1 text-sm text-black/60">{feats}</p>
            <Btn v="green" onClick={() => pay(id, 'stripe')}>Card • Apple Pay • Google Pay</Btn>
            <div className="grid grid-cols-2 gap-2.5">
              <Btn v="grey" onClick={() => pay(id, 'benefitpay')}>BenefitPay</Btn>
              <Btn v="grey" onClick={() => pay(id, 'paypal')}>PayPal</Btn>
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">🔊 {ar ? 'الصوت' : 'Voice'}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[['male', ar ? 'رجل' : 'Male'], ['female', ar ? 'امرأة' : 'Female'], ['bahraini', ar ? 'بحريني' : 'Bahraini']].map(([id, label]) => (
            <button key={id} onClick={() => setVoice({ ...voice, voice: id })} className={`rounded-full px-4 py-2 text-sm font-bold ${voice.voice === id ? 'bg-black text-white' : 'bg-[#E5E5E5]'}`}>{label}</button>
          ))}
        </div>
        <label className="mt-3 block text-sm font-semibold">{ar ? 'السرعة' : 'Speed'}: {voice.speed.toFixed(1)}x</label>
        <input type="range" min={0.5} max={2} step={0.1} value={voice.speed} onChange={(e) => setVoice({ ...voice, speed: Number(e.target.value) })} className="w-full accent-black" />
        <Btn onClick={testVoice}>▶ {ar ? 'جرّب الصوت' : 'Test voice'}</Btn>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t('integrations')}</h2>
        {INTEGRATIONS.map(([id, name, kind]) => (
          <div key={id} className="mt-2 rounded-[14px] bg-[#F3F3F3] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{name} {connected[id] ? <span className="text-[#16A34A]">✓</span> : null}</span>
              {connected[id] ? (
                <button className="rounded-[10px] bg-[#E5E5E5] px-3 py-2 text-sm font-bold" onClick={() => run(() => api('/integrations/disconnect', { provider: id }))}>{ar ? 'فصل' : 'Disconnect'}</button>
              ) : (
                <button className="rounded-[10px] bg-black px-3 py-2 text-sm font-bold text-white" onClick={() => run(async () => {
                  if (kind === 'oauth') { const r = await api<{ url: string }>('/integrations/start', { provider: id }); window.open(r.url, '_blank'); return; }
                  const key = (draft[`int_${id}`] || '').trim();
                  if (!key) { setDraft({ ...draft, [`open_${id}`]: '1' }); return; }
                  await api('/integrations/apikey', { provider: id, key });
                  setDraft({ ...draft, [`int_${id}`]: '', [`open_${id}`]: '' });
                })}>{ar ? 'ربط' : 'Connect'}</button>
              )}
            </div>
            {kind === 'apikey' && draft[`open_${id}`] && !connected[id] && (
              <Input type="password" placeholder="API key" value={draft[`int_${id}`] || ''} onChange={(e) => setDraft({ ...draft, [`int_${id}`]: e.target.value })} />
            )}
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold">{t('keys')}</h2>
        {BYOK.map(([id, name]) => (
          <div key={id} className="mt-2">
            <p className="text-sm font-semibold">{name} {keys[id] && <span className="text-[#16A34A]">✓</span>}</p>
            <div className="flex gap-2">
              <Input type="password" value={draft[id] || ''} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })} />
              <button className="mt-2.5 rounded-[14px] bg-black px-4 font-bold text-white" onClick={() => run(async () => { await api('/keys', { provider: id, key: draft[id] }); setDraft({ ...draft, [id]: '' }); })}>{t('save')}</button>
            </div>
          </div>
        ))}
      </Card>
    </Shell>
  );
}
