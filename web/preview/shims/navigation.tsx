// Single-page shim for next/navigation used by the live preview bundle.
import { useSyncExternalStore } from 'react';

let route = '/';
const subs = new Set<() => void>();
export function navigate(to: string) {
  route = to;
  subs.forEach((f) => f());
  window.scrollTo(0, 0);
}
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };
export const useRoute = () => useSyncExternalStore(subscribe, () => route, () => route);
export const usePathname = () => useRoute().split('?')[0];
export const useSearchParams = () => new URLSearchParams(useRoute().split('?')[1] || '');
export const useRouter = () => ({ push: navigate, replace: navigate, back: () => navigate('/'), refresh: () => {} });
