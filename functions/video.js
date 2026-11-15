'use strict';
/**
 * video.js — story-to-video jobs. The heavy work (script.js, images.js, voice.js,
 * assemble.js) runs in video-service/ on Render; this file creates the job,
 * hands it to the service with a signed upload URL, and records progress.
 */
const express = require('express');
const { admin, db, env, now, apiUrl } = require('./lib/admin');
const { HttpError, wrap, requireAuth, rateLimit } = require('./lib/http');
const { getPlan, isPaid } = require('./lib/users');
const { randomId } = require('./lib/crypto');

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
    id: ref.id, userId: uid, story,
    lang: String(req.body.lang || 'en').slice(0, 8),
    length: req.body.length === 'long' ? 'long' : 'short',
    voice: String(req.body.voice || 'female').slice(0, 60),
    status: 'queued', progress: 0, videoUrl: null, createdAt: now(),
  });
  // Firebase: the Firestore trigger (index.js) starts it. Render/local server: start inline.
  if (process.env.RUN_PIPELINE_INLINE === 'true') runVideoPipeline(ref.id).catch((e) => console.error(e));
  res.json({ id: ref.id });
}));

r.get('/video/status', requireAuth, wrap(async (req, res) => {
  const snap = await db.collection('videos').doc(String(req.query.id || '')).get();
  if (!snap.exists || snap.data().userId !== req.user.uid) throw new HttpError(404, 'Not found');
  const d = snap.data();
  res.json({ id: snap.id, status: d.status, progress: d.progress, videoUrl: d.videoUrl, scenes: d.scenes || [], error: d.error || null });
}));

/** Progress + result from video-service. */
r.post('/video/callback', wrap(async (req, res) => {
  if (!env('VIDEO_SERVICE_SECRET') || req.headers['x-kakao-secret'] !== env('VIDEO_SERVICE_SECRET')) throw new HttpError(401, 'bad secret');
  const ref = db.collection('videos').doc(String(req.body.id || ''));
  const { status, progress, scenes, title, error } = req.body;
  if (error || status === 'error') {
    await ref.update({ status: 'error', error: String(error || 'render failed').slice(0, 300) });
  } else if (status === 'done') {
    const [videoUrl] = await admin.storage().bucket().file(req.body.path).getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 5 });
    await ref.update({ status: 'done', progress: 100, videoUrl });
  } else {
    const patch = { status: String(status || 'render').slice(0, 20), progress: Math.min(99, Number(progress) || 0) };
    if (Array.isArray(scenes)) patch.scenes = scenes.slice(0, 10);
    if (title) patch.title = String(title).slice(0, 120);
    await ref.update(patch);
  }
  res.json({ ok: true });
}));

async function runVideoPipeline(id) {
  const ref = db.collection('videos').doc(id);
  const v = (await ref.get()).data();
  try {
    const service = env('VIDEO_SERVICE_URL');
    if (!service) throw new Error('VIDEO_SERVICE_URL not set — deploy video-service to Render');
    const outPath = `videos/${v.userId}/${id}/final_${randomId(6)}.mp4`;
    const [uploadUrl] = await admin.storage().bucket().file(outPath).getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + 2 * 60 * 60 * 1000, contentType: 'video/mp4',
    });
    const res = await fetch(`${service}/story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-kakao-secret': env('VIDEO_SERVICE_SECRET') },
      body: JSON.stringify({
        id, story: v.story, lang: v.lang, length: v.length, voice: v.voice,
        uploadUrl, path: outPath, callbackUrl: `${apiUrl()}/video/callback`, resolution: '1920x1080',
      }),
    });
    if (!res.ok) throw new Error(`video service ${res.status}`);
    await ref.update({ status: 'script', progress: 3 });
  } catch (e) {
    console.error('video pipeline', e);
    await ref.update({ status: 'error', error: e.message.slice(0, 300) });
  }
}

module.exports = r;
module.exports.runVideoPipeline = runVideoPipeline;
