'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Btn, Card, Pill } from '@/components/ui';
import { DEFAULT_GIRL, DIALECTS, discuss, type GirlSettings, loadGirl, MODES, playVoice, saveGirl, SPEEDS, STYLES } from '@/lib/girl';
import { useLang } from '@/lib/i18n';

/** Settings → Danu: her dialect (default Bahraini Riffa), type, speed, mode, lisp, test, call. */
export default function DanuSettings() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const router = useRouter();
  const [g, setG] = useState<GirlSettings>(DEFAULT_GIRL);
  const [saved, setSaved] = useState<GirlSettings>(DEFAULT_GIRL);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { const x = { ...DEFAULT_GIRL, ...loadGirl() }; setG(x); setSaved(x); }, []);

  async function test() {
    setBusy(true);
    const r = await discuss('join', true, g, [], { strikes: 0, familyAsks: 0, loud: false, turns: 0 });
    if (r.danu && (await playVoice(r.danu.audio, r.danu.text, g)) === 'device') {
      setNote(ar ? 'معاينة بصوت جهازك — صوت دانو الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح.' : "Device-voice preview — Danu's real voice works once keys are connected.");
    }
    setBusy(false);
  }

  const row = (title: string, items: [string, string, string][] | [string, string, string, number][], key: keyof GirlSettings) => (
    <>
      <p className="mb-2 mt-5 text-sm font-semibold">{title}</p>
      <div className="flex flex-wrap gap-2">{items.map(([id, a, e]) => <Pill key={id} on={g[key] === id} onClick={() => setG({ ...g, [key]: id })}>{ar ? a : e}</Pill>)}</div>
    </>
  );

  return (
    <Card>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{ar ? 'دانو — بنت الرفاع. تطلع لما تتصل فيها من شاشة النقاش.' : 'Danu — a girl from Riffa. She joins when you call her from the discussion screen.'}</p>
      {row(ar ? 'اللهجة' : 'Dialect', DIALECTS, 'dialect')}
      {row(ar ? 'نوع البنت' : 'Voice type', STYLES, 'style')}
      {row(ar ? 'سرعة الكلام' : 'Speed', SPEEDS, 'speed')}
      {row(ar ? 'الوضع' : 'Mode', MODES, 'mode')}
      <label className="mt-5 flex items-center justify-between rounded-[14px] border p-3 text-sm font-semibold" style={{ borderColor: 'var(--outline-border)' }}>
        {ar ? 'لدغة رفاعية خفيفة (ر ← و في الصوت)' : 'Light Riffa lisp (R → W in speech)'}
        <input type="checkbox" checked={g.lisp !== false} onChange={(e) => setG({ ...g, lisp: e.target.checked })} className="h-5 w-5 accent-[#141210]" />
      </label>
      <Btn v="grey" icon="play" onClick={test} disabled={busy}>{busy ? '…' : (ar ? 'جرّب الصوت' : 'Test voice')}</Btn>
      <Btn icon="check" disabled={JSON.stringify(g) === JSON.stringify(saved)} onClick={() => { saveGirl(g); setSaved(g); setNote(ar ? 'تم الحفظ' : 'Saved'); }}>{ar ? 'اعتمد' : 'Save'}</Btn>
      <Btn v="green" icon="phone" onClick={() => { saveGirl(g); router.push('/talk'); }}>{ar ? 'اتصلوا حق دانو' : 'Call Danu'}</Btn>
      {note && <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted)' }}>{note}</p>}
    </Card>
  );
}
