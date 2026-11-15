import { BRAND_SVGS } from '@/lib/brands';

/** Official logo of an AI provider (claude | chatgpt | meta | gemini). */
export default function BrandLogo({ name, size = 18 }: { name: string; size?: number }) {
  const svg = BRAND_SVGS[name];
  if (!svg) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={size} height={size} alt="" aria-hidden="true" className={`inline-block shrink-0 ${name === 'chatgpt' ? 'k-mono' : ''}`} />
  );
}
