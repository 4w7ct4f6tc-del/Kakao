'use client';
import { useRouter } from 'next/navigation';
import {
  AuthProvider, FacebookAuthProvider, GithubAuthProvider, GoogleAuthProvider, OAuthProvider,
  signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup,
} from 'firebase/auth';
import { useState } from 'react';
import { Button, Input, Logo, Footer } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { Brand } from '@/lib/brand';
import { useLang } from '@/lib/i18n';

export default function Login() {
  const { t, lang } = useLang();
  const router = useRouter();
  const [mode, setMode] = useState<'main' | 'phone' | 'email' | 'recover'>('main');
  const [phone, setPhone] = useState('+973');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<string[] | null>(null);
  const [msg, setMsg] = useState('');

  const done = () => router.push('/');
  const run = async (fn: () => Promise<any>) => { setMsg(''); try { await fn(); } catch (e) { setMsg(friendly(e, lang)); } };
  const social = (p: AuthProvider) => run(async () => { if (!auth) throw Object.assign(new Error('x'), { code: 'not_configured' }); await signInWithPopup(auth, p); done(); });

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <div className="text-center"><Logo size={84} /><h1 className="mt-3 text-2xl font-extrabold">{Brand.name(lang)}</h1><p className="text-white/70">{t('welcome')}</p></div>
      <div className="mt-8">
        {mode === 'main' && (
          <>
            <Button onClick={() => social(new GoogleAuthProvider())}>G &nbsp;{t('google')}</Button>
            <Button onClick={() => social(new OAuthProvider('apple.com'))}> {t('apple')}</Button>
            <Button onClick={() => social(new FacebookAuthProvider())}>f &nbsp;{t('facebook')}</Button>
            <Button onClick={() => social(new GithubAuthProvider())}>⌘ &nbsp;{t('github')}</Button>
            <Button onClick={() => setMode('phone')}>📱 {t('phone')}</Button>
            <Button onClick={() => setMode('email')}>✉️ {t('email')}</Button>
            <button onClick={() => setMode('recover')} className="mt-3 w-full text-center">{t('forgot')}</button>
            <button onClick={done} className="mt-2 w-full text-center text-white/50">{t('guest')}</button>
          </>
        )}
        {mode === 'phone' && (
          <div className="space-y-3">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phone')} />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`${t('email')} (+)`} />
            <Button accent onClick={() => run(async () => { const r = await api<{ sentVia: string[] }>('/otp/send', { phone, email, lang }); setSent(r.sentVia); })}>{t('sendCode')}</Button>
            {sent && (
              <>
                <p className="text-sm text-white/70">✓ {sent.join(' + ')}</p>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('code')} className="text-center text-2xl tracking-[10px]" />
                <Button accent onClick={() => run(async () => { const r = await api<{ token: string }>('/otp/verify', { phone, code }); await signInWithCustomToken(auth!, r.token); done(); })}>{t('verify')}</Button>
              </>
            )}
          </div>
        )}
        {mode === 'email' && (
          <div className="space-y-3">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} />
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} />
            <Button accent onClick={() => run(async () => { await signInWithEmailAndPassword(auth!, email, password); done(); })}>{t('login')}</Button>
          </div>
        )}
        {mode === 'recover' && (
          <div className="space-y-3">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`${t('email')} / ${t('phone')}`} />
            <Button accent onClick={() => run(async () => { const r = await api<{ sentVia: string[] }>('/recovery/otp/send', { identifier: email, lang }); setSent(r.sentVia); })}>{t('sendCode')}</Button>
            <Button onClick={() => run(async () => {
              const { id } = await api<{ id: string }>('/recovery/magic', { email });
              setMsg(lang === 'ar' ? 'افتح الرابط من إيميلك — بندخلك هنا تلقائياً' : 'Open the link in your email — you will be signed in here');
              for (let i = 0; i < 300; i++) { await new Promise((r) => setTimeout(r, 3000)); const p = await api<{ token?: string }>(`/recovery/magic/poll?id=${id}`).catch(() => ({} as any)); if (p.token) { await signInWithCustomToken(auth!, p.token); return done(); } }
            })}>✨ Magic link</Button>
            {sent && (
              <>
                <p className="text-sm text-white/70">✓ {sent.join(' • ')}</p>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('code')} />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} />
                <Button accent onClick={() => run(async () => {
                  const r = await api<{ token: string }>('/recovery/otp/verify', { identifier: email, code });
                  await signInWithCustomToken(auth!, r.token);
                  await api('/auth/set-password', { password });
                  done();
                })}>{t('save')}</Button>
              </>
            )}
          </div>
        )}
        {mode !== 'main' && <button onClick={() => { setMode('main'); setSent(null); }} className="mt-4 w-full text-center text-white/60">{t('back')}</button>}
        {msg && <p className="mt-3 text-center text-sm text-muted">{msg}</p>}
      </div>
      <Footer />
    </div>
  );
}
