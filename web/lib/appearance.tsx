'use client';
import { useEffect, useState } from 'react';

/** Appearance: 'light' (owner's new design, default) or 'dark' (first design). Per device. */
export type Appearance = 'light' | 'dark';

export function getAppearance(): Appearance {
  try { return localStorage.getItem('appearance') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function setAppearance(a: Appearance) {
  try { localStorage.setItem('appearance', a); } catch {}
  document.documentElement.setAttribute('data-app-theme', a);
  window.dispatchEvent(new Event('appearance'));
}

export function useAppearance(): [Appearance, (a: Appearance) => void] {
  const [a, setA] = useState<Appearance>('light');
  useEffect(() => {
    const sync = () => setA(getAppearance());
    sync();
    window.addEventListener('appearance', sync);
    return () => window.removeEventListener('appearance', sync);
  }, []);
  return [a, setAppearance];
}

/** Applies the saved appearance before first paint (no flash). */
export function AppearanceScript() {
  return <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.setAttribute('data-app-theme',localStorage.getItem('appearance')==='dark'?'dark':'light')}catch(e){}" }} />;
}
