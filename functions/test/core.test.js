'use strict';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-kakao';
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('base64');
const test = require('node:test');
const assert = require('node:assert');

const { encrypt, decrypt, signState, verifyState, otpCode } = require('../lib/crypto');
const { autoRoute, modelFor, parseJson, cleanHistory } = require('../ai');
const { normalizeDesign } = require('../builder');
const { _app } = require('../index');

test('AES-256-GCM round trip', () => {
  const enc = encrypt('sk-secret-123');
  assert.notStrictEqual(enc, 'sk-secret-123');
  assert.strictEqual(decrypt(enc), 'sk-secret-123');
});

test('signed state rejects tampering', () => {
  const s = signState({ uid: 'u1', provider: 'google' });
  assert.strictEqual(verifyState(s).uid, 'u1');
  assert.strictEqual(verifyState(s.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), null);
});

test('otp is 6 digits', () => assert.match(otpCode(), /^\d{6}$/));

test('auto router', () => {
  assert.strictEqual(autoRoute('fix this flutter code'), 'claude');
  assert.strictEqual(autoRoute('اكتب لي قصة'), 'chatgpt');
  assert.strictEqual(autoRoute('hello'), 'meta');
  assert.strictEqual(autoRoute('what is this', true), 'gemini');
});

test('plan gating', () => {
  assert.strictEqual(modelFor('chatgpt', 'free', false), null);
  assert.ok(modelFor('chatgpt', 'free', true));
  assert.match(modelFor('claude', 'free', false), /haiku/);
  assert.match(modelFor('claude', 'ultra', false), /opus/);
  assert.ok(modelFor('meta', 'free', false));
});

test('parseJson handles fenced output', () => {
  assert.deepStrictEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(parseJson('Here: {"b":2} thanks'), { b: 2 });
});

test('history starts with user', () => {
  const h = cleanHistory([{ role: 'assistant', content: 'hi' }, { role: 'user', content: 'yo' }]);
  assert.strictEqual(h[0].role, 'user');
});

test('normalizeDesign clamps bad AI output', () => {
  const d = normalizeDesign({ name: 'X', colors: { primary: 'red' }, sections: ['hero', 'evil'], products: [{ name: 'A', price: '3.5' }] }, { base: { id: '1' } });
  assert.strictEqual(d.colors.primary, '#111111');
  assert.deepStrictEqual(d.sections, ['hero']);
  assert.strictEqual(d.products[0].price, 3.5);
  assert.strictEqual(d.id, '1');
});

test('express app: health + 404 + auth guard', async () => {
  const server = _app.listen(0);
  const port = server.address().port;
  try {
    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.strictEqual(h.ok, true);
    assert.strictEqual((await fetch(`http://127.0.0.1:${port}/nope`)).status, 404);
    const r = await fetch(`http://127.0.0.1:${port}/apps/list`);
    assert.strictEqual(r.status, 401);
  } finally {
    server.close();
  }
});

test('voice follows the language: Arabic -> Bahraini, English -> US', () => {
  const { resolveVoice, cleanForSpeech } = require('../voice');
  assert.deepStrictEqual(resolveVoice({ text: 'هلا والله شلونك', gender: 'male' }), { accent: 'bahraini', gender: 'male' });
  assert.strictEqual(resolveVoice({ text: 'Hello there' }).accent, 'en_us');
  assert.strictEqual(resolveVoice({ text: 'Hello', voice: 'en_uk' }).accent, 'en_uk');
  assert.strictEqual(resolveVoice({ text: 'x', voice: 'clone:abc' }).cloneId, 'abc');
  assert.strictEqual(cleanForSpeech('**مرحبا** 👋\n- أول'), 'مرحبا. أول');
});

test('girl voice: parses dialect, type and mode from free text', () => {
  const { parseVoiceRequest, extractActions, DIALECTS } = require('../persona');
  assert.strictEqual(Object.keys(DIALECTS).length, 19);
  assert.deepStrictEqual(parseVoiceRequest('سوي لي إعلان لمحلي باللهجة المصرية بنت تضحك'), { dialect: 'egyptian', style: 'happy', mode: 'ad' });
  assert.deepStrictEqual(parseVoiceRequest('سوي لي قصة بالبحريني بنت قصص'), { dialect: 'bahraini', style: 'story', mode: 'story' });
  assert.strictEqual(parseVoiceRequest('كلميني حجازي').dialect, 'saudi_hijazi');
  const p = extractActions('إذا انت تغلط [[PRANK]] تعال أتغشمر بس');
  assert.strictEqual(p.action, 'prank');
  assert.strictEqual(p.comeback, 'تعال أتغشمر بس');
  assert.strictEqual(extractActions('اوك [[BUILD: محل ورد]]').build, 'محل ورد');
});

test('talk endpoint answers without keys with a clear error code', async () => {
  const server = _app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/talk/options`);
    const d = await r.json();
    assert.strictEqual(d.dialects.length, 19);
    assert.strictEqual(d.styles.length, 7);
  } finally {
    server.close();
  }
});

test('دانو: Riffa lisp only in speech, backstory guard tags, hangup summary', () => {
  const P = require('../persona');
  assert.strictEqual(P.riffaLisp('رفاعي ريح'), 'وفاعي ويح');
  assert.strictEqual(P.riffaLisp('امره امير الأمراء بحفر حفره في الصحراء'), 'اموه اميو الأمواء بحفو حفوه في الصحواء');
  const prompt = P.danuPrompt({ familyAsks: 0 });
  assert.ok(prompt.includes('أتفشل أقول، بس باختصار أمي صادت أبوي مع الخدامة'));
  assert.ok(prompt.includes('مالت الرفاع وبحرانيه ويش تمبي خوك'));
  assert.ok(prompt.includes('عصوم شاله يبي يعاقبني'));
  assert.ok(prompt.includes('حرف الراء صح'));
  const h = P.extractActions('قلت لك بمشي، باي [[HANGUP]] زبدة المكالمة: اتفقنا على محل ورد');
  assert.strictEqual(h.hangup, true);
  assert.strictEqual(h.summary, 'اتفقنا على محل ورد');
  assert.strictEqual(P.extractActions('بمشي [[FAMILY]]').family, true);
  assert.ok(P.ai1Prompt({}).includes('اقتراح مني:'));
});
