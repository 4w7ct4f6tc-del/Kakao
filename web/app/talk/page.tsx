'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Prank from '@/components/Prank';
import { Btn, Card, Input, Shell } from '@/components/ui';
import { api } from '@/lib/api';
import { DEFAULT_GIRL, DIALECTS, type GirlSettings, loadGirl, MODES, type Msg, playVoice, saveGirl, SPEEDS, stopSpeaking, STYLES, talk, type TalkReply } from '@/lib/girl';
import { useLang } from '@/lib/i18n';

type Status = 'idle' | 'thinking' | 'speaking' | 'listening';
const NUDGE_AFTER_MS = 15000;

/** Records until the user stops talking (voice-activity detection). Returns null if nothing was said. */
async function listenOnce(onLevel: (v: number) => void, stopRef: { current: (() => void) | null }): Promise<Blob | null> {
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
    let lastVoice = Date.now();
    const started = Date.now();
    const buf = new Float32Array(analyser.fftSize);
    const finish = () => {
      clearInterval(loop);
      if (rec.state === 'recording') rec.stop();
    };
    stopRef.current = finish;
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      stopRef.current = null;
      resolve(spoke && chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null);
    };
    const loop = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      onLevel(Math.min(1, rms * 12));
      if (rms > 0.025) { spoke = true; lastVoice = Date.now(); }
      const now = Date.now();
      if ((spoke && now - lastVoice > 1300) || (!spoke && now - started > 8000) || now - started > 30000) finish();
    }, 100);
    rec.start();
  });
}

