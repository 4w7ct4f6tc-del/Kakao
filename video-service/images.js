'use strict';
/** images.js — one image per scene: OpenAI gpt-image -> Google Imagen -> null (color card). */
const env = (k, d = '') => (process.env[k] && !process.env[k].startsWith('YOUR_') ? process.env[k] : d);

async function sceneImage(prompt) {
  const openai = env('OPENAI_API_KEY');
  if (openai) {
    try {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: env('OPENAI_IMAGE_MODEL', 'gpt-image-1'), prompt: `${prompt}. 16:9 cinematic still, no text.`, size: '1536x1024', n: 1 }),
      });
      if (r.ok) {
        const d = (await r.json()).data[0];
        return d.b64_json ? Buffer.from(d.b64_json, 'base64') : Buffer.from(await (await fetch(d.url)).arrayBuffer());
      }
      console.warn('[images] openai', r.status);
    } catch (e) {
      console.warn('[images] openai', e.message);
    }
  }
  const gemini = env('GEMINI_API_KEY');
  if (gemini) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env('IMAGEN_MODEL', 'imagen-4.0-generate-001')}:predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '16:9' } }),
      });
      const b64 = r.ok ? (await r.json()).predictions?.[0]?.bytesBase64Encoded : null;
      if (b64) return Buffer.from(b64, 'base64');
    } catch (e) {
      console.warn('[images] imagen', e.message);
    }
  }
  return null;
}

module.exports = { sceneImage };
