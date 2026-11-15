'use strict';
/**
 * talk.js — voice conversation with "بنت خعخعو".
 * POST /talk {event: start|reply|nudge, dialect, style, mode, speed, pitch, messages[], strikes, engine}
 *  -> {text, audio, action: null|insult|prank, comebackText, comebackAudio, build, video, settings}
 * One call = her reply as text + real voice, so the conversation flows without waiting twice.
 */
const express = require('express');
const { wrap, optionalAuth, rateLimit, clientIp } = require('./lib/http');
const { routeChat } = require('./ai');
const { synthesize } = require('./voice');
const { DIALECTS, STYLES, MODES, SPEEDS, parseVoiceRequest, systemPrompt, extractActions, displayText } = require('./persona');

const r = express.Router();

const EVENTS = {
  start: (mode) => mode === 'story'
    ? '[ابدئي: سلمي على المستخدم بمشاغبة واسأليه عن شنو تبين تحكين له قصة (مثلاً عن محله)]'
    : mode === 'ad'
      ? '[ابدئي: سلمي بمشاغبة واسأليه عن اسم محله وشنو يبيع عشان تسوين له إعلان]'
      : '[ابدئي المحادثة: سلمي على المستخدم وعرفي نفسك بجملة مشاغبة وحلوة واسأليه سؤال]',
  nudge: () => '[المستخدم سكت فترة. قولي شي قصير بأسلوبك المشاغب مثل: وينك؟ سكت؟ زعلت؟]',
};

async function voice(uid, text, s) {
  try {
    const out = await synthesize({ uid, text, voice: 'auto', gender: 'female', speed: SPEEDS[s.speed] || 1, pitch: s.pitch, dialect: s.dialect, style: s.style });
    return out.audio.toString('base64');
  } catch (e) {
    return null; // text still arrives; the app shows it and says why voice is missing
  }
}

r.post('/talk', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  await rateLimit(`talk:${uid || clientIp(req)}`, 40, 60);
  const body = req.body || {};
  const history = (Array.isArray(body.messages) ? body.messages : []).slice(-24).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2000) }));
  const lastUser = [...history].reverse().find((m) => m.role === 'user');

  // Settings from the buttons, overridden by what the user just said ("غيري للمصري", "بنت تضحك"...).
  const settings = {
    dialect: DIALECTS[body.dialect] ? body.dialect : 'bahraini',
    style: STYLES[body.style] ? body.style : 'friendly',
    mode: MODES[body.mode] ? body.mode : 'chat',
    speed: SPEEDS[body.speed] ? body.speed : 'normal',
    pitch: Math.min(1.5, Math.max(0.5, Number(body.pitch) || 1)),
  };
  if (body.event === 'reply' && lastUser) Object.assign(settings, parseVoiceRequest(lastUser.content));

  const messages = [...history];
  if (body.event === 'start' || !messages.length) messages.push({ role: 'user', content: EVENTS.start(settings.mode) });
  else if (body.event === 'nudge') messages.push({ role: 'user', content: EVENTS.nudge() });

  const out = await routeChat({
    uid,
    engine: body.engine || 'claude',
    messages,
    lang: 'ar',
    system: systemPrompt({ ...settings, strikes: Number(body.strikes) || 0 }),
  });
  const parsed = extractActions(out.text);
  const [audio, comebackAudio] = await Promise.all([
    body.withAudio === false ? null : voice(uid, parsed.text, settings),
    parsed.comeback && body.withAudio !== false ? voice(uid, parsed.comeback, settings) : null,
  ]);
  res.json({
    text: displayText(parsed.text),
    audio,
    action: parsed.action,
    comebackText: parsed.comeback ? displayText(parsed.comeback) : null,
    comebackAudio,
    build: parsed.build,
    video: parsed.video,
    settings,
    engine: out.engine,
  });
}));

/** Options for the buttons (names in Arabic + English). */
r.get('/talk/options', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    dialects: Object.entries(DIALECTS).map(([id, d]) => ({ id, ar: d.ar, en: d.en })),
    styles: Object.entries(STYLES).map(([id, s]) => ({ id, ar: s.ar, en: s.en })),
    modes: Object.entries(MODES).map(([id, m]) => ({ id, ar: m.ar })),
    speeds: Object.keys(SPEEDS),
  });
});

module.exports = r;
