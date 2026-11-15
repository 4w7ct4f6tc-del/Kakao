'use strict';
/**
 * KAKAO video renderer (deploy on Render as a Docker web service).
 * POST /render  {id, scenes:[{imageUrl, audioUrl, text}], musicUrl, uploadUrl, path, callbackUrl, resolution}
 * Renders asynchronously, PUTs the MP4 to the signed Storage URL, then calls back the API.
 */
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SECRET = process.env.VIDEO_SERVICE_SECRET || '';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`))));
  });
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url.slice(0, 80)}`);
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

async function duration(file) {
  const out = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Math.max(1.5, parseFloat(out) || 3);
}

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`;
};

/** Build one scene clip: Ken-Burns image (or colored card) + narration. */
async function sceneClip(dir, i, scene, W, H) {
  const audio = scene.audioUrl ? await download(scene.audioUrl, path.join(dir, `a${i}.mp3`)) : null;
  const dur = audio ? (await duration(audio)) + 0.4 : 4;
  const out = path.join(dir, `s${i}.mp4`);
  const frames = Math.ceil(dur * 30);
  const zoom = `zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30`;
  const args = ['-y'];
  if (scene.imageUrl) {
    const img = await download(scene.imageUrl, path.join(dir, `i${i}.png`));
    args.push('-loop', '1', '-i', img);
  } else {
    args.push('-f', 'lavfi', '-i', `color=c=0x1A1A1A:s=${W}x${H}:r=30`);
  }
  if (audio) args.push('-i', audio);
  else args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
  const vf = scene.imageUrl ? `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},${zoom},format=yuv420p` : 'format=yuv420p';
  args.push('-t', dur.toFixed(2), '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-shortest', out);
  await run(FFMPEG, args);
  return { file: out, dur };
}

async function render(job) {
  const [W, H] = String(job.resolution || '1920x1080').split('x').map(Number);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kakao-'));
  try {
    const clips = [];
    for (let i = 0; i < job.scenes.length; i++) clips.push(await sceneClip(dir, i, job.scenes[i], W, H));

    // Subtitles (SRT, rendered by libass — handles Arabic shaping & RTL).
    let t = 0;
    const srt = clips.map((c, i) => {
      const block = `${i + 1}\n${srtTime(t)} --> ${srtTime(t + c.dur - 0.2)}\n${String(job.scenes[i].text || '').trim()}\n`;
      t += c.dur;
      return block;
    }).join('\n');
    const srtFile = path.join(dir, 'subs.srt');
    await fs.writeFile(srtFile, srt, 'utf8');

    const list = path.join(dir, 'list.txt');
    await fs.writeFile(list, clips.map((c) => `file '${c.file}'`).join('\n'));
    const joined = path.join(dir, 'joined.mp4');
    await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);

    const final = path.join(dir, 'final.mp4');
    const font = /^(ar|fa|ur)/.test(job.lang || '') ? 'Noto Sans Arabic' : 'Noto Sans';
    const subs = `subtitles=${srtFile.replace(/:/g, '\\:')}:force_style='FontName=${font},FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=2,MarginV=40'`;
    const args = ['-y', '-i', joined];
    if (job.musicUrl) {
      const music = await download(job.musicUrl, path.join(dir, 'music.mp3')).catch(() => null);
      if (music) {
        args.push('-stream_loop', '-1', '-i', music, '-filter_complex', `[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a];[0:v]${subs}[v]`, '-map', '[v]', '-map', '[a]');
      } else {
        args.push('-vf', subs);
      }
    } else {
      args.push('-vf', subs);
    }
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final);
    await run(FFMPEG, args);
    return await fs.readFile(final);
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function callback(job, body) {
  if (!job.callbackUrl) return;
  await fetch(job.callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kakao-secret': SECRET },
    body: JSON.stringify({ id: job.id, path: job.path, ...body }),
  }).catch((e) => console.error('callback failed', e.message));
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/render', (req, res) => {
  if (SECRET && req.headers['x-kakao-secret'] !== SECRET) return res.status(401).json({ error: 'bad secret' });
  const job = req.body || {};
  if (!Array.isArray(job.scenes) || !job.scenes.length) return res.status(400).json({ error: 'scenes required' });
  res.status(202).json({ accepted: true });
  (async () => {
    try {
      const mp4 = await render(job);
      if (job.uploadUrl) {
        const up = await fetch(job.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: mp4 });
        if (!up.ok) throw new Error(`upload ${up.status}`);
      } else if (job.outFile) {
        await fs.writeFile(job.outFile, mp4);
      }
      await callback(job, { ok: true });
    } catch (e) {
      console.error('render failed', e);
      await callback(job, { error: e.message });
    }
  })();
});

if (require.main === module) {
  const port = process.env.PORT || 10000;
  app.listen(port, () => console.log(`kakao video service on :${port}`));
}

module.exports = { render, app };