export default function Talk() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const router = useRouter();
  const [s, setS] = useState<GirlSettings>(DEFAULT_GIRL);
  const [started, setStarted] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [level, setLevel] = useState(0);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
  const [prank, setPrank] = useState<TalkReply | null>(null);
  const [actions, setActions] = useState<{ build?: string; video?: string }>({});
  const strikes = useRef(0);
  const handsFree = useRef(false);
  const nudges = useRef(0);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout>>();
  const stopListening = useRef<(() => void) | null>(null);
  const msgsRef = useRef<Msg[]>([]);
  const sRef = useRef(s);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setS(loadGirl()); }, []);
  useEffect(() => { sRef.current = s; saveGirl(s); }, [s]);
  useEffect(() => () => { stopSpeaking(); stopListening.current?.(); clearTimeout(nudgeTimer.current); }, []);
  const setMessages = (m: Msg[]) => { msgsRef.current = m; setMsgs(m); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30); };

  const say = useCallback(async (r: TalkReply) => {
    setStatus('speaking');
    const how = await playVoice(r.audio, r.text, sRef.current);
    if (how === 'device') setNote(ar ? 'معاينة بصوت جهازك — صوت البنت الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح.' : 'Device-voice preview — the real girl voice (ElevenLabs) works once keys are connected.');
  }, [ar]);

  const armNudge = useCallback(() => {
    clearTimeout(nudgeTimer.current);
    if (nudges.current >= 2) return;
    nudgeTimer.current = setTimeout(() => { nudges.current++; turn('nudge'); }, NUDGE_AFTER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** One turn: she answers (text + real voice), handles prank/actions, then listens again in hands-free mode. */
  const turn = useCallback(async (event: 'start' | 'reply' | 'nudge') => {
    clearTimeout(nudgeTimer.current);
    setStatus('thinking');
    const r = await talk(event, sRef.current, msgsRef.current, strikes.current);
    if (r.settings) setS((prev) => ({ ...prev, ...r.settings }));
    setMessages([...msgsRef.current, { role: 'assistant', content: r.text }]);
    if (r.build || r.video) setActions({ build: r.build || undefined, video: r.video || undefined });
    if (r.action === 'insult') strikes.current = 1;
    await say(r);
    if (r.action === 'prank') {
      setPrank(r);
      return; // continues in onPrankDone
    }
    setStatus('idle');
    if (handsFree.current) listen();
    else armNudge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say, armNudge]);

  const onPrankDone = useCallback(async () => {
    const r = prank!;
    setPrank(null);
    strikes.current = 0;
    if (r.comebackText) {
      setMessages([...msgsRef.current, { role: 'assistant', content: r.comebackText }]);
      await say({ ...r, text: r.comebackText, audio: r.comebackAudio });
    }
    setStatus('idle');
    armNudge();
  }, [prank, say, armNudge]);

  async function sendText(content: string) {
    if (!content.trim()) return;
    stopSpeaking();
    nudges.current = 0;
    setMessages([...msgsRef.current, { role: 'user', content: content.trim() }]);
    await turn('reply');
  }

  /** Tap 🎤: interrupts her if she's talking, then listens until you stop speaking. */
  async function listen() {
    stopSpeaking();
    clearTimeout(nudgeTimer.current);
    if (status === 'listening') { stopListening.current?.(); return; }
    handsFree.current = true;
    setStatus('listening');
    let blob: Blob | null = null;
    try {
      blob = await listenOnce(setLevel, stopListening);
    } catch {
      handsFree.current = false;
      setStatus('idle');
      setNote(ar ? 'المايك مو متاح هنا — اكتب لها تحت وبترد عليك.' : 'Microphone not available here — type below and she will answer.');
      return;
    }
    setLevel(0);
    if (!blob) { setStatus('idle'); armNudge(); return; }
    setStatus('thinking');
    try {
      const b64 = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob!); });
      const { text: heard } = await api<{ text: string }>('/voice/stt', { audio: b64, format: 'webm' });
      if (heard.trim()) await sendText(heard);
      else setStatus('idle');
    } catch {
      handsFree.current = false;
      setStatus('idle');
      setNote(ar ? 'تحويل الصوت لكلام يحتاج مفتاح OpenAI — اكتب لها تحت.' : 'Speech-to-text needs the OpenAI key — type below.');
    }
  }

  function start() {
    setStarted(true);
    setMessages([]);
    strikes.current = 0;
    nudges.current = 0;
    turn('start');
  }

  async function test() {
    setStatus('speaking');
    const r = await talk('start', s, [], 0);
    await say(r);
    setStatus('idle');
  }

  const pill = (on: boolean) => `rounded-full px-3.5 py-2 text-sm font-bold ${on ? 'bg-black text-white' : 'bg-[#E5E5E5] text-black'}`;
  const dialectName = DIALECTS.find((d) => d[0] === s.dialect)?.[ar ? 1 : 2];
  const styleName = STYLES.find((x) => x[0] === s.style)?.[ar ? 1 : 2];
  const statusText = { idle: ar ? 'اضغط 🎤 وتكلم' : 'Tap 🎤 and talk', thinking: ar ? 'تفكر…' : 'Thinking…', speaking: ar ? 'تتكلم… اضغط 🎤 تقاطعها' : 'Talking… tap 🎤 to interrupt', listening: ar ? 'أسمعك…' : 'Listening…' }[status];

  const dialectChips = (
    <div className="flex flex-wrap gap-2">
      {DIALECTS.map(([id, a, e]) => <button key={id} onClick={() => { setS({ ...s, dialect: id }); setPicker(false); }} className={pill(s.dialect === id)}>{ar ? a : e}</button>)}
    </div>
  );

  return (
    <Shell>
      {prank && <Prank onDone={onPrankDone} />}
      {!started ? (
        <Card>
          <h2 className="text-lg font-extrabold">🎤 {ar ? 'تكلم مع بنت خعخعو' : 'Talk with the KAkAo girl'}</h2>
          <p className="text-sm text-black/60">{ar ? 'بنت حقيقية الصوت، شديدة وحنونة ومشاغبة. اختار قبل ما تبدأ:' : 'A real girl voice — strict, sweet and mischievous. Choose before you start:'}</p>
          <p className="mb-2 mt-4 text-sm font-bold">1. {ar ? 'اللهجة' : 'Dialect'}</p>
          {dialectChips}
          <p className="mb-2 mt-4 text-sm font-bold">2. {ar ? 'نوع البنت' : 'Voice type'}</p>
          <div className="flex flex-wrap gap-2">{STYLES.map(([id, a, e]) => <button key={id} onClick={() => setS({ ...s, style: id })} className={pill(s.style === id)}>{ar ? a : e}</button>)}</div>
          <p className="mb-2 mt-4 text-sm font-bold">3. {ar ? 'سرعة الكلام' : 'Speed'}</p>
          <div className="flex flex-wrap gap-2">{SPEEDS.map(([id, a, e]) => <button key={id} onClick={() => setS({ ...s, speed: id })} className={pill(s.speed === id)}>{ar ? a : e}</button>)}</div>
          <p className="mb-2 mt-4 text-sm font-bold">4. {ar ? 'الوضع' : 'Mode'}</p>
          <div className="flex flex-wrap gap-2">{MODES.map(([id, a, e]) => <button key={id} onClick={() => setS({ ...s, mode: id })} className={pill(s.mode === id)}>{ar ? a : e}</button>)}</div>
          <Btn v="grey" onClick={test} disabled={status !== 'idle'}>{status === 'speaking' || status === 'thinking' ? '…' : `▶ ${ar ? 'جرّب الصوت' : 'Test voice'}`}</Btn>
          <Btn v="green" onClick={start}>🎤 {ar ? 'تكلم' : 'Talk'}</Btn>
          {note && <p className="mt-2 text-center text-xs text-black/60">{note}</p>}
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{dialectName} • {styleName} • {MODES.find((m) => m[0] === s.mode)?.[ar ? 1 : 2]}</p>
              <button onClick={() => setPicker(!picker)} className="rounded-full bg-black px-3.5 py-2 text-sm font-bold text-white">{ar ? 'غيري اللهجة' : 'Change dialect'}</button>
            </div>
            {picker && <div className="mt-3">{dialectChips}</div>}
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <p className={`max-w-[85%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 leading-7 ${m.role === 'user' ? 'bg-black text-white' : 'bg-[#F3F3F3] text-black'}`}>{m.content}</p>
                </div>
              ))}
              <div ref={end} />
            </div>
            {(actions.build || actions.video) && (
              <div className="grid grid-cols-2 gap-2.5">
                {actions.build && <Btn v="green" onClick={() => router.push(`/builder?prompt=${encodeURIComponent(actions.build!)}`)}>✨ {ar ? 'افتح المصنع' : 'Open builder'}</Btn>}
                {actions.video && <Btn v="green" onClick={() => router.push('/video')}>🎬 {ar ? 'افتح الفيديو' : 'Open video'}</Btn>}
              </div>
            )}
          </Card>
          <Card className="text-center">
            <button
              onClick={listen}
              aria-label={ar ? 'تكلم' : 'Talk'}
              className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-4xl transition ${status === 'listening' ? 'bg-[#16A34A] text-white' : 'bg-black text-white'}`}
              style={{ boxShadow: status === 'listening' ? `0 0 0 ${6 + level * 22}px rgba(22,163,74,0.25)` : status === 'speaking' ? '0 0 0 8px rgba(0,0,0,0.12)' : 'none' }}
            >
              🎤
            </button>
            <p className="mt-3 text-sm font-semibold text-black/70">{statusText}</p>
            <div className="mt-2 flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { sendText(text); setText(''); } }} placeholder={ar ? 'أو اكتب لها…' : 'Or type to her…'} />
              <button onClick={() => { handsFree.current = false; sendText(text); setText(''); }} className="mt-2.5 rounded-[14px] bg-black px-4 font-bold text-white">↑</button>
            </div>
            {note && <p className="mt-2 text-xs text-black/60">{note}</p>}
            <Btn v="grey" onClick={() => { stopSpeaking(); stopListening.current?.(); clearTimeout(nudgeTimer.current); handsFree.current = false; setStarted(false); setStatus('idle'); }}>{ar ? 'إنهاء المكالمة' : 'End conversation'}</Btn>
          </Card>
        </>
      )}
    </Shell>
  );
}
