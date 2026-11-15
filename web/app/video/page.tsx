'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Shell } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { useLang } from '@/lib/i18n';

type Scene = { narration: string; imageUrl?: string; emoji?: string };
type Job = { status: string; progress: number; videoUrl?: string; scenes: Scene[]; error?: string };

export default function VideoPage() {
  const { t, lang, observe } = useLang();
  const [story, setStory] = useState('');
  const [long, setLong] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [board, setBoard] = useState<Scene[]>([]);
  const [msg, setMsg] = useState('');
  const [playing, setPlaying] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => () => clearInterval(timer.current), []);

  async function make() {
    if (story.trim().length < 10) return;
    observe(story);
    setMsg('');
    // Instant storyboard so the user never waits on an empty screen.
    const parts = story.split(/(?<=[.!؟?])\s+|\n+/).filter(Boolean);
    setBoard(parts.slice(0, 10).map((p, i) => ({ narration: p, emoji: ['🌅', '🚶', '🏙️', '💡', '⚡', '❤️', '🌙', '🎉', '🌊', '🏁'][i] })));
    try {
      const { id } = await api<{ id: string }>('/video/create', { story, lang, length: long ? 'long' : 'short' });
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        const j = await api<Job>(`/video/status?id=${id}`).catch(() => null);
        if (!j) return;
        setJob(j);
        if (j.scenes?.length) setBoard(j.scenes);
        if (j.status === 'done' || j.status === 'error') clearInterval(timer.current);
      }, 3000);
    } catch (e) {
      setMsg(friendly(e, lang));
    }
  }

  async function playBoard() {
    for (let i = 0; i < board.length; i++) {
      setPlaying(i);
      await new Promise<void>((res) => {
        const u = new SpeechSynthesisUtterance(board[i].narration);
        u.lang = lang;
        u.onend = () => res();
        u.onerror = () => res();
        speechSynthesis.speak(u);
      });
    }
    setPlaying(-1);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl py-4">
        <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={6} placeholder={t('story')} className="w-full rounded-2xl bg-surface p-4 outline-none placeholder:text-muted" />
        <div className="my-3 flex gap-2">
          <button onClick={() => setLong(false)} className={`rounded-xl px-4 py-2 ${!long ? 'bg-accent' : 'bg-surface'}`}>{t('short')}</button>
          <button onClick={() => setLong(true)} className={`rounded-xl px-4 py-2 ${long ? 'bg-accent' : 'bg-surface'}`}>{t('long')}</button>
        </div>
        <Button accent onClick={make}>🎬 {t('makeVideo')}</Button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
        {job && job.status !== 'done' && (
          <div className="my-4">
            <p className="mb-2">{job.status}… {job.progress}%</p>
            <div className="h-2.5 overflow-hidden rounded bg-surface"><div className="h-full bg-accent transition-all" style={{ width: `${job.progress}%` }} /></div>
            {job.error && <p className="mt-2 text-sm text-muted">{job.error}</p>}
          </div>
        )}
        {job?.videoUrl && (
          <div className="my-4">
            <video src={job.videoUrl} controls className="w-full rounded-2xl" />
            <a href={job.videoUrl} download className="mt-2 block text-center text-accent underline">⬇️ MP4</a>
          </div>
        )}
        {board.length > 0 && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">{t('storyboard')} • {board.length}</h2>
              <button onClick={playBoard} className="h-11 w-11 rounded-full bg-accent text-xl">▶</button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {board.map((s, i) => (
                <div key={i} className={`overflow-hidden rounded-2xl bg-surface ring-2 ${playing === i ? 'ring-accent' : 'ring-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.imageUrl ? <img src={s.imageUrl} alt="" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-[#222] text-6xl">{s.emoji || '🎬'}</div>}
                  <p className="p-3 leading-7">{s.narration}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
