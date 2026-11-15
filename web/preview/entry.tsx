// Live preview: the real KAKAO web pages in one bundle (offline mode, no keys).
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { LangProvider } from '@/lib/i18n';
import Home from '@/app/page';
import BuilderPage from '@/app/builder/page';
import VideoPage from '@/app/video/page';
import Settings from '@/app/settings/page';
import Login from '@/app/login/page';
import Templates from '@/app/templates/page';
import TalkPage from '@/app/talk/page';
import { navigate, useRoute } from './shims/navigation';

const PAGES: Record<string, () => JSX.Element> = { '/': Home, '/builder': BuilderPage, '/video': VideoPage, '/settings': Settings, '/login': Login, '/templates': Templates, '/talk': TalkPage };

function App() {
  const route = useRoute();
  const Page = PAGES[route.split('?')[0]] || Home;
  // Intercept plain <a href="/..."> links (e.g. "/templates", "/legal").
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      const href = a?.getAttribute('href');
      if (href && href.startsWith('/') && !a?.target) { e.preventDefault(); navigate(PAGES[href.split('?')[0]] ? href : '/'); }
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);
  return <Page />;
}

try { document.documentElement.setAttribute('data-app-theme', localStorage.getItem('appearance') === 'dark' ? 'dark' : 'light'); } catch { document.documentElement.setAttribute('data-app-theme', 'light'); }

createRoot(document.getElementById('root')!).render(<LangProvider><App /></LangProvider>);
