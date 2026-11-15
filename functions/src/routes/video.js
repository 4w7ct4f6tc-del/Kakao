'use strict';
const express = require('express');
const { admin, db, env, now, apiUrl, uploadBuffer } = require('../lib/admin');
const { HttpError, wrap, requireAuth, rateLimit } = require('../lib/http');
const { aiJson } = require('../lib/ai');
const { getPlan, isPaid } = require('../lib/users');
const { randomId } = require('../lib/crypto');
const { synthesize } = require('./voice');
const { generateImage } = require('./vision');

const r = express.Router();

/** POST /video/create {story, lang, length: short|long, voice} -> {id} */
r.post('/video/create', requireAuth, wrap(async (req, res) => {
  const uid = req.user.uid;
  const plan = await getPlan(uid);
  await rateLimit(`video:${uid}`, isPaid(plan) ? 20 : 1, 86400);
  const story = String(req.body.story || '').trim().slice(0, 6000);
  if (story.length < 10) throw new HttpError(400, 'Write a slightly longer story');
  const ref = db.collection('videos').doc();
  await ref.set({
    id: ref.id,
    userId: uid,
    story,
    lang: String(req.body.lang || 'en').slice(0, 8),
    length: req.body.length === 'long' ? 'long' : 'short',
    voice: String(req.body.voice || 'female').slice(0, 60),
    status: 'queued',
    progress: 0,
    videoUrl: null,
    createdAt: now(),
  });
  res.json({ id: ref.id }); // pipeline runs in the Firestore trigger (index.js -> videoPipeline)
}));

r.get('/video/status', requireAuth, wrap(async (req, res) => {
  const snap = await db.collection('videos').doc(String(req.query.id || '')).get();
  if (!snap.exists || snap.data().userId !== req.user.uid) throw new HttpError(404, 'Not found');
  const d = snap.data();
  res.json({ id: snap.id, status: d.status, progress: d.progress, videoUrl: d.videoUrl, scenes: d.scenes || [], error: d.error || null });
}));

/** Called by the Render FFmpeg service when the MP4 is uploaded. */
r.post('/video/callback', wrap(async (req, res) => {
  if (req.headers['x-kakao-secret'] !== env('VIDEO_SERVICE_SECRET')) throw new HttpError(401, 'bad secret');
  const ref = db.collection('videos').doc(String(req.body.id || ''));
  if (req.body.error) {
    await ref.update({ status: 'error', error: String(req.body.error).slice(0, 300) });
  } else {
    const file = admin.storage().bucket().file(req.body.path);
    const [videoUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 5 });
    await ref.update({ status: 'done', progress: 100, videoUrl });
  }
  res.json({ ok: true });
}));

/**
 * Story -> script/scenes -> images -> narration -> music -> FFmpeg render.
 * Each step updates progress so the app never shows an endless spinner.
 */
async function runVideoPipeline(id) {
  const ref = db.collection('videos').doc(id);
  const v = (await ref.get()).data();
  const uid = v.userId;
  const step = (status, progress, extra = {}) => ref.update({ status, progress, ...extra });
  try {
    await step('script', 5);
    const sceneCount = v.length === 'long' ? 10 : 6;
    const { data } = await aiJson({
      uid,
      engine: 'chatgpt',
      prompt: `Turn this story into a short video script with exactly ${sceneCount} scenes, in language "${v.lang}".
Each scene: narration (1-2 sentences, natural spoken ${v.lang}), imagePrompt (English, cinematic, detailed, no text in image), emoji.
Also give a "title" and a "musicMood" (one of: calm, happy, epic, sad, mysterious).
Return JSON {"title":"","musicMood":"","scenes":[{"narration":"","imagePrompt":"","emoji":""}]}.
Story: ${v.story}`,
    });
    const scenes = (data.scenes || []).slice(0, sceneCount);
    if (!scenes.length) throw new Error('no scenes');
    await step('images', 15, { title: data.title || '', scenes });

    for (let i = 0; i < scenes.length; i++) {
      try {
        scenes[i].imageUrl = await generateImage(uid, `${scenes[i].imagePrompt}. 16:9 cinematic still.`);
      } catch (e) {
        console.warn('scene image failed', e.message);
      }
      await step('images', 15 + Math.round(((i + 1) / scenes.length) * 35), { scenes });
    }

    await step('voice', 55);
    for (let i = 0; i < scenes.length; i++) {
      const audio = await synthesize({ uid, text: scenes[i].narration, voice: v.voice });
      scenes[i].audioUrl = await uploadBuffer(`videos/${uid}/${id}/scene${i}.mp3`, audio, 'audio/mpeg');
      await step('voice', 55 + Math.round(((i + 1) / scenes.length) * 20), { scenes });
    }

    await step('music', 78);
    let musicUrl = env(`MUSIC_TRACK_${String(data.musicMood || 'calm').toUpperCase()}`) || env('MUSIC_TRACK_DEFAULT');
    const musicApi = env('MUSIC_API_URL'); // optional Suno / MusicGen-compatible endpoint
    if (musicApi) {
      try {
        const m = await fetch(musicApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('MUSIC_API_KEY')}` },
          body: JSON.stringify({ prompt: `${data.musicMood} instrumental background music`, duration: v.length === 'long' ? 120 : 45 }),
        });
        if (m.ok) musicUrl = (await m.json()).url || musicUrl;
      } catch (e) {
        console.warn('music api failed', e.message);
      }
    }

    await step('render', 82);
    const service = env('VIDEO_SERVICE_URL');
    if (!service) throw new Error('VIDEO_SERVICE_URL not set (deploy video-service to Render)');
    const outPath = `videos/${uid}/${id}/final_${randomId(6)}.mp4`;
    const [uploadUrl] = await admin.storage().bucket().file(outPath).getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + 60 * 60 * 1000, contentType: 'video/mp4',
    });
    const res = await fetch(`${service}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kakao-secret': env('VIDEO_SERVICE_SECRET') },
      body: JSON.stringify({
        id, uploadUrl, path: outPath, musicUrl, lang: v.lang, resolution: '1920x1080',
        callbackUrl: `${apiUrl()}/video/callback`,
        scenes: scenes.map((s) => ({ imageUrl: s.imageUrl || null, audioUrl: s.audioUrl, text: s.narration, emoji: s.emoji })),
      }),
    });
    if (!res.ok) throw new Error(`render service ${res.status}`);
  } catch (e) {
    console.error('video pipeline', e);
    await ref.update({ status: 'error', error: e.message.slice(0, 300) });
  }
}

module.exports = r;
module.exports.runVideoPipeline = runVideoPipeline;
