'use strict';
/**
 * assemble.js — FFmpeg: images + voice + music + subtitles -> 1080p MP4.
 * Scenes accept local files (imagePath/audioPath) or URLs (imageUrl/audioUrl).
 */
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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

async function fetchTo(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${String(url).slice(0, 80)}`);
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

async function duration(file) {
  const out = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Math.max(1.5, parseFloat(out) || 3);
}

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};

/** One scene: Ken-Burns image (or dark card) + narration (or silence sized to the text). */
async function sceneClip(dir, i, scene, W, H) {
  let audio = scene.audioPath || null;
  if (!audio && scene.audioUrl) audio = await fetchTo(scene.audioUrl, path.join(dir, `a${i}.mp3`));
  let img = scene.imagePath || null;
  if (!img && scene.imageUrl) img = await fetchTo(scene.imageUrl, path.join(dir, `i${i}.png`)).catch(() => null);
  const words = String(scene.text || '').split(/\s+/).length;
  const dur = audio ? (await duration(audio)) + 0.4 : Math.max(3, words * 0.45);
  const out = path.join(dir, `s${i}.mp4`);
  const frames = Math.ceil(dur * 30);
  const args = ['-y'];
  if (img) args.push('-loop', '1', '-i', img);
  else args.push('-f', 'lavfi', '-i', `color=c=0x1A1A1A:s=${W}x${H}:r=30`);
  if (audio) args.push('-i', audio);
  else args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
  const vf = img
    ? `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30,format=yuv420p`
    : 'format=yuv420p';
  args.push('-t', dur.toFixed(2), '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-shortest', out);
  await run(FFMPEG, args);
  return { file: out, dur };
}

/**
 * @param {{scenes:{text:string,imagePath?:string,imageUrl?:string,audioPath?:string,audioUrl?:string}[], musicUrl?:string, lang?:string, resolution?:string}} job
 * @returns {Promise<Buffer>} MP4 bytes
 */
async function assemble(job) {
  const [W, H] = String(job.resolution || '1920x1080').split('x').map(Number);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kakao-'));
  try {
    const clips = [];
    for (let i = 0; i < job.scenes.length; i++) clips.push(await sceneClip(dir, i, job.scenes[i], W, H));

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
    const music = job.musicUrl ? await fetchTo(job.musicUrl, path.join(dir, 'music.mp3')).catch(() => null) : null;
    if (music) {
      args.push('-stream_loop', '-1', '-i', music, '-filter_complex', `[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a];[0:v]${subs}[v]`, '-map', '[v]', '-map', '[a]');
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

module.exports = { assemble };
