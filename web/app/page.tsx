'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Logo, Shell } from '@/components/ui';
import { api } from '@/lib/api';
import { looksLikeAppRequest } from '@/lib/design';
import { useLang } from '@/lib/i18n';

type Msg = { role: 'user' | 'assistant'; content: string; engine?: string };
const ENGINES = [
  ['auto', '✨', 'Auto', ''],
  ['chatgpt', '🟢', 'ChatGPT', 'writing'],
  ['claude', '🟠', 'Claude', 'coding'],
  ['meta', '🔵', 'Meta AI', 'free & fast'],
  ['gemini', '🔷', 'Gemini', 'images / video'],
];

/** Home = the ONE box. Same conversation continues when you switch AI. */
export default function Home() {
  const { t, lang, observe } = useLang();
  const router = useRouter();
  const [engine, setEngine] = useState('auto');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function send(override?: string) {
    const content = (override ?? text).trim();
    if (!content) return;
    setText('');
    observe(content);
    const history: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(history);
    setBusy(true);
    try {
      const r = await api<{ text: string; engine: string }>('/ai/chat', { engine, lang, messages: history });
      setMsgs([...history, { role: 'assistant', content: r.text, engine: r.engine }]);
    } catch {
      const ar = lang === 'ar';
      const fallback = looksLikeAppRequest(content)
        ? ar ? 'تمام! اضغط "ابنِ هذا التطبيق" وبنكمل بثلاث أسئلة بسيطة.' : 'Great! Tap "Build this app" and we will finish with 3 quick questions.'
        : ar ? 'وصلتني رسالتك ✅ تقدر الحين: 1) تبني تطبيق 2) تحوّل قصة لفيديو 3) تربط مفاتيح الذكاء من الإعدادات.' : 'Got it ✅ You can now: 1) build an app 2) turn a story into a video 3) connect AI keys in Settings.';
      setMsgs([...history, { role: 'assistant', content: fallback, engine: 'offline' }]);
    }
    setBusy(false);
    setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function speak(content: string) {
    try {
      const r = await api<{ audio: string }>('/voice/tts', { text: content, voice: 'female', lang });
      new Audio(`data:audio/mpeg;base64,${r.audio}`).play();
    } catch {
      const u = new SpeechSynthesisUtterance(content);
      u.lang = lang;
      speechSynthesis.speak(u);
    }
  }

  const build = (p: string) => router.push(`/builder?prompt=${encodeURIComponent(p)}`);
  const ideas = lang === 'ar' ? ['أبي تطبيق لمحل ملابس', 'أبي تطبيق لمطعم', 'أبي موقع لصالون'] : ['I want an app for a clothes shop', 'I want a restaurant app', 'I want a salon website'];

  return (
    <Shell>
      <div className="flex gap-2 overflow-x-auto py-2">
        {ENGINES.map(([id, icon, name, desc]) => (
          <button key={id} title={desc} onClick={() => setEngine(id)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm ${engine === id ? 'border-accent bg-accent' : 'border-[#333]'}`}>
            {icon} {id === 'auto' ? (lang === 'ar' ? 'تلقائي' : name) : name}
          </button>
        ))}
      </div>

      {msgs.length === 0 ? (
        <div className="py-16 text-center">
          <Logo size={72} />
          <h1 className="mt-4 text-3xl font-extrabold">{t('welcome')}</h1>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {ideas.map((i) => <button key={i} onClick={() => build(i)} className="rounded-full border border-[#444] px-4 py-2 text-sm hover:border-accent">{i}</button>)}
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[560px] whitespace-pre-wrap rounded-2xl p-3.5 leading-7 ${m.role === 'user' ? 'bg-white text-black' : 'bg-surface'}`}>
                {m.content}
                {m.role === 'assistant' && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>{m.engine}</span>
                    <button onClick={() => speak(m.content)}>🔊 {t('listen')}</button>
                    <button onClick={() => navigator.clipboard.writeText(m.content)}>📋 {t('copy')}</button>
                    {i > 0 && looksLikeAppRequest(msgs[i - 1].content) && (
                      <button onClick={() => build(msgs[i - 1].content)} className="rounded-lg bg-accent px-3 py-1.5 font-bold text-white">✨ {t('buildThis')}</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="h-1 w-16 animate-pulse rounded bg-accent" />}
          <div ref={end} />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="sticky bottom-20 mt-4 flex items-end gap-2 rounded-[28px] bg-surface p-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={t('hint')} className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none placeholder:text-muted" />
        <button disabled={busy} className="h-11 w-11 rounded-full bg-accent text-xl font-bold disabled:opacity-40">↑</button>
      </form>
    </Shell>
  );
}
