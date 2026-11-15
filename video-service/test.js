'use strict';
// No-network test: full story pipeline with no keys (local script, silent scenes) + assemble with an image.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { storyPipeline } = require('./server');
const { assemble } = require('./assemble');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-'));
  try {
    const out = path.join(dir, 'story.mp4');
    await storyPipeline({ id: 't', story: 'كان يا ما كان ولد صغير. حلم أن يبني تطبيقاً. وفي يوم من الأيام نجح!', lang: 'ar', resolution: '640x360', outFile: out });
    console.log('OK story pipeline bytes:', fs.statSync(out).size);
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=s=640x360', '-frames:v', '1', '-update', '1', path.join(dir, 'img.png')], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=f=440:d=2', path.join(dir, 'a.mp3')], { stdio: 'ignore' });
    const mp4 = await assemble({ lang: 'en', resolution: '640x360', scenes: [{ imagePath: path.join(dir, 'img.png'), audioPath: path.join(dir, 'a.mp3'), text: 'Hello world' }] });
    console.log('OK assemble bytes:', mp4.length);
  } catch (e) {
    console.error('FAIL', e.message);
    process.exitCode = 1;
  }
})();
