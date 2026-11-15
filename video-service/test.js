'use strict';
// Renders a 2-scene video from local generated assets (no network) to verify FFmpeg wiring.
const { render } = require('./server');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-'));
execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=s=640x360', '-frames:v', '1', path.join(dir, 'img.png')], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=f=440:d=2', path.join(dir, 'a.mp3')], { stdio: 'ignore' });
const server = http.createServer((req, res) => fs.createReadStream(path.join(dir, req.url.slice(1))).pipe(res)).listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const mp4 = await render({
      lang: 'ar', resolution: '640x360',
      scenes: [{ imageUrl: `${base}/img.png`, audioUrl: `${base}/a.mp3`, text: 'مرحبا بالعالم' }, { audioUrl: `${base}/a.mp3`, text: 'Hello world' }],
    });
    console.log('OK rendered bytes:', mp4.length);
  } catch (e) {
    console.error('FAIL', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
