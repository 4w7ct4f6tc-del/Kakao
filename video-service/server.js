'use strict';
/**
 * KAKAO video service (Render, Docker).
 *   POST /story   {id, story, lang, length, voice, musicUrl, uploadUrl, callbackUrl}
 *                 full pipeline: script.js -> images.js -> voice.js -> assemble.js
 *   POST /render  {id, scenes:[{imageUrl,audioUrl,text}], musicUrl, uploadUrl, callbackUrl}
 *                 assemble only (assets already made)
 * Progress and the result are POSTed to callbackUrl; the MP4 is PUT to uploadUrl
 * (a signed Firebase Storage URL) or written to outFile for local use.
 */
const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { storyToScript } = require('./script');
const { sceneImage } = require('./images');
const { narrate } = require('./voice');
const { assemble } = require('./assemble');

const SECRET = process.env.VIDEO_SERVICE_SECRET || '';
const MUSIC = { calm: 'MUSIC_TRACK_CALM', happy: 'MUSIC_TRACK_HAPPY', epic: 'MUSIC_TRACK_EPIC', sad: 'MUSIC_TRACK_SAD', mysterious: 'MUSIC_TRACK_MYSTERIOUS' };

async function report(job, body) {
  if (!job.callbackUrl) return;
  await fetch(job.callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kakao-secret': SECRET },
    body: JSON.stringify({ id: job.id, path: job.path, ...body }),
  }).catch((e) => console.warn('callback failed', e.message));
}

async function deliver(job, mp4) {
  if (job.uploadUrl) {
    const up = await fetch(job.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: mp4 });
    if (!up.ok) throw new Error(`upload ${up.status}`);
  } else if (job.outFile) {
    await fs.writeFile(job.outFile, mp4);
  }
}

/** story -> script -> images -> voice -> music -> MP4 */
async function storyPipeline(job) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'story-'));
  try {
    await report(job, { status: 'script', progress: 5 });
    const script = await storyToScript(job);
    const scenes = script.scenes.map((s) => ({ ...s, text: s.narration }));
    await report(job, { status: 'images', progress: 15, title: script.title, scenes: scenes.map(({ narration, emoji }) => ({ narration, emoji })) });

    for (let i = 0; i < scenes.length; i++) {
      const img = await sceneImage(scenes[i].imagePrompt);
      if (img) {
        scenes[i].imagePath = path.join(dir, `img${i}.png`);
        await fs.writeFile(scenes[i].imagePath, img);
      }
      await report(job, { status: 'images', progress: 15 + Math.round(((i + 1) / scenes.length) * 35) });
    }
    for (let i = 0; i < scenes.length; i++) {
      const audio = await narrate(scenes[i].narration, { voice: job.voice, gender: job.gender, speed: Number(job.speed) || 1, lang: job.lang });
      if (audio) {
        scenes[i].audioPath = path.join(dir, `voice${i}.mp3`);
        await fs.writeFile(scenes[i].audioPath, audio);
      }
      await report(job, { status: 'voice', progress: 50 + Math.round(((i + 1) / scenes.length) * 25) });
    }
    await report(job, { status: 'render', progress: 80 });
    const musicUrl = job.musicUrl || process.env[MUSIC[script.musicMood] || ''] || process.env.MUSIC_TRACK_DEFAULT || '';
    const mp4 = await assemble({ scenes, musicUrl, lang: job.lang, resolution: job.resolution || '1920x1080' });
    await deliver(job, mp4);
    await report(job, { status: 'done', progress: 100, ok: true });
    return mp4;
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'kakao-video' }));

const guard = (req, res) => {
  if (SECRET && req.headers['x-kakao-secret'] !== SECRET) {
    res.status(401).json({ error: 'bad secret' });
    return false;
  }
  return true;
};

app.post('/story', (req, res) => {
  if (!guard(req, res)) return;
  const job = req.body || {};
  if (!job.story || String(job.story).length < 10) return res.status(400).json({ error: 'story required' });
  res.status(202).json({ accepted: true });
  storyPipeline(job).catch((e) => { console.error(e); report(job, { status: 'error', error: e.message }); });
});

app.post('/render', (req, res) => {
  if (!guard(req, res)) return;
  const job = req.body || {};
  if (!Array.isArray(job.scenes) || !job.scenes.length) return res.status(400).json({ error: 'scenes required' });
  res.status(202).json({ accepted: true });
  assemble(job)
    .then((mp4) => deliver(job, mp4))
    .then(() => report(job, { status: 'done', progress: 100, ok: true }))
    .catch((e) => { console.error(e); report(job, { status: 'error', error: e.message }); });
});

if (require.main === module) {
  const port = process.env.PORT || 10000;
  app.listen(port, () => console.log(`kakao video service on :${port}`));
}

module.exports = { app, storyPipeline };
