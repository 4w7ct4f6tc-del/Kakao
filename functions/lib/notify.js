'use strict';
const { env } = require('./admin');

let _twilio;
function twilio() {
  if (_twilio !== undefined) return _twilio;
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  _twilio = sid && token ? require('twilio')(sid, token) : null;
  return _twilio;
}

async function sendSms(to, body) {
  const c = twilio();
  const from = env('TWILIO_SMS_FROM');
  const service = env('TWILIO_MESSAGING_SERVICE_SID');
  if (!c || (!from && !service)) throw new Error('sms not configured');
  await c.messages.create({ to, body, ...(service ? { messagingServiceSid: service } : { from }) });
}

/**
 * WhatsApp: Meta WhatsApp Business Cloud API (authentication template) when
 * configured, otherwise Twilio's WhatsApp sender.
 */
async function sendWhatsApp(to, body, code) {
  const metaToken = env('WHATSAPP_CLOUD_TOKEN');
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  if (metaToken && phoneId) {
    const template = env('WHATSAPP_OTP_TEMPLATE');
    const payload = template && code
      ? {
          messaging_product: 'whatsapp',
          to: to.replace('+', ''),
          type: 'template',
          template: {
            name: template,
            language: { code: env('WHATSAPP_TEMPLATE_LANG', 'en') },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
            ],
          },
        }
      : { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body } };
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`whatsapp ${r.status}: ${await r.text()}`);
    return;
  }
  const c = twilio();
  const from = env('TWILIO_WHATSAPP_FROM'); // e.g. whatsapp:+14155238886
  if (!c || !from) throw new Error('whatsapp not configured');
  await c.messages.create({ to: `whatsapp:${to}`, from, body });
}

async function sendEmail(to, subject, text, html) {
  const key = env('SENDGRID_API_KEY');
  const from = env('SENDGRID_FROM_EMAIL');
  if (!key || !from) throw new Error('email not configured');
  const sg = require('@sendgrid/mail');
  sg.setApiKey(key);
  await sg.send({ to, from: { email: from, name: env('SENDGRID_FROM_NAME', 'KAkAo') }, subject, text, html: html || text });
}

/** Sends the same code on every available channel at the same time. */
async function sendCodeEverywhere({ phone, email, code, lang = 'en' }) {
  const ar = lang === 'ar';
  const body = ar ? `رمز التحقق: ${code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.` : `Your verification code: ${code}\nValid for 10 minutes. Do not share it.`;
  const tasks = [];
  if (phone) {
    tasks.push(['SMS', sendSms(phone, body)]);
    tasks.push(['WhatsApp', sendWhatsApp(phone, body, code)]);
  }
  if (email) {
    const html = `<div style="font-family:system-ui;text-align:center;padding:24px"><div style="display:inline-block;background:#000;color:#fff;font-weight:900;font-size:28px;width:56px;height:56px;line-height:56px;border-radius:12px">${ar ? 'خ' : 'K'}</div><p>${ar ? 'رمز التحقق' : 'Your code'}</p><h1 style="letter-spacing:8px">${code}</h1></div>`;
    tasks.push(['Email', sendEmail(email, ar ? 'رمز التحقق' : 'Your verification code', body, html)]);
  }
  const results = await Promise.allSettled(tasks.map((t) => t[1]));
  const sentVia = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sentVia.push(tasks[i][0]);
    else console.warn(`[otp] ${tasks[i][0]} failed:`, r.reason && r.reason.message);
  });
  return sentVia;
}

module.exports = { sendSms, sendWhatsApp, sendEmail, sendCodeEverywhere };
