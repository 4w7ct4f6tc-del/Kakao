'use client';
import { useEffect, useState } from 'react';

/** Appearance: 'dark' (default) or 'light' (option). Per device. */
export type Appearance = 'light' | 'dark';

export function getAppearance(): Appearance {
  try { return localStorage.getItem('appearance') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function setAppearance(a: Appearance) {
  try { localStorage.setItem('appearance', a); } catch {}
  document.documentElement.setAttribute('data-app-theme', a);
  window.dispatchEvent(new Event('appearance'));
}

export function useAppearance(): [Appearance, (a: Appearance) => void] {
  const [a, setA] = useState<Appearance>('dark');
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
  return <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.setAttribute('data-app-theme',localStorage.getItem('appearance')==='light'?'light':'dark')}catch(e){}" }} />;
}
