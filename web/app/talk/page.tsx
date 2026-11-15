'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Prank from '@/components/Prank';
import { Btn, Card, Input, Shell } from '@/components/ui';
import { api } from '@/lib/api';
import {
  DEFAULT_GIRL, DIALECTS, discuss, type DMsg, type DanuReply, type GirlSettings, loadGirl, MODES, playVoice, saveGirl, SPEEDS, stopSpeaking, STYLES,
} from '@/lib/girl';
import { useLang } from '@/lib/i18n';

type Status = 'idle' | 'thinking' | 'speaking' | 'listening';
const NUDGE_AFTER_MS = 15000;
const AIS: [string, string][] = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['meta', 'Meta'], ['gemini', 'Gemini']];

/** Records until the user stops talking. Reports whether they raised their voice. */
async function listenOnce(onLevel: (v: number) => void, stopRef: { current: (() => void) | null }): Promise<{ blob: Blob; loud: boolean } | null> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  return new Promise((resolve) => {
    let spoke = false;
    let loudFrames = 0;
    let lastVoice = Date.now();
    const started = Date.now();
    const buf = new Float32Array(analyser.fftSize);
    const finish = () => { clearInterval(loop); if (rec.state === 'recording') rec.stop(); };
    stopRef.current = finish;
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      stopRef.current = null;
      resolve(spoke && chunks.length ? { blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), loud: loudFrames >= 4 } : null);
    };
    const loop = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      onLevel(Math.min(1, rms * 12));
      if (rms > 0.025) { spoke = true; lastVoice = Date.now(); }
      if (rms > 0.3) loudFrames++;
      const now = Date.now();
      if ((spoke && now - lastVoice > 1300) || (!spoke && now - started > 8000) || now - started > 30000) finish();
    }, 100);
    rec.start();
  });
}

/**
 * نقاش — AI 1 chats and thinks with you ("اقتراح مني / اقتراح منك").
 * 📞 اتصلوا حق دانو → دانو joins: a three-way voice discussion in her dialect (default Bahraini Riffa).
 */
