'use client';
import { useEffect, useRef, useState } from 'react';
import { Btn, Card } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { DEFAULT_VOICE, loadVoice, SAMPLES, saveVoice, speak, type VoiceSettings } from '@/lib/voice';
import { DEFAULT_GIRL, DIALECTS, type GirlSettings, loadGirl, playVoice, saveGirl, SPEEDS, STYLES, talk } from '@/lib/girl';

const CLONE_SECONDS = 30;

/** 🔊 Real voice settings: gender, accent, speed, pitch, volume, ▶ test, ✅ confirm, 30-second voice clone. */
export default function VoiceCard() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [saved, setSaved] = useState<VoiceSettings>(DEFAULT_VOICE);
  const [draft, setDraft] = useState<VoiceSettings>(DEFAULT_VOICE);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(-1);
  const [girl, setGirl] = useState<GirlSettings>(DEFAULT_GIRL);
  const [girlSaved, setGirlSaved] = useState<GirlSettings>(DEFAULT_GIRL);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { const v = loadVoice(); setSaved(v); setDraft(v); const g = loadGirl(); setGirl(g); setGirlSaved(g); return () => clearInterval(timer.current); }, []);

  async function testGirl() {
    setBusy('girl');
    const r = await talk('start', { ...girl, mode: 'chat' }, [], 0);
    const how = await playVoice(r.audio, r.text, girl, draft.volume);
    setNote(how === 'device' ? (ar ? 'معاينة بصوت جهازك — صوت البنت الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح.' : 'Device-voice preview — the real girl voice works once keys are connected.') : '');
    setBusy('');
  }
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (p: Partial<VoiceSettings>) => setDraft({ ...draft, ...p });

  async function test() {
    setBusy('test');
    const accent = draft.voice === 'auto' || draft.voice.startsWith('clone:') ? (ar ? 'bahraini' : 'en_us') : draft.voice;
    const how = await speak(SAMPLES[accent], draft, { lang: accent === 'bahraini' ? 'ar' : accent.slice(0, 2) });
    setNote(how === 'device' ? (ar ? 'هذي معاينة بصوت جهازك. الصوت البشري الحقيقي (ElevenLabs / OpenAI) يشتغل بعد ربط المفاتيح.' : 'Preview with your device voice. The real human voice (ElevenLabs / OpenAI) works once the keys are connected.') : '');
    setBusy('');
  }

  async function confirm() {
    await saveVoice(draft);
    setSaved(draft);
    setNote(ar ? '✅ تم اعتماد الصوت' : '✅ Voice saved');
  }

  async function startClone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        setBusy('clone');
        try {
          const b64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
          const { voiceId } = await api<{ voiceId: string }>('/voice/clone', { audio: b64, mime: blob.type, name: 'My voice', consent: true });
          const next = { ...draft, voice: `clone:${voiceId}` };
          setDraft(next);
          await saveVoice(next);
          setSaved(next);
          setNote(ar ? '✅ صوتك المستنسخ جاهز' : '✅ Your cloned voice is ready');
        } catch (e) {
          setNote(friendly(e, lang));
        }
        setBusy('');
      };
      rec.current = mr;
      mr.start();
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((s) => {
        if (s + 1 >= CLONE_SECONDS) stopClone();
        return s + 1;
      }), 1000);
    } catch {
      setNote(ar ? 'اسمح للمتصفح باستخدام المايك' : 'Allow microphone access in your browser');
    }
  }

  function stopClone() {
    clearInterval(timer.current);
    setElapsed(-1);
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  const pill = (on: boolean) => `rounded-full px-3.5 py-2 text-sm font-bold ${on ? 'bg-black text-white' : 'bg-[#E5E5E5] text-black'}`;
  const accents: [string, string][] = [
    ['auto', ar ? '🌐 تلقائي حسب لغتك' : '🌐 Auto by language'], ['bahraini', ar ? '🇧🇭 بحريني' : '🇧🇭 Bahraini Arabic'],
    ['en_us', '🇺🇸 English US'], ['en_uk', '🇬🇧 English UK'], ['fr', '🇫🇷 Français'], ['hi', '🇮🇳 हिन्दी'],
    ...(draft.voice.startsWith('clone:') ? [[draft.voice, ar ? '🎙️ صوتي' : '🎙️ My voice'] as [string, string]] : []),
  ];
  const slider = (label: string, key: 'speed' | 'pitch' | 'volume', min: number, max: number, step: number, show: string) => (
    <label className="mt-3 block text-sm font-semibold">
      {label}: {show}
      <input type="range" min={min} max={max} step={step} value={draft[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} className="mt-1 w-full accent-black" />
    </label>
  );

  return (
    <>
      <Card>
        <h2 className="text-lg font-extrabold">🔊 {ar ? 'الصوت' : 'Voice'}</h2>
        <p className="text-sm text-black/60">{ar ? 'صوت إنسان حقيقي — ElevenLabs و OpenAI' : 'Real human voice — ElevenLabs & OpenAI'}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => set({ gender: 'male' })} className={pill(draft.gender === 'male')}>👨 {ar ? 'رجالي' : 'Male'}</button>
          <button onClick={() => set({ gender: 'female' })} className={pill(draft.gender === 'female')}>👩 {ar ? 'نسائي' : 'Female'}</button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {accents.map(([id, label]) => <button key={id} onClick={() => set({ voice: id })} className={pill(draft.voice === id)}>{label}</button>)}
        </div>
        {draft.voice === 'auto' && <p className="mt-2 text-xs text-black/60">{ar ? 'تكتب عربي → يرد بحريني. تكتب إنجليزي → يرد إنجليزي.' : 'Write Arabic → Bahraini voice. Write English → English voice.'}</p>}
        <div className="mt-2.5 flex gap-2">
          <button onClick={() => set({ provider: 'elevenlabs' })} className={pill(draft.provider === 'elevenlabs')}>ElevenLabs</button>
          <button onClick={() => set({ provider: 'openai' })} className={pill(draft.provider === 'openai')}>OpenAI Voice</button>
        </div>
        {slider(ar ? 'السرعة' : 'Speed', 'speed', 0.5, 2, 0.1, `${draft.speed.toFixed(1)}x`)}
        {slider(ar ? 'طبقة الصوت' : 'Pitch', 'pitch', 0.5, 1.5, 0.05, draft.pitch.toFixed(2))}
        {slider(ar ? 'مستوى الصوت' : 'Volume', 'volume', 0, 1, 0.05, `${Math.round(draft.volume * 100)}%`)}
        <label className="mt-3 flex items-center justify-between text-sm font-semibold">
          {ar ? 'قراءة الردود تلقائياً' : 'Auto-read replies'}
          <input type="checkbox" checked={draft.autoRead} onChange={(e) => set({ autoRead: e.target.checked })} className="h-5 w-5 accent-[#16A34A]" />
        </label>
        <Btn onClick={test} disabled={busy === 'test'}>{busy === 'test' ? '…' : `▶ ${ar ? 'جرّب الصوت' : 'Test voice'}`}</Btn>
        <Btn v="green" onClick={confirm} disabled={!changed}>{ar ? '✅ اعتمد هذا الصوت' : '✅ Use this voice'}</Btn>
        {!changed && <p className="mt-1.5 text-center text-xs text-black/50">{ar ? 'هذا صوتك الحالي' : 'This is your current voice'}</p>}
        {note && <p className="mt-2 text-center text-sm text-black/60">{note}</p>}
      </Card>
      <Card>
        <h2 className="text-lg font-extrabold">👩 {ar ? 'صوت البنت' : 'Girl voice'}</h2>
        <p className="text-sm text-black/60">{ar ? 'بنت حقيقية بكل اللهجات العربية — للرد الصوتي والمحادثة والقصص والإعلانات.' : 'A real girl voice in every Arabic dialect — for voice replies, conversation, stories and ads.'}</p>
        <p className="mb-2 mt-3 text-sm font-bold">{ar ? 'اللهجة' : 'Dialect'}</p>
        <div className="flex flex-wrap gap-2">{DIALECTS.map(([id, a, e]) => <button key={id} onClick={() => setGirl({ ...girl, dialect: id })} className={pill(girl.dialect === id)}>{ar ? a : e}</button>)}</div>
        <p className="mb-2 mt-3 text-sm font-bold">{ar ? 'النوع' : 'Type'}</p>
        <div className="flex flex-wrap gap-2">{STYLES.map(([id, a, e]) => <button key={id} onClick={() => setGirl({ ...girl, style: id })} className={pill(girl.style === id)}>{ar ? a : e}</button>)}</div>
        <p className="mb-2 mt-3 text-sm font-bold">{ar ? 'السرعة' : 'Speed'}</p>
        <div className="flex flex-wrap gap-2">{SPEEDS.map(([id, a, e]) => <button key={id} onClick={() => setGirl({ ...girl, speed: id })} className={pill(girl.speed === id)}>{ar ? a : e}</button>)}</div>
        <Btn onClick={testGirl} disabled={busy === 'girl'}>{busy === 'girl' ? '…' : `▶ ${ar ? 'جرّب الصوت' : 'Test voice'}`}</Btn>
        <Btn v="green" disabled={JSON.stringify(girl) === JSON.stringify(girlSaved)} onClick={() => { saveGirl(girl); setGirlSaved(girl); setNote(ar ? '✅ تم اعتماد صوت البنت' : '✅ Girl voice saved'); }}>{ar ? '✅ اعتمد صوت البنت' : '✅ Use this girl voice'}</Btn>
      </Card>
      <Card>
        <h2 className="text-lg font-extrabold">🎙️ {ar ? 'استنسخ صوتي (30 ثانية)' : 'Clone my voice (30 sec)'}</h2>
        <p className="text-sm text-black/60">{ar ? 'اقرأ أي كلام بصوتك الطبيعي لمدة 30 ثانية في مكان هادئ. التسجيل يوقف لحاله.' : 'Read anything in your natural voice for 30 seconds in a quiet place. Recording stops by itself.'}</p>
        <label className="mt-3 flex items-center gap-3 rounded-[14px] bg-[#F3F3F3] p-3 text-sm font-semibold">
          <input type="checkbox" checked={consent} disabled={elapsed >= 0} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 accent-[#16A34A]" />
          {ar ? 'هذا صوتي وأوافق على استنساخه' : 'This is my voice and I consent to cloning it'}
        </label>
        {elapsed >= 0 && (
          <>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#E5E5E5]"><div className="h-full bg-black transition-all" style={{ width: `${(elapsed / CLONE_SECONDS) * 100}%` }} /></div>
            <p className="mt-1 text-center font-bold">🔴 {elapsed} / {CLONE_SECONDS}</p>
          </>
        )}
        <Btn disabled={!consent || busy === 'clone'} onClick={elapsed >= 0 ? stopClone : startClone}>
          {busy === 'clone' ? '…' : elapsed >= 0 ? `⏹ ${ar ? 'إيقاف' : 'Stop'}` : `🎙️ ${ar ? 'سجّل' : 'Record'} (30s)`}
        </Btn>
      </Card>
    </>
  );
}
