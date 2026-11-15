'use strict';
/**
 * Run the same KAKAO API as a normal Node server (Render, Docker, your PC):
 *   node server.js        -> http://localhost:8080
 * On Render set FIREBASE_SERVICE_ACCOUNT (JSON) + the variables from .env.example.
 * Video jobs run inline here (no Firestore trigger outside Firebase).
 */
process.env.RUN_PIPELINE_INLINE = process.env.RUN_PIPELINE_INLINE || 'true';
try { require('fs').readFileSync(`${__dirname}/.env`, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}); } catch {}
const { _app } = require('./index');
const port = process.env.PORT || 8080;
_app.listen(port, () => console.log(`KAKAO API on :${port}`));
