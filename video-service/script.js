'use strict';
/**
 * script.js — story -> video script (title, music mood, 5-10 scenes).
 * Order: OpenAI (best for writing) -> Claude -> instant local splitter.
 */
const Anthropic = require('@anthropic-ai/sdk').default;

const env = (k, d = '') => (process.env[k] && !process.env[k].startsWith('YOUR_') ? process.env[k] : d);
const EMOJIS = ['🌅', '🚶', '🏙️', '💡', '⚡', '❤️', '🌙', '🎉', '🌊', '🏁'];

function prompt(story, lang, count) {
  return `Turn this story into a short video script with exactly ${count} scenes, in language "${lang}".
Each scene: narration (1-2 natural spoken sentences in ${lang}), imagePrompt (English, cinematic, detailed, no text), emoji.
Also "title" and "musicMood" (calm|happy|epic|sad|mysterious).
Return ONLY JSON: {"title":"","musicMood":"","scenes":[{"narration":"","imagePrompt":"","emoji":""}]}
Story: ${story}`;
}

function parse(text) {
  const t = String(text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  return JSON.parse(s >= 0 ? t.slice(s, e + 1) : t);
}

async function viaOpenAI(p) {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('no openai key');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env('OPENAI_MODEL', 'gpt-4o'), response_format: { type: 'json_object' }, messages: [{ role: 'user', content: p }] }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}`);
  return parse((await r.json()).choices[0].message.content);
}

async function viaClaude(p) {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('no anthropic key');
  const client = new Anthropic({ apiKey: key });
  const r = await client.messages.create({ model: env('CLAUDE_MODEL', 'claude-opus-5-5'), max_tokens: 16000, messages: [{ role: 'user', content: p }] });
  if (r.stop_reason === 'refusal') throw new Error('refusal');
  return parse(r.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

/** Works with no keys at all: sentence split into scenes. */
function localScript(story, count) {
  const parts = String(story).split(/(?<=[.!؟?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const per = Math.max(1, Math.ceil(parts.length / count));
  const scenes = [];
  for (let i = 0; i < parts.length && scenes.length < count; i += per) {
    const narration = parts.slice(i, i + per).join(' ');
    scenes.push({ narration, imagePrompt: `Cinematic illustration: ${narration}`, emoji: EMOJIS[scenes.length % EMOJIS.length] });
  }
  return { title: parts[0]?.slice(0, 60) || 'Story', musicMood: 'calm', scenes };
}

async function storyToScript({ story, lang = 'en', length = 'short' }) {
  const count = length === 'long' ? 10 : 6;
  const p = prompt(story, lang, count);
  for (const fn of [viaOpenAI, viaClaude]) {
    try {
      const out = await fn(p);
      if (Array.isArray(out.scenes) && out.scenes.length) {
        out.scenes = out.scenes.slice(0, count).map((s, i) => ({ narration: String(s.narration || ''), imagePrompt: String(s.imagePrompt || s.narration || ''), emoji: s.emoji || EMOJIS[i % 10] }));
        return out;
      }
    } catch (e) {
      console.warn('[script]', fn.name, e.message);
    }
  }
  return localScript(story, count);
}

module.exports = { storyToScript, localScript };
