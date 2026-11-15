'use client';
// Home: the owner's exact design — soft #F5F5F4, round menu, KAkAo, black K, one rounded box at the bottom.
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { KBox, KC, KPage, KTop, Mark, SERIF, useBrand } from '@/components/KakaoFrame';

export default function HomeScreen() {
  const { ar, name } = useBrand();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const build = (p: string) => router.push(`/builder?prompt=${encodeURIComponent(p)}`);

  return (
    <KPage>
      <KTop />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 16px 140px' }}>
        <Mark size={128} font={82} />
        <h1 style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 500, lineHeight: 1.05, marginTop: 22 }}>{name}</h1>
        <p style={{ color: KC.brand, fontSize: 19, marginTop: 10 }}>B.K.A Famy</p>
        <p style={{ color: KC.text, fontSize: 14, marginTop: 20, lineHeight: 1.65 }}>
          {ar ? 'شنو فكرتك؟' : 'What is your idea?'}<br />{ar ? 'اكتبها، وأنا أبنيها لك.' : 'Write it, I will build it for you.'}
        </p>
      </main>
      <KBox
        variant="home"
        onSend={build}
        onVoice={() => router.push('/talk')}
        plus={[
          ['camera', ar ? 'الكاميرا' : 'Camera', () => file.current?.click()],
          ['clipboard', ar ? 'القوالب' : 'Templates', () => router.push('/builder')],
          ['film', ar ? 'قصة إلى فيديو' : 'Story to video', () => router.push('/video')],
        ]}
      />
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={() => build(ar ? 'تطبيق من الصورة' : 'App from my photo')} />
    </KPage>
  );
}
