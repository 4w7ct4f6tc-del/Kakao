import { auth, firebaseReady } from './firebase';

export const API = process.env.NEXT_PUBLIC_KAKAO_API || '';
export const apiConfigured = !!API && !API.includes('YOUR_');

export async function api<T = any>(path: string, body?: unknown, opts: { method?: string; retries?: number } = {}): Promise<T> {
  if (!apiConfigured) throw Object.assign(new Error('not_configured'), { code: 'not_configured' });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (firebaseReady && auth?.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  const retries = opts.retries ?? 1;
  let last: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(`${API}${path}`, {
        method: opts.method || (body === undefined ? 'GET' : 'POST'),
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(data.error || 'error'), { status: r.status, code: data.code });
      return data as T;
    } catch (e: any) {
      last = e;
      if (e.status && e.status < 500 && e.status !== 429) throw e;
      await new Promise((res) => setTimeout(res, 600 * (i + 1)));
    }
  }
  throw last;
}

export function friendly(e: any, lang: string) {
  const ar = lang === 'ar';
  if (e?.code === 'not_configured') return ar ? 'الخدمة تحتاج ربط المفاتيح (README). جرّب الخيار الفوري.' : 'This service needs its keys (see README). Try the instant option.';
  if (e?.code === 'plan' || e?.status === 402) return ar ? 'ميزة مدفوعة — رقّ باقتك من الإعدادات.' : 'Paid feature — upgrade in Settings.';
  return ar ? 'صار تأخير بسيط — حاول مرة ثانية أو اختر طريقة ثانية.' : 'Small hiccup — try again or choose another way.';
}
