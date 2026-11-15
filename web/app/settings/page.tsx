'use client';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import DanuSettings from '@/components/DanuSettings';
import Icon, { type IconName } from '@/components/Icon';
import { Btn, Card, Input, LangToggle, Pill, Shell } from '@/components/ui';
import VoiceCard from '@/components/VoiceCard';
import { api, friendly } from '@/lib/api';
import { useAppearance } from '@/lib/appearance';
import { Brand } from '@/lib/brand';
import { auth } from '@/lib/firebase';
import { useLang } from '@/lib/i18n';
import { DEFAULT_AI, loadAi } from '@/lib/aiChoice';

type View = 'list' | 'account' | 'ai' | 'notifications' | 'voice' | 'privacy' | 'appearance' | 'about' | 'danu';

const INTEGRATIONS: [string, string, 'oauth' | 'apikey'][] = [
  ['google', 'Google (Drive, Sheets, Maps, Gmail)', 'oauth'], ['facebook', 'Facebook', 'oauth'], ['instagram', 'Instagram', 'oauth'],
  ['whatsapp', 'WhatsApp Business', 'oauth'], ['github', 'GitHub', 'oauth'], ['stripe', 'Stripe', 'oauth'], ['vercel', 'Vercel', 'oauth'],
  ['youtube', 'YouTube', 'oauth'], ['tiktok', 'TikTok', 'oauth'], ['supabase', 'Supabase', 'oauth'], ['firebase', 'Firebase', 'oauth'],
  ['cloudflare', 'Cloudflare', 'apikey'], ['render', 'Render', 'apikey'], ['telegram', 'Telegram', 'apikey'], ['twilio', 'Twilio', 'apikey'],
  ['sendgrid', 'SendGrid', 'apikey'], ['benefitpay', 'BenefitPay', 'apikey'], ['paypal', 'PayPal', 'apikey'],
];
const BYOK: [string, string][] = [['openai', 'OpenAI (ChatGPT)'], ['anthropic', 'Anthropic (Claude)'], ['gemini', 'Google Gemini'], ['meta', 'Meta Llama'], ['elevenlabs', 'ElevenLabs']];
const AIS: [string, string][] = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['meta', 'Meta'], ['gemini', 'Gemini']];
const NOTIFS: [string, string, string][] = [
  ['video', 'الفيديو جاهز', 'Video is ready'], ['publish', 'تم نشر تطبيقك', 'Your app was published'],
  ['danu', 'دانو تسأل عنك', 'Danu checks in on you'], ['offers', 'العروض والجديد', 'Offers and news'],
];

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

