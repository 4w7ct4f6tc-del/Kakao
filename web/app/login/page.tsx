'use client';
import {
  type AuthProvider, FacebookAuthProvider, GithubAuthProvider, GoogleAuthProvider, OAuthProvider,
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Btn, Card, Input, Shell } from '@/components/ui';
import { api, friendly } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { useLang } from '@/lib/i18n';

type Mode = 'main' | 'recover' | 'email';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Login() {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('main');
  const [phone, setPhone] = useState('+973');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<string[] | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  // recovery
  const [ident, setIdent] = useState('');
  const [recSent, setRecSent] = useState<string[] | null>(null);
  const [recCode, setRecCode] = useState('');
  const [approval, setApproval] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState(['', '', '']);
  const [newPass, setNewPass] = useState('');
  const [needPass, setNeedPass] = useState(false);
  // email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), []);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setMsg('');
    try { await fn(); } catch (e) { setMsg(friendly(e, lang)); }
    setBusy('');
  };
  const needAuth = () => { if (!auth) throw Object.assign(new Error('x'), { code: 'not_configured' }); return auth; };
  const social = (key: string, p: AuthProvider) => run(key, async () => { await signInWithPopup(needAuth(), p); });
  const recovered = async (token: string) => { await signInWithCustomToken(needAuth(), token); setNeedPass(true); };
  const poll = async (path: string) => {
    for (let i = 0; i < 200; i++) {
      await wait(3000);
      const r = await api<{ token?: string; status?: string }>(path).catch(() => ({} as { token?: string; status?: string }));
      if (r.token) return recovered(r.token);
      if (r.status === 'denied' || r.status === 'expired') throw Object.assign(new Error('x'), { code: r.status });
    }
  };

  if (user && !needPass) {
    return (
      <Shell title={ar ? 'تسجيل الدخول' : 'Log in'}>
        <Card className="text-center">
          <p className="text-sm text-black/60">{t('signedInAs')}</p>
          <p className="mt-1 text-xl font-extrabold">{user.displayName || user.email || user.phoneNumber}</p>
          <Btn v="grey" onClick={() => auth && signOut(auth)}>{t('signOut')}</Btn>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title={ar ? 'تسجيل الدخول' : 'Log in'}>
      {needPass ? (
        <Card>
          <h2 className="text-lg font-extrabold">{ar ? 'كلمة السر الجديدة' : 'New password'}</h2>
          <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={ar ? 'كلمة السر الجديدة (8 أحرف أو أكثر)' : 'New password (8+ characters)'} />
          <Btn v="green" disabled={busy === 'pass'} onClick={() => run('pass', async () => { await api('/auth/set-password', { password: newPass }); setNeedPass(false); })}>{ar ? 'احفظ كلمة السر' : 'Save password'}</Btn>
        </Card>
      ) : mode === 'main' ? (
        <Card>
          <Btn v="grey" disabled={busy === 'g'} onClick={() => social('g', new GoogleAuthProvider())}>Google</Btn>
          <Btn v="grey" disabled={busy === 'f'} onClick={() => social('f', new FacebookAuthProvider())}>Facebook</Btn>
          <Btn v="grey" disabled={busy === 'h'} onClick={() => social('h', new GithubAuthProvider())}>GitHub</Btn>
          <Btn v="grey" disabled={busy === 'a'} onClick={() => social('a', new OAuthProvider('apple.com'))}>Apple</Btn>

          <Input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phoneLabel')} aria-label={t('phoneLabel')} className="mt-4" />
          <Btn v="green" disabled={busy === 'send'} onClick={() => run('send', async () => { const r = await api<{ sentVia: string[] }>('/otp/send', { phone, lang }); setSent(r.sentVia); })}>
            {busy === 'send' ? '…' : t('sendActivation')}
          </Btn>
          {sent && <p className="mt-2 text-center text-sm text-black/60">{sent.join(' + ')}</p>}
          <Input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('codePh')} aria-label={t('codePh')} className="text-center tracking-[6px]" />
          <Btn disabled={busy === 'code'} onClick={() => run('code', async () => { const r = await api<{ token: string }>('/otp/verify', { phone, code }); await signInWithCustomToken(needAuth(), r.token); })}>
            {busy === 'code' ? '…' : t('loginCode')}
          </Btn>
          <Btn v="grey" onClick={() => setMode('recover')}>{t('forgotSmart')}</Btn>
          <button onClick={() => setMode('email')} className="mt-3 w-full text-center text-sm text-black/50 underline">{t('emailLogin')}</button>
        </Card>
      ) : mode === 'email' ? (
        <Card>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('password')} />
          <Btn disabled={busy === 'e'} onClick={() => run('e', async () => { await signInWithEmailAndPassword(needAuth(), email, password); })}>{t('login')}</Btn>
          <Btn v="grey" disabled={busy === 'n'} onClick={() => run('n', async () => { await createUserWithEmailAndPassword(needAuth(), email, password); })}>{ar ? 'إنشاء حساب' : 'Create account'}</Btn>
          <Btn v="grey" onClick={() => setMode('main')}>{t('back')}</Btn>
        </Card>
      ) : (
        <Card>
          <h2 className="text-lg font-extrabold">{ar ? 'فتح ذكي — اختر أسرع طريقة' : 'Smart unlock — pick the fastest way'}</h2>
          <Input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder={ar ? 'الإيميل أو رقم الجوال' : 'Email or mobile number'} />
          <Btn v="green" disabled={busy === 'ro'} onClick={() => run('ro', async () => { const r = await api<{ sentVia: string[] }>('/recovery/otp/send', { identifier: ident, lang }); setRecSent(r.sentVia); })}>
            {ar ? 'كود على واتساب + SMS + إيميل' : 'Code to WhatsApp + SMS + Email'}
          </Btn>
          {recSent && (
            <>
              <p className="mt-2 text-sm text-black/60">{recSent.join(' • ')}</p>
              <Input inputMode="numeric" value={recCode} onChange={(e) => setRecCode(e.target.value)} placeholder={t('codePh')} className="text-center tracking-[6px]" />
              <Btn disabled={busy === 'rv'} onClick={() => run('rv', async () => { const r = await api<{ token: string }>('/recovery/otp/verify', { identifier: ident, code: recCode }); await recovered(r.token); })}>{t('loginCode')}</Btn>
            </>
          )}
          <Btn v="grey" disabled={busy === 'rm'} onClick={() => run('rm', async () => {
            const { id } = await api<{ id: string }>('/recovery/magic', { email: ident });
            setMsg(ar ? 'افتح الرابط من إيميلك — بندخلك هنا تلقائياً' : 'Open the link in your email — you will be signed in here');
            await poll(`/recovery/magic/poll?id=${id}`);
          })}>{ar ? 'رابط سحري على إيميلي' : 'Magic link to my email'}</Btn>
          <Btn v="grey" disabled={busy === 'rd'} onClick={() => run('rd', async () => {
            const r = await api<{ id: string; code: string }>('/recovery/approval/request', { identifier: ident, deviceName: 'Web' });
            setApproval(r.code);
            await poll(`/recovery/approval/poll?id=${r.id}`);
          })}>{ar ? 'موافقة من جهازي الثاني' : 'Approve from my other device'}</Btn>
          {approval && <p className="mt-2 text-center text-3xl font-black tracking-[8px]">{approval}</p>}
          <Btn v="grey" disabled={busy === 'rq'} onClick={() => run('rq', async () => { const r = await api<{ questions: string[] }>('/recovery/questions/get', { identifier: ident }); setQuestions(r.questions); })}>
            {ar ? 'أسئلتي الذكية' : 'My smart questions'}
          </Btn>
          {questions.map((q, i) => (
            <div key={i}>
              <p className="mt-2 text-sm font-bold">{q}</p>
              <Input value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
            </div>
          ))}
          {questions.length > 0 && <Btn disabled={busy === 'ra'} onClick={() => run('ra', async () => { const r = await api<{ token: string }>('/recovery/questions/verify', { identifier: ident, answers }); await recovered(r.token); })}>{t('verify')}</Btn>}
          <Btn v="grey" onClick={() => setMode('main')}>{t('back')}</Btn>
        </Card>
      )}
      {msg && <p className="mt-3 text-center text-sm opacity-70">{msg}</p>}
    </Shell>
  );
}
