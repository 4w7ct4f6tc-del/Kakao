import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LangProvider } from '@/lib/i18n';
import { AppearanceScript } from '@/lib/appearance';

export const metadata: Metadata = {
  title: 'KAkAo',
  description: 'The easiest app builder in the world — K.A Familia Global Company',
};

export const viewport: Viewport = { themeColor: '#0F0F0F', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;600;700;800;900&family=Tajawal:wght@400;700&display=swap" rel="stylesheet" />
        <AppearanceScript />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
