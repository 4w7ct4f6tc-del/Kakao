/**
 * ONE link for everything: the web app on Vercel proxies /api/* to the KAKAO API
 * on Render, so your single domain (e.g. https://kakao.yourdomain.com via Cloudflare)
 * serves the app, the API and every published user app.
 * Set KAKAO_API_ORIGIN=https://kakao-api.onrender.com and NEXT_PUBLIC_KAKAO_API=/api
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  async rewrites() {
    const origin = process.env.KAKAO_API_ORIGIN;
    return origin ? [{ source: '/api/:path*', destination: `${origin.replace(/\/$/, '')}/:path*` }] : [];
  },
};
export default nextConfig;