export default function Discuss() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const router = useRouter();
  const [engine, setEngine] = useState('claude');
  const [s, setS] = useState<GirlSettings>(DEFAULT_GIRL);
  const [msgs, setMsgs] = useState<DMsg[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState('');
  const [setup, setSetup] = useState(false);
  const [call, setCall] = useState(false);
  const [picker, setPicker] = useState(false);
  const [prank, setPrank] = useState<DanuReply | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [actions, setActions] = useState<{ build?: string; video?: string }>({});
  const st = useRef({ strikes: 0, familyAsks: 0, loud: false, turns: 0 });
  const callRef = useRef(false);
  const handsFree = useRef(false);
  const nudges = useRef(0);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout>>();
  const stopListening = useRef<(() => void) | null>(null);
  const msgsRef = useRef<DMsg[]>([]);
  const sRef = useRef(s);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setS({ ...DEFAULT_GIRL, ...loadGirl() }); }, []);
  useEffect(() => { sRef.current = s; saveGirl(s); }, [s]);
  useEffect(() => () => { stopSpeaking(); stopListening.current?.(); clearTimeout(nudgeTimer.current); }, []);
  const push = (m: DMsg) => { msgsRef.current = [...msgsRef.current, m]; setMsgs(msgsRef.current); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30); };

  const voiceNote = useCallback(() => setNote(ar ? 'معاينة بصوت جهازك — صوت دانو الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح.' : 'Device-voice preview — Danu\'s real voice (ElevenLabs) works once keys are connected.'), [ar]);

  const armNudge = useCallback(() => {
    clearTimeout(nudgeTimer.current);
    if (!callRef.current || nudges.current >= 2) return;
    nudgeTimer.current = setTimeout(() => { nudges.current++; turn('nudge'); }, NUDGE_AFTER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hangUp(text?: string | null) {
    stopSpeaking();
    stopListening.current?.();
    clearTimeout(nudgeTimer.current);
    handsFree.current = false;
    callRef.current = false;
    setCall(false);
    setStatus('idle');
    if (text !== undefined) setSummary(text || (ar ? 'انتهت المكالمة.' : 'Call ended.'));
  }

  /** One round: AI 1 answers; on a call دانو answers after it, with her real voice. */
  const turn = useCallback(async (event: 'reply' | 'join' | 'nudge') => {
    clearTimeout(nudgeTimer.current);
    setStatus('thinking');
    const r = await discuss(event, callRef.current, sRef.current, msgsRef.current, st.current, engine);
    if (r.ai1) push({ role: 'ai1', content: r.ai1.text });
    const d = r.danu;
    if (!d) { setStatus('idle'); return; }
    st.current.turns++;
    st.current.loud = false;
    push({ role: 'danu', content: d.text });
    if (d.build || d.video) setActions({ build: d.build || undefined, video: d.video || undefined });
    if (d.action === 'insult') st.current.strikes = 1;
    if (d.family) st.current.familyAsks++;
    setStatus('speaking');
    if ((await playVoice(d.audio, d.text, sRef.current)) === 'device') voiceNote();
    if (d.hangup) { hangUp(d.summary); return; }
    if (d.action === 'prank') { setPrank(d); return; }
    setStatus('idle');
    if (handsFree.current && callRef.current) listen();
    else armNudge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, voiceNote, armNudge]);

  const onPrankDone = useCallback(async () => {
    const d = prank!;
    setPrank(null);
    st.current.strikes = 0;
    if (d.comebackText) {
      push({ role: 'danu', content: d.comebackText });
      setStatus('speaking');
      await playVoice(d.comebackAudio, d.comebackText, sRef.current);
    }
    setStatus('idle');
    armNudge();
  }, [prank, armNudge]);

  async function send(content: string) {
    if (!content.trim() || status === 'thinking') return;
    stopSpeaking();
    nudges.current = 0;
    push({ role: 'user', content: content.trim() });
    await turn('reply');
  }

  /** 🎤 interrupts دانو if she is talking, then listens until you stop. */
  async function listen() {
    stopSpeaking();
    clearTimeout(nudgeTimer.current);
    if (status === 'listening') { stopListening.current?.(); return; }
    handsFree.current = true;
    setStatus('listening');
    let got: { blob: Blob; loud: boolean } | null = null;
    try {
      got = await listenOnce(setLevel, stopListening);
    } catch {
      handsFree.current = false;
      setStatus('idle');
      setNote(ar ? 'المايك مو متاح هنا — اكتب تحت وبيردون عليك.' : 'Microphone not available here — type below.');
      return;
    }
    setLevel(0);
    if (!got) { setStatus('idle'); armNudge(); return; }
    st.current.loud = got.loud;
    setStatus('thinking');
    try {
      const b64 = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(got!.blob); });
      const { text: heard } = await api<{ text: string }>('/voice/stt', { audio: b64, format: 'webm' });
      if (heard.trim()) await send(heard);
      else setStatus('idle');
    } catch {
      handsFree.current = false;
      setStatus('idle');
      setNote(ar ? 'تحويل الصوت لكلام يحتاج مفتاح OpenAI — اكتب تحت.' : 'Speech-to-text needs the OpenAI key — type below.');
    }
  }

  function startCall() {
    setSetup(false);
    setSummary(null);
    st.current = { strikes: 0, familyAsks: 0, loud: false, turns: 0 };
    nudges.current = 0;
    callRef.current = true;
    setCall(true);
    turn('join');
  }

  async function testVoice() {
    setStatus('speaking');
    const r = await discuss('join', true, s, [], { strikes: 0, familyAsks: 0, loud: false, turns: 0 }, engine);
    if (r.danu && (await playVoice(r.danu.audio, r.danu.text, s)) === 'device') voiceNote();
    setStatus('idle');
  }

  const pill = (on: boolean) => `rounded-full px-3.5 py-2 text-sm font-bold ${on ? 'bg-black text-white' : 'bg-[#E5E5E5] text-black'}`;
  const name = (list: [string, string, string][] | [string, string, string, number][], id: string) => list.find((x) => x[0] === id)?.[ar ? 1 : 2];
  const statusText = { idle: ar ? 'اضغط 🎤 وتكلم' : 'Tap 🎤 and talk', thinking: ar ? 'يفكرون…' : 'Thinking…', speaking: ar ? 'دانو تتكلم… اضغط 🎤 تقاطعها' : 'Danu is talking… tap 🎤 to interrupt', listening: ar ? 'أسمعك…' : 'Listening…' }[status];
  const dialectChips = <div className="flex flex-wrap gap-2">{DIALECTS.map(([id, a, e]) => <button key={id} onClick={() => { setS({ ...s, dialect: id }); setPicker(false); }} className={pill(s.dialect === id)}>{ar ? a : e}</button>)}</div>;
  const label = { user: ar ? 'أنت' : 'You', ai1: ar ? '🤖 المساعد' : '🤖 Assistant', danu: ar ? '📞 دانو' : '📞 Danu' };

  return (
    <Shell>
      {prank && <Prank onDone={onPrankDone} />}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">💬 {ar ? 'ناقش فكرتك' : 'Discuss your idea'}</h2>
          {call ? (
            <button onClick={() => hangUp(null)} className="rounded-full bg-[#DC2626] px-3.5 py-2 text-sm font-bold text-white">{ar ? 'إنهاء المكالمة' : 'End call'}</button>
          ) : (
            <button onClick={() => setSetup(!setup)} className="rounded-full bg-[#16A34A] px-3.5 py-2 text-sm font-bold text-white">📞 {ar ? 'اتصلوا حق دانو' : 'Call Danu'}</button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{AIS.map(([id, n]) => <button key={id} onClick={() => setEngine(id)} className={pill(engine === id)}>{n}</button>)}</div>
        <p className="mt-2 text-xs text-black/60">
          {call ? (ar ? `مكالمة ثلاثية: أنت + المساعد + دانو • ${name(DIALECTS, s.dialect)} • ${name(STYLES, s.style)}` : `Three-way call: you + assistant + Danu • ${name(DIALECTS, s.dialect)} • ${name(STYLES, s.style)}`)
            : (ar ? 'المساعد يفكر معاك: يأكد فكرتك أو يعدلها، ويعطيك اقتراح منه ويسألك عن اقتراحك.' : 'The assistant thinks with you: confirms or improves your idea, suggests, and asks for yours.')}
        </p>
        {call && (
          <div className="mt-2 flex justify-end">
            <button onClick={() => setPicker(!picker)} className="rounded-full bg-black px-3.5 py-2 text-sm font-bold text-white">{ar ? 'غيري اللهجة' : 'Change dialect'}</button>
          </div>
        )}
        {picker && <div className="mt-3">{dialectChips}</div>}
      </Card>

      {setup && !call && (
        <Card>
          <h3 className="font-extrabold">📞 {ar ? 'قبل لا تتصل بدانو' : 'Before you call Danu'}</h3>
          <p className="text-sm text-black/60">{ar ? 'دانو — بنت الرفاع: شديدة وحنونة ومشاغبة، وأذكى وحدة في المكالمة.' : 'Danu — a girl from Riffa: strict, sweet, mischievous, and the smartest one on the call.'}</p>
          <p className="mb-2 mt-3 text-sm font-bold">1. {ar ? 'اللهجة' : 'Dialect'}</p>
          {dialectChips}
          <p className="mb-2 mt-3 text-sm font-bold">2. {ar ? 'نوع البنت' : 'Voice type'}</p>
          <div className="flex flex-wrap gap-2">{STYLES.map(([id, a, e]) => <button key={id} onClick={() => setS({ ...s, style: id })} className={pill(s.style === id)}>{ar ? a : e}</button>)}</div>
          <p className="mb-2 mt-3 text-sm font-bold">3. {ar ? 'سرعة الكلام' : 'Speed'}</p>
          <div className="flex flex-wrap gap-2">{SPEEDS.map(([id, a, e]) => <button key={id} onClick={() => setS({ ...s, speed: id })} className={pill(s.speed === id)}>{ar ? a : e}</button>)}</div>
          <p className="mb-2 mt-3 text-sm font-bold">4. {ar ? 'الوضع' : 'Mode'}</p>
          <div className="flex flex-wrap gap-2">{MODES.map(([id, a, e]) => <button key={id} onClick={() => setS({ ...s, mode: id })} className={pill(s.mode === id)}>{ar ? a : e}</button>)}</div>
          <label className="mt-3 flex items-center justify-between rounded-[14px] bg-[#F3F3F3] p-3 text-sm font-semibold">
            {ar ? 'لدغة رفاعية خفيفة (ر ← و في الصوت)' : 'Light Riffa lisp (R → W in speech)'}
            <input type="checkbox" checked={s.lisp !== false} onChange={(e) => setS({ ...s, lisp: e.target.checked })} className="h-5 w-5 accent-[#16A34A]" />
          </label>
          <Btn v="grey" onClick={testVoice} disabled={status !== 'idle'}>{status !== 'idle' ? '…' : `▶ ${ar ? 'جرّب الصوت' : 'Test voice'}`}</Btn>
          <Btn v="green" onClick={startCall}>📞 {ar ? 'اتصل' : 'Call'}</Btn>
        </Card>
      )}

      <Card>
        <div className="max-h-[460px] space-y-2.5 overflow-y-auto">
          {msgs.length === 0 && <p className="py-6 text-center text-sm text-black/50">{ar ? 'اكتب فكرتك… مثال: أبي تطبيق لمحل ورد' : 'Write your idea… e.g. I want an app for a flower shop'}</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <span className="mb-0.5 text-[11px] font-bold text-black/50">{label[m.role]}</span>
              <p className={`max-w-[88%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 leading-7 ${m.role === 'user' ? 'bg-black text-white' : m.role === 'danu' ? 'bg-[#E8F7EE] text-black' : 'bg-[#F3F3F3] text-black'}`}>{m.content}</p>
            </div>
          ))}
          <div ref={end} />
        </div>
        {summary !== null && (
          <div className="mt-3 rounded-[14px] border border-[#E5E5E5] p-3">
            <p className="text-sm font-extrabold">📋 {ar ? 'زبدة المكالمة' : 'Call summary'}</p>
            <p className="mt-1 text-sm text-black/70">{summary}</p>
          </div>
        )}
        {(actions.build || actions.video) && (
          <div className="grid grid-cols-2 gap-2.5">
            {actions.build && <Btn v="green" onClick={() => router.push(`/builder?prompt=${encodeURIComponent(actions.build!)}`)}>✨ {ar ? 'افتح المصنع' : 'Open builder'}</Btn>}
            {actions.video && <Btn v="green" onClick={() => router.push('/video')}>🎬 {ar ? 'افتح الفيديو' : 'Open video'}</Btn>}
          </div>
        )}
        {call && (
          <div className="mt-4 text-center">
            <button
              onClick={listen}
              aria-label={ar ? 'تكلم' : 'Talk'}
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white transition ${status === 'listening' ? 'bg-[#16A34A]' : 'bg-black'}`}
              style={{ boxShadow: status === 'listening' ? `0 0 0 ${6 + level * 22}px rgba(22,163,74,0.25)` : status === 'speaking' ? '0 0 0 8px rgba(0,0,0,0.12)' : 'none' }}
            >
              🎤
            </button>
            <p className="mt-2 text-sm font-semibold text-black/70">{statusText}</p>
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { handsFree.current = false; send(text); setText(''); } }} placeholder={call ? (ar ? 'تكلم أو اكتب…' : 'Talk or type…') : (ar ? 'اكتب فكرتك…' : 'Write your idea…')} />
          <button onClick={() => { handsFree.current = false; send(text); setText(''); }} className="mt-2.5 rounded-[14px] bg-black px-4 font-bold text-white" aria-label="send">↑</button>
        </div>
        {status === 'thinking' && <div className="mt-2 h-1 w-16 animate-pulse rounded bg-[#16A34A]" />}
        {note && <p className="mt-2 text-center text-xs text-black/60">{note}</p>}
      </Card>
    </Shell>
  );
}
