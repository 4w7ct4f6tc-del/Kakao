'use client';
import { useEffect, useState } from 'react';
import PreviewApp from '@/components/PreviewApp';
import { api } from '@/lib/api';
import type { Design } from '@/lib/design';
import { auth } from '@/lib/firebase';

/** Published user app — full screen, served at /a/<id> or the user's own domain. */
export default function PublishedApp({ params }: { params: { id: string } }) {
  const [design, setDesign] = useState<Design | null>(null);
  const [missing, setMissing] = useState(false);
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    const load = () => api<{ design: Design; owner?: boolean }>(`/apps/public?id=${encodeURIComponent(params.id)}`)
      .then((r) => { setDesign(r.design); setOwner(!!r.owner); document.title = r.design.name; })
      .catch(() => setMissing(true));
    load();
    return auth?.onAuthStateChanged(() => load());
  }, [params.id]);

  // Admin Panel: only the signed-in owner can add products; changes go live immediately.
  const save = (d: Design) => {
    setDesign(d);
    api('/apps/save', { design: d }).then(() => api('/apps/publish', { design: d })).catch(() => {});
  };

  if (missing) return <div className="flex min-h-screen items-center justify-center text-muted">404</div>;
  if (!design) return <div className="flex min-h-screen items-center justify-center"><div className="h-1 w-20 animate-pulse rounded bg-accent" /></div>;
  return (
    <div className="mx-auto max-w-md">
      <PreviewApp d={design} fullscreen onChange={owner ? save : undefined} />
      <p className="bg-white py-2 text-center text-[10px] text-black/40">Made with KAkAo</p>
    </div>
  );
}
