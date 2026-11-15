'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { Btn, Card, Shell, TextArea } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { detectLang, useLang } from '@/lib/i18n';
import { loadVoice, speak } from '@/lib/voice';

type Scene = { narration: string; imageUrl?: string; emoji?: string };
type Job = { status: string; progress: number; videoUrl?: string; scenes: Scene[]; error?: string };

export default function VideoPage() {
  const { t, lang, observe } = useLang();
  const ar = lang === 'ar';
  const [story, setStory] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [board, setBoard] = useState<Scene[]>([]);
  const [msg, setMsg] = useState('');
  const [playing, setPlaying] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => () => clearInterval(timer.current), []);

  async function make() {
    if (story.trim().length < 10) { setMsg(ar ? 'اكتب قصة أطول شوي' : 'Write a slightly longer story'); return; }
    observe(story);
    setMsg('');
    setJob(null);
    // Instant storyboard while the real 1080p video renders.
    setBoard(story.split(/(?<=[.!؟?])\s+|\n+/).filter(Boolean).slice(0, 10).map((p) => ({ narration: p })));
    try {
      const { id } = await api<{ id: string }>('/video/create', { story, lang, length: 'short', voice: loadVoice().voice, gender: loadVoice().gender });
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

  async function play() {
    const v = loadVoice();
    for (let i = 0; i < board.length; i++) {
      setPlaying(i);
      await speak(board[i].narration, v, { lang: detectLang(board[i].narration) || lang, followLanguage: true });
    }
    setPlaying(-1);
  }

  return (
    <Shell>
      <Card>
        <TextArea rows={6} value={story} onChange={(e) => setStory(e.target.value)} placeholder={t('storyPh')} />
        <Btn icon="film" onClick={make}>{t('makeVideo2')}</Btn>
        {msg && <p className="mt-2 text-sm text-black/60">{msg}</p>}
        {job && job.status !== 'done' && (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-[#E5E5E5]"><div className="h-full bg-[#16A34A] transition-all" style={{ width: `${job.progress}%` }} /></div>
            <p className="mt-1 text-center text-xs text-black/60">{job.status} • {job.progress}%</p>
            {job.error && <p className="mt-1 text-sm text-black/60">{job.error}</p>}
          </div>
        )}
        {job?.videoUrl && (
          <>
            <p className="mt-4 flex items-center justify-center gap-2 text-lg font-extrabold"><Icon name="checkCircle" className="text-[#16A34A]" />{t('videoDone')}</p>
            <video src={job.videoUrl} controls className="mt-2 w-full rounded-[14px]" />
            <Btn v="grey" icon="download" onClick={() => window.open(job.videoUrl, '_blank')}>MP4</Btn>
          </>
        )}
      </Card>
      {board.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <b>{t('storyboard')} • {board.length}</b>
            <button onClick={play} className="k-pill k-pill-on"><Icon name="play" size={14} />{ar ? 'شغّل' : 'Play'}</button>
          </div>
          <div className="mt-3 space-y-2.5">
            {board.map((s, i) => (
              <div key={i} className={`overflow-hidden rounded-[14px] bg-[#F3F3F3] ring-2 ${playing === i ? 'ring-[#16A34A]' : 'ring-transparent'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.imageUrl ? <img src={s.imageUrl} alt="" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-[#222] text-white/50"><Icon name="film" size={40} /></div>}
                <p className="p-3 text-sm leading-7">{s.narration}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Shell>
  );
}