export default function Settings() {
  const { t, lang, setLang } = useLang();
  const ar = lang === 'ar';
  const [view, setView] = useState<View>('list');
  const [appearance, setAppearance] = useAppearance();
  const [me, setMe] = useState<{ plan?: string; name?: string; email?: string; phone?: string } | null>(null);
  const [connected, setConnected] = useState<Record<string, unknown>>({});
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [ai, setAi] = useState(DEFAULT_AI);
  const [notifs, setNotifs] = useState<Record<string, boolean>>({});
  const [devices, setDevices] = useState<{ id: string; name: string; lastSeen: string }[]>([]);
  const [qs, setQs] = useState(['', '', '']);
  const [as, setAs] = useState(['', '', '']);

  const load = () => {
    api('/me').then(setMe).catch(() => {});
    api<{ connected: Record<string, unknown> }>('/integrations').then((r) => setConnected(r.connected)).catch(() => {});
    api<{ keys: Record<string, boolean> }>('/keys').then((r) => setKeys(r.keys)).catch(() => {});
    api<{ devices: { id: string; name: string; lastSeen: string }[] }>('/devices').then((r) => setDevices(r.devices)).catch(() => {});
  };
  useEffect(() => {
    load();
    setAi(loadAi());
    setNotifs(Object.fromEntries(NOTIFS.map(([id]) => [id, store.get(`notif_${id}`, '1') === '1'])));
    setQs(ar ? ['شنو اسم أول مدرسة درست فيها؟', 'شنو أكلتك المفضلة وأنت صغير؟', 'شنو اسم أقرب صديق لك؟'] : ['Your first school?', 'Favourite food as a kid?', 'Your closest friend?']);
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const run = async (fn: () => Promise<unknown>) => { try { setMsg(''); await fn(); load(); } catch (e) { setMsg(friendly(e, lang)); } };
  const pay = (plan: string, method: string) => run(async () => { const r = await api<{ url: string }>('/payments/checkout', { plan, method }); window.location.href = r.url; });

  const rows: [View | 'language', IconName, string][] = [
    ['account', 'user', ar ? 'الحساب' : 'Account'],
    ['language', 'globe', ar ? 'اللغة' : 'Language'],
    ['ai', 'sparkles', ar ? 'نموذج الذكاء' : 'AI Model'],
    ['notifications', 'bell', ar ? 'الإشعارات' : 'Notifications'],
    ['voice', 'mic', ar ? 'الصوت' : 'Voice'],
    ['privacy', 'lock', ar ? 'الخصوصية' : 'Privacy'],
    ['appearance', 'moon', ar ? 'المظهر' : 'Appearance'],
    ['about', 'info', ar ? 'عن التطبيق' : 'About'],
    ['danu', 'star', ar ? 'دانو' : 'Danu'],
  ];
  const title = view === 'list' ? (ar ? 'الإعدادات' : 'Settings') : rows.find((r) => r[0] === view)?.[2] || '';
  const signedIn = !!auth?.currentUser;

  const back = (
    <button onClick={() => setView('list')} className="mt-5 flex items-center gap-1 text-[15px] font-medium" style={{ color: 'var(--primary-fg)' }}>
      <Icon name={ar ? 'chevron' : 'back'} size={18} />{ar ? 'الإعدادات' : 'Settings'}
    </button>
  );

  return (
    <Shell title={title}>
      {msg && <p className="mt-3 text-center text-sm" style={{ color: 'var(--muted)' }}>{msg}</p>}

      {view === 'list' && (
        <Card>
          <ul className="mt-2">
            {rows.map(([id, icon, label]) => (
              <li key={id}>
                <button
                  onClick={() => (id === 'language' ? setLang(ar ? 'en' : 'ar') : setView(id as View))}
                  className="flex w-full items-center gap-5 py-4 text-start"
                >
                  <Icon name={icon} size={26} />
                  <span className="flex flex-1 items-center justify-between border-b border-black/10 pb-4 pt-0.5 text-[19px]" style={{ marginBottom: -16 }}>
                    {label}
                    <span className="flex items-center gap-3 text-black/40">
                      {id === 'language' && <span onClick={(e) => e.stopPropagation()}><LangToggle onCard /></span>}
                      <Icon name={ar ? 'back' : 'chevron'} size={20} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {signedIn ? (
            <Btn wide={false} className="mt-10" onClick={() => auth && signOut(auth).then(() => location.reload())}>{ar ? 'تسجيل الخروج' : 'Log out'}</Btn>
          ) : (
            <Link href="/login" className="mx-auto mt-10 flex w-fit items-center rounded-[14px] px-6 py-3 text-[17px] font-semibold" style={{ background: 'var(--primary-bg)', color: 'var(--primary-fg)' }}>{ar ? 'تسجيل الدخول' : 'Log in'}</Link>
          )}
        </Card>
      )}

      {view !== 'list' && back}

      {view === 'account' && (
        <>
          <Card>
            <p className="text-lg font-semibold">{me?.name || me?.email || me?.phone || (ar ? 'ضيف' : 'Guest')}</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{ar ? 'باقتك' : 'Your plan'}: {t(me?.plan || 'free')}</p>
            <p className="mt-3 rounded-[14px] bg-[#F3F3F3] p-3 text-sm text-black/70">{ar ? 'المجاني: دردشة بلا حدود • 3 تطبيقات تجريبية • تصاميم أساسية • معاينة مباشرة • ربط موقع واحد' : 'Free: unlimited chat • 3 trial apps • basic designs • live preview • 1 site connection'}</p>
            {[['pro', '$9.99', ar ? 'تطبيقات بلا حدود • صوت حقيقي • كاميرا ذكية • كل الربط • دومين • نشر فوري' : 'Unlimited apps • real voice • smart camera • all integrations • domain • instant publish'],
              ['ultra', '$24.99', ar ? 'كل الذكاءات • أولوية قصوى • فيديو 1080p • استنساخ الصوت' : 'All AIs • Ultra priority • 1080p video • voice clone']].map(([id, price, feats]) => (
              <div key={id} className="mt-3 rounded-[14px] border p-3" style={{ borderColor: 'var(--outline-border)' }}>
                <div className="flex justify-between font-semibold"><span>{t(id)}</span><span>{price}</span></div>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{feats}</p>
                <Btn v="green" onClick={() => pay(id, 'stripe')}>Card • Apple Pay • Google Pay</Btn>
                <div className="grid grid-cols-2 gap-2.5"><Btn v="grey" onClick={() => pay(id, 'benefitpay')}>BenefitPay</Btn><Btn v="grey" onClick={() => pay(id, 'paypal')}>PayPal</Btn></div>
              </div>
            ))}
          </Card>
          <Card>
            <p className="mb-2 font-semibold">{ar ? 'الربط' : 'Connections'}</p>
            {INTEGRATIONS.map(([id, name, kind]) => (
              <div key={id} className="border-b py-3" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">{name}{connected[id] ? <Icon name="check" size={16} className="text-[#16A34A]" /> : null}</span>
                  {connected[id] ? (
                    <button className="k-pill" onClick={() => run(() => api('/integrations/disconnect', { provider: id }))}>{ar ? 'فصل' : 'Disconnect'}</button>
                  ) : (
                    <button className="k-pill k-pill-on" onClick={() => run(async () => {
                      if (kind === 'oauth') { const r = await api<{ url: string }>('/integrations/start', { provider: id }); window.open(r.url, '_blank'); return; }
                      const key = (draft[`int_${id}`] || '').trim();
                      if (!key) { setDraft({ ...draft, [`open_${id}`]: '1' }); return; }
                      await api('/integrations/apikey', { provider: id, key });
                      setDraft({ ...draft, [`int_${id}`]: '', [`open_${id}`]: '' });
                    })}>{ar ? 'ربط' : 'Connect'}</button>
                  )}
                </div>
                {kind === 'apikey' && draft[`open_${id}`] && !connected[id] && <Input type="password" placeholder="API key" value={draft[`int_${id}`] || ''} onChange={(e) => setDraft({ ...draft, [`int_${id}`]: e.target.value })} />}
              </div>
            ))}
          </Card>
        </>
      )}

      {view === 'ai' && (
        <Card>
          <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>{ar ? 'الذكاء الافتراضي للمصنع والنقاش. تقدر تغيّره بأي وقت.' : 'Default AI for the builder and discussions. Change it anytime.'}</p>
          <div className="flex flex-wrap gap-2.5">{AIS.map(([id, name]) => <Pill key={id} on={ai === id} logo={id} onClick={() => { setAi(id); store.set('ai_engine', id); }}>{name}</Pill>)}</div>
          <p className="mb-1 mt-6 font-semibold">{t('keys')}</p>
          {BYOK.map(([id, name]) => (
            <div key={id} className="mt-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">{name}{keys[id] && <Icon name="check" size={16} className="text-[#16A34A]" />}</p>
              <div className="flex gap-2">
                <Input type="password" value={draft[id] || ''} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })} />
                <button className="k-pill k-pill-on mt-2.5" onClick={() => run(async () => { await api('/keys', { provider: id, key: draft[id] }); setDraft({ ...draft, [id]: '' }); })}>{t('save')}</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {view === 'notifications' && (
        <Card>
          {NOTIFS.map(([id, a, e]) => (
            <label key={id} className="flex items-center justify-between border-b py-4 text-[17px]" style={{ borderColor: 'var(--line)' }}>
              {ar ? a : e}
              <input type="checkbox" checked={!!notifs[id]} onChange={(ev) => { setNotifs({ ...notifs, [id]: ev.target.checked }); store.set(`notif_${id}`, ev.target.checked ? '1' : '0'); }} className="h-5 w-5 accent-[#4a78b5]" />
            </label>
          ))}
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>{ar ? 'الإشعارات توصل للجوال بعد ربط Firebase Cloud Messaging.' : 'Push notifications arrive once Firebase Cloud Messaging is connected.'}</p>
        </Card>
      )}

      {view === 'voice' && <VoiceCard />}

      {view === 'privacy' && (
        <>
          <Card>
            <p className="mb-2 font-semibold">{ar ? 'الأجهزة المسجلة' : 'Your devices'}</p>
            {devices.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>{ar ? 'ما في أجهزة للحين — سجّل دخول من التطبيق.' : 'No devices yet — sign in from the app.'}</p>}
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b py-3" style={{ borderColor: 'var(--line)' }}>
                <span className="flex items-center gap-2"><Icon name="smartphone" size={18} />{d.name}</span>
                <button aria-label="remove" onClick={() => run(() => api('/devices/remove', { deviceId: d.id }))}><Icon name="trash" size={18} /></button>
              </div>
            ))}
          </Card>
          <Card>
            <p className="font-semibold">{ar ? 'أسئلة الاسترجاع الذكية' : 'Smart recovery questions'}</p>
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Input value={qs[i]} onChange={(e) => setQs(qs.map((q, j) => (j === i ? e.target.value : q)))} />
                <Input type="password" placeholder={ar ? 'الجواب' : 'Answer'} value={as[i]} onChange={(e) => setAs(as.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
            <Btn onClick={() => run(async () => { await api('/security/questions', { questions: qs, answers: as }); setMsg(ar ? 'تم الحفظ' : 'Saved'); })}>{t('save')}</Btn>
            <Link href="/legal" className="mt-4 block text-center text-sm underline" style={{ color: 'var(--primary-fg)' }}>{ar ? 'سياسة الخصوصية والشروط' : 'Privacy policy & terms'}</Link>
          </Card>
        </>
      )}

      {view === 'appearance' && (
        <Card>
          <div className="grid grid-cols-2 gap-3">
            {([['dark', ar ? 'داكن (الأساسي)' : 'Dark (default)', '#0f0f0f', '#16a34a'], ['light', ar ? 'فاتح' : 'Light', '#ffffff', '#dce7f6']] as const).map(([id, label, bg, accent]) => (
              <button key={id} onClick={() => setAppearance(id)} className={`rounded-[18px] border-2 p-3 ${appearance === id ? 'border-[#4a78b5]' : 'border-[#d6d9de]'}`}>
                <div className="flex h-20 flex-col justify-between rounded-[12px] border p-2" style={{ background: bg, borderColor: '#d6d9de' }}>
                  <div className="h-3 w-3 rounded-[4px]" style={{ background: accent }} />
                  <div className="h-2 w-2/3 rounded" style={{ background: id === 'dark' ? '#ffffff' : '#e8f0fb' }} />
                </div>
                <p className="mt-2 font-semibold">{label}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {view === 'about' && (
        <Card>
          <p className="k-wordmark text-[30px]">{Brand.name(lang)}</p>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>{ar ? 'الإصدار' : 'Version'} 1.0.0</p>
          <div className="mt-4 space-y-2 text-[15px]">
            <p>{Brand.companyFull}</p>
            <p style={{ color: 'var(--muted)' }}>{Brand.company} • {ar ? 'المالك' : 'Owner'}: {Brand.owner}</p>
          </div>
          <Link href="/legal" className="mt-5 block text-sm underline" style={{ color: 'var(--primary-fg)' }}>{ar ? 'الشروط • الخصوصية • الدفع' : 'Terms • Privacy • Payment'}</Link>
        </Card>
      )}

      {view === 'danu' && <DanuSettings />}
    </Shell>
  );
}
