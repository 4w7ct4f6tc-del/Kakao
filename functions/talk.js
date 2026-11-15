'use strict';
/**
 * talk.js
 *  POST /talk     — 🔊 voice reply in the builder (plain assistant voice in a dialect / type / mode).
 *  POST /discuss  — نقاش ثلاثي: AI 1 (chat) + دانو on a call ("اتصلوا حق دانو").
 * Every reply that is spoken comes back as text + real voice in one call.
 */
const express = require('express');
const { env } = require('./lib/admin');
const { wrap, optionalAuth, rateLimit, clientIp } = require('./lib/http');
const { routeChat } = require('./ai');
const { synthesize } = require('./voice');
const P = require('./persona');

const r = express.Router();

function readSettings(body) {
  return {
    dialect: P.DIALECTS[body.dialect] ? body.dialect : 'bahraini_riffa',
    style: P.STYLES[body.style] ? body.style : 'friendly',
    mode: P.MODES[body.mode] ? body.mode : 'chat',
    speed: P.SPEEDS[body.speed] ? body.speed : 'normal',
    pitch: Math.min(1.5, Math.max(0.5, Number(body.pitch) || 1)),
    lisp: body.lisp !== false,
  };
}

async function speak(uid, text, s, { lisp = false } = {}) {
  try {
    const ratio = Number(env('DANU_LISP_RATIO', '1'));
    const said = lisp ? P.riffaLisp(text, Number.isFinite(ratio) ? ratio : 1) : text;
    const out = await synthesize({ uid, text: said, voice: 'auto', gender: 'female', speed: P.SPEEDS[s.speed] || 1, pitch: s.pitch, dialect: s.dialect, style: s.style, lisp });
    return out.audio.toString('base64');
  } catch {
    return null; // the text still arrives; the app says why the voice is missing
  }
}

// ---------------------------------------------------------------- 🔊 voice reply (builder)
r.post('/talk', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  await rateLimit(`talk:${uid || clientIp(req)}`, 40, 60);
  const body = req.body || {};
  const history = (Array.isArray(body.messages) ? body.messages : []).slice(-20)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2000) }));
  const s = readSettings(body);
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (lastUser) Object.assign(s, P.parseVoiceRequest(lastUser.content));
  if (!history.length) history.push({ role: 'user', content: '[سلمي على المستخدم بجملة قصيرة واسأليه شنو يبي]' });
  const out = await routeChat({ uid, engine: body.engine || 'meta', messages: history, lang: 'ar', system: P.voiceAssistantPrompt(s) });
  const parsed = P.extractActions(out.text);
  const audio = body.withAudio === false ? null : await speak(uid, parsed.text, s);
  res.json({ text: P.displayText(parsed.text), audio, action: null, comebackText: null, comebackAudio: null, build: parsed.build, video: parsed.video, settings: s, engine: out.engine });
}));

// ---------------------------------------------------------------- نقاش ثلاثي
const WHO = { user: 'المستخدم', ai1: 'المساعد', danu: 'دانو' };
const transcript = (history) => history.map((m) => `${WHO[m.role] || 'المستخدم'}: ${m.content}`).join('\n');

function asChat(history) {
  const msgs = history.map((m) => (m.role === 'ai1'
    ? { role: 'assistant', content: m.content }
    : { role: 'user', content: m.role === 'danu' ? `(دانو قالت: ${m.content})` : m.content }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

/**
 * POST /discuss
 * {event: reply|join|nudge, call: bool, messages: [{role: user|ai1|danu, content}], engine,
 *  dialect, style, mode, speed, lisp, strikes, familyAsks, loud, turns}
 * -> {ai1: {text, engine} | null, danu: {text, audio, action, comebackText, comebackAudio, family, hangup, summary, build, video} | null, settings}
 */
r.post('/discuss', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  await rateLimit(`discuss:${uid || clientIp(req)}`, 40, 60);
  const body = req.body || {};
  const event = ['reply', 'join', 'nudge'].includes(body.event) ? body.event : 'reply';
  const history = (Array.isArray(body.messages) ? body.messages : []).slice(-30)
    .map((m) => ({ role: WHO[m.role] ? m.role : 'user', content: String(m.content || '').slice(0, 2000) }));
  const call = !!body.call;
  const s = readSettings(body);
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (call && event === 'reply' && lastUser) Object.assign(s, P.parseVoiceRequest(lastUser.content));
  const engine = body.engine || 'meta';
  const result = { ai1: null, danu: null, settings: s };

  // AI 1 answers the user's message (also during the call, so all three think together).
  if (event === 'reply') {
    const messages = call
      ? [{ role: 'user', content: `المحادثة لين الحين:\n${transcript(history)}\n\nرد الحين أنت (المساعد) على آخر كلام.` }]
      : asChat(history);
    const out = await routeChat({ uid, engine, messages: messages.length ? messages : [{ role: 'user', content: 'هلا' }], lang: body.lang || 'ar', system: P.ai1Prompt({ lang: body.lang || 'ar', threeWay: call }) });
    result.ai1 = { text: out.text.trim(), engine: out.engine };
    history.push({ role: 'ai1', content: result.ai1.text });
  }

  // دانو speaks only on a call.
  if (call) {
    const cue = event === 'join'
      ? 'دانو انضمت للمكالمة الحين (اتصلوا فيها). سلمي بمشاغبة، علقي بسرعة على الفكرة اللي يتكلمون فيها، وقولي رأيك الذكي.'
      : event === 'nudge'
        ? 'المستخدم ساكت فترة. قولي شي قصير بأسلوبك مثل: وينك؟ سكت؟ زعلت؟'
        : 'رد الحين أنتِ (دانو) على آخر كلام — فكري مع المستخدم والمساعد، وطوري الفكرة أو عدليها.';
    const out = await routeChat({
      uid,
      engine,
      messages: [{ role: 'user', content: `المحادثة لين الحين:\n${transcript(history) || '(ما في كلام للحين)'}\n\n${cue}` }],
      lang: 'ar',
      system: P.danuPrompt({ ...s, strikes: Number(body.strikes) || 0, familyAsks: Number(body.familyAsks) || 0, loud: !!body.loud, turns: Number(body.turns) || 0, threeWay: true }),
    });
    const parsed = P.extractActions(out.text);
    const [audio, comebackAudio] = await Promise.all([
      body.withAudio === false ? null : speak(uid, parsed.text, s, { lisp: s.lisp }),
      parsed.comeback && body.withAudio !== false ? speak(uid, parsed.comeback, s, { lisp: s.lisp }) : null,
    ]);
    result.danu = {
      text: P.displayText(parsed.text),
      audio,
      action: parsed.action,
      comebackText: parsed.comeback ? P.displayText(parsed.comeback) : null,
      comebackAudio,
      family: parsed.family,
      hangup: parsed.hangup,
      summary: parsed.summary,
      build: parsed.build,
      video: parsed.video,
    };
  }
  res.json(result);
}));

r.get('/talk/options', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    dialects: Object.entries(P.DIALECTS).map(([id, d]) => ({ id, ar: d.ar, en: d.en })),
    styles: Object.entries(P.STYLES).map(([id, x]) => ({ id, ar: x.ar, en: x.en })),
    modes: Object.entries(P.MODES).map(([id, m]) => ({ id, ar: m.ar })),
    speeds: Object.keys(P.SPEEDS),
  });
});

module.exports = r;
