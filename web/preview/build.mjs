// Builds the single-file live preview: node preview/build.mjs <out.html>
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(web, 'preview', 'index.html');
const tmp = mkdtempSync(path.join(tmpdir(), 'kakao-preview-'));

const res = await build({
  entryPoints: [path.join(web, 'preview', 'entry.tsx')],
  bundle: true, minify: true, format: 'iife', write: false, jsx: 'automatic', target: 'es2020',
  absWorkingDir: web,
  alias: { 'next/navigation': './preview/shims/navigation.tsx', 'next/link': './preview/shims/link.tsx', '@': '.' },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_KAKAO_API': '""', 'process.env.NEXT_PUBLIC_FIREBASE_API_KEY': '""', 'process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': '""', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '""', 'process.env.NEXT_PUBLIC_FIREBASE_APP_ID': '""' },
  loader: { '.json': 'json' },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;@tailwind components;@tailwind utilities;\n' + readFileSync(path.join(web, 'app', 'globals.css'), 'utf8').replace(/@tailwind[^;]+;/g, ''));
execFileSync(path.join(web, 'node_modules', '.bin', 'tailwindcss'), ['-c', path.join(web, 'tailwind.config.ts'), '-i', path.join(tmp, 'in.css'), '-o', path.join(tmp, 'out.css'), '--minify', '--content', `${web}/{app,components,lib,preview}/**/*.{ts,tsx}`], { cwd: web, stdio: 'ignore' });
const css = readFileSync(path.join(tmp, 'out.css'), 'utf8');

const html = `<title>KAkAo Live</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;600;700;800;900&display=swap">
<style>
/* KAKAO: the app's own appearance setting (light by default, dark in Settings → Appearance) drives every color token. */
body{padding-left:max(0px,env(safe-area-inset-left,0px));padding-right:max(0px,env(safe-area-inset-right,0px))}
${css}
main{padding-left:max(16px,env(safe-area-inset-left,0px))!important;padding-right:max(16px,env(safe-area-inset-right,0px))!important}
header.sticky{top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:40;background:var(--bg)}
</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync(out, html);
console.log(`preview -> ${out} (${(html.length / 1024).toFixed(0)} KB)`);
