import { NextResponse, type NextRequest } from 'next/server';

/** Custom domains: myshop.com -> /a/<appId> (resolved via the KAKAO API). */
export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const main = (process.env.NEXT_PUBLIC_MAIN_HOSTS || 'localhost').split(',').map((h) => h.trim());
  const api = process.env.NEXT_PUBLIC_KAKAO_API;
  if (!api || api.includes('YOUR_') || main.some((h) => host === h || host.endsWith('.vercel.app'))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/_next') || req.nextUrl.pathname.startsWith('/a/')) return NextResponse.next();
  try {
    const r = await fetch(`${api}/apps/by-domain?host=${encodeURIComponent(host)}`, { next: { revalidate: 300 } });
    if (r.ok) {
      const { appId } = await r.json();
      return NextResponse.rewrite(new URL(`/a/${appId}`, req.url));
    }
  } catch {}
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
