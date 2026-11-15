'use strict';
const express = require('express');
const { db, env, now, webUrl } = require('../lib/admin');
const { HttpError, wrap, optionalAuth, requireAuth, rateLimit, clientIp } = require('../lib/http');
const { aiJson } = require('../lib/ai');
const { getPlan, isPaid, FREE_APP_LIMIT } = require('../lib/users');

const r = express.Router();

const SECTIONS = ['hero', 'categories', 'products', 'offers', 'booking', 'reviews', 'map', 'contact', 'about'];
const TYPES = ['clothes', 'restaurant', 'grocery', 'salon', 'school', 'gym', 'realestate', 'booking', 'portfolio', 'chat'];

const DESIGN_SCHEMA_HINT = `{"name":"","type":"${TYPES.join('|')}","tagline":"","colors":{"primary":"#RRGGBB","secondary":"#RRGGBB","background":"#RRGGBB","text":"#RRGGBB"},"font":"Cairo|Tajawal|Almarai|Inter|Poppins|Montserrat","logoEmoji":"one emoji","language":"ar|en|...","currency":"BHD|USD|...","sections":[${SECTIONS.map((s) => `"${s}"`).join(',')}],"categories":["",""],"products":[{"id":"p1","name":"","price":0,"category":"","emoji":"","description":""}],"contact":{"whatsapp":"","instagram":"","phone":"","address":""}}`;

const hex = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toUpperCase() : d);
const str = (v, d = '', max = 200) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : d);

/** Validate + clamp an AI/user design so the renderers never break. */
function normalizeDesign(input, { base = {}, lang } = {}) {
  const d = input && typeof input === 'object' ? input : {};
  const b = base || {};
  const colors = { ...(b.colors || {}), ...(d.colors || {}) };
  const products = (Array.isArray(d.products) && d.products.length ? d.products : b.products || []).slice(0, 60).map((p, i) => ({
    id: str(p.id, `p${i}`, 40) || `p${i}`,
    name: str(p.name, `Item ${i + 1}`, 80),
    price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
    category: str(p.category, '', 60),
    emoji: str(p.emoji, '🛍️', 8) || '🛍️',
    image: /^(https?:|data:image)/.test(String(p.image || '')) ? String(p.image) : '',
    description: str(p.description, '', 300),
  }));
  const sections = (Array.isArray(d.sections) ? d.sections : b.sections || ['hero', 'products', 'contact']).filter((s) => SECTIONS.includes(s));
  return {
    id: str(b.id || d.id, String(Date.now()), 60),
    name: str(d.name || b.name, 'My App', 80),
    type: TYPES.includes(d.type) ? d.type : TYPES.includes(b.type) ? b.type : 'clothes',
    tagline: str(d.tagline || b.tagline, '', 140),
    colors: {
      primary: hex(colors.primary, '#111111'),
      secondary: hex(colors.secondary, '#16A34A'),
      background: hex(colors.background, '#FFFFFF'),
      text: hex(colors.text, '#111111'),
    },
    font: str(d.font || b.font, 'Cairo', 40),
    logoEmoji: str(d.logoEmoji || b.logoEmoji, '🛍️', 8),
    heroImage: /^(https?:|data:image)/.test(String(d.heroImage || b.heroImage || '')) ? String(d.heroImage || b.heroImage) : '',
    language: str(d.language || b.language || lang, 'ar', 8),
    currency: str(d.currency || b.currency, 'BHD', 8),
    sections: sections.length ? sections : ['hero', 'products', 'contact'],
    categories: (Array.isArray(d.categories) ? d.categories : b.categories || []).map((c) => str(c, '', 40)).filter(Boolean).slice(0, 12),
    products,
    contact: { whatsapp: '', instagram: '', phone: '', address: '', email: '', ...(b.contact || {}), ...(d.contact || {}) },
    domain: str(b.domain || d.domain, '', 120),
    status: ['draft', 'live'].includes(b.status) ? b.status : 'draft',
    pages: ['home', 'products', 'cart', 'booking', 'contact'],
  };
}

/** POST /builder/generate {prompt, lang, answers{name,colors,sell}, base} -> {design} */
r.post('/builder/generate', optionalAuth, wrap(async (req, res) => {
  const uid = req.user && req.user.uid;
  await rateLimit(`gen:${uid || clientIp(req)}`, 30, 3600);
  const { prompt = '', lang = 'ar', answers = {}, base = {} } = req.body;
  const { data, engine } = await aiJson({
    uid,
    engine: 'claude',
    prompt: `User request: "${String(prompt).slice(0, 1000)}"
Shop/app name: "${answers.name || ''}"
Colors they like: "${answers.colors || ''}"
What they sell / offer: "${answers.sell || ''}"
UI language: "${lang}"

Design a beautiful, realistic mobile app for this business. Write ALL names/texts in the user's language.
Give 6-10 realistic products/services with fair local prices, 3-5 categories, a short catchy tagline, a fitting emoji and harmonious colors that respect the user's color wishes (good contrast between text and background).
Start from this draft and improve it: ${JSON.stringify(base).slice(0, 4000)}
Return JSON exactly in this schema: ${DESIGN_SCHEMA_HINT}`,
  });
  res.json({ design: normalizeDesign(data, { base, lang }), engine });
}));

// ---------------------------------------------------------------- Apps CRUD
r.post('/apps/save', requireAuth, wrap(async (req, res) => {
  const design = normalizeDesign(req.body.design, { base: req.body.design });
  const ref = db.collection('apps').doc(design.id);
  const snap = await ref.get();
  if (snap.exists && snap.data().userId !== req.user.uid) throw new HttpError(403, 'Not your app');
  await ref.set({
    id: design.id,
    userId: req.user.uid,
    name: design.name,
    type: design.type,
    colors: design.colors,
    designJSON: design,
    domain: design.domain,
    status: snap.exists ? snap.data().status : 'draft',
    createdAt: snap.exists ? snap.data().createdAt : now(),
    updatedAt: now(),
  }, { merge: true });
  res.json({ ok: true });
}));

r.get('/apps/list', requireAuth, wrap(async (req, res) => {
  const q = await db.collection('apps').where('userId', '==', req.user.uid).limit(100).get();
  const apps = q.docs.map((d) => ({ ...d.data().designJSON, status: d.data().status, domain: d.data().domain }))
    .sort((a, b) => Number(b.id) - Number(a.id));
  res.json({ apps });
}));

/** Public read for the published web app (Next.js /a/[id]). */
r.get('/apps/public', wrap(async (req, res) => {
  const snap = await db.collection('apps').doc(String(req.query.id || '')).get();
  if (!snap.exists || snap.data().status !== 'live') throw new HttpError(404, 'Not found');
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ design: snap.data().designJSON });
}));

// ---------------------------------------------------------------- Publish
const slugify = (s) => String(s || 'app').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'app';

async function cloudflareCname(name, target) {
  const token = env('CLOUDFLARE_API_TOKEN');
  if (!token) return { ok: false, note: 'Cloudflare token not set' };
  const host = name.toLowerCase();
  const parts = host.split('.');
  let zone = null;
  for (let i = 0; i < parts.length - 1 && !zone; i++) {
    const candidate = parts.slice(i).join('.');
    const z = await (await fetch(`https://api.cloudflare.com/client/v4/zones?name=${candidate}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    if (z.result && z.result.length) zone = z.result[0];
  }
  if (!zone) return { ok: false, note: `Domain ${host} is not in your Cloudflare account. Add it to Cloudflare (or buy it at Cloudflare Registrar) then publish again.` };
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'CNAME', name: host, content: target, proxied: false, ttl: 1 }),
  });
  const d = await res.json();
  const exists = !d.success && (d.errors || []).some((e) => e.code === 81053 || e.code === 81057);
  return { ok: d.success || exists, note: d.success ? `DNS ${host} → ${target}` : exists ? 'DNS record already exists' : `Cloudflare: ${JSON.stringify(d.errors)}` };
}

async function vercelAddDomain(domain) {
  const token = env('VERCEL_TOKEN');
  const project = env('VERCEL_PROJECT_ID');
  if (!token || !project) return { ok: false, note: 'Vercel token/project not set' };
  const team = env('VERCEL_TEAM_ID');
  const res = await fetch(`https://api.vercel.com/v10/projects/${project}/domains${team ? `?teamId=${team}` : ''}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain }),
  });
  const d = await res.json();
  const ok = res.ok || d.error?.code === 'domain_already_in_use_by_project' || d.error?.code === 'domain_already_exists';
  return { ok, note: ok ? `Vercel domain ${domain} added` : `Vercel: ${d.error?.message || res.status}` };
}

/** Creates a GitHub repo from the Flutter app template + commits design.json -> Actions builds APK/web. */
async function githubRepo(design, slug) {
  const token = env('GITHUB_TOKEN');
  const owner = env('GITHUB_OWNER');
  const template = env('GITHUB_TEMPLATE_REPO'); // e.g. your-org/kakao-app-template
  if (!token || !owner || !template) return { ok: false, note: 'GitHub token/owner/template not set' };
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kakao', 'Content-Type': 'application/json' };
  const name = `kakao-${slug}-${String(design.id).slice(-5)}`;
  let repo = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers: h });
  if (repo.status === 404) {
    repo = await fetch(`https://api.github.com/repos/${template}/generate`, {
      method: 'POST', headers: h, body: JSON.stringify({ owner, name, private: true, description: `${design.name} — built with KAkAo` }),
    });
    if (!repo.ok) return { ok: false, note: `GitHub: ${(await repo.text()).slice(0, 160)}` };
    await new Promise((r2) => setTimeout(r2, 3000)); // template copy is async
  }
  const path = 'assets/design.json';
  const cur = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${path}`, { headers: h });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const put = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${path}`, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ message: `Update design: ${design.name}`, content: Buffer.from(JSON.stringify(design, null, 2)).toString('base64'), sha }),
  });
  if (!put.ok) return { ok: false, note: `GitHub commit: ${put.status}` };
  return { ok: true, repoUrl: `https://github.com/${owner}/${name}`, apkUrl: `https://github.com/${owner}/${name}/releases/latest` };
}

/** POST /apps/publish {design, domain?} */
r.post('/apps/publish', requireAuth, wrap(async (req, res) => {
  const uid = req.user.uid;
  const plan = await getPlan(uid);
  const design = normalizeDesign(req.body.design, { base: req.body.design });
  const ref = db.collection('apps').doc(design.id);
  const existing = await ref.get();
  if (existing.exists && existing.data().userId !== uid) throw new HttpError(403, 'Not your app');
  if (!isPaid(plan)) {
    const live = await db.collection('apps').where('userId', '==', uid).where('status', '==', 'live').get();
    if (live.docs.filter((d) => d.id !== design.id).length >= FREE_APP_LIMIT) throw new HttpError(402, 'Free plan includes 3 apps', 'plan');
  }
  const slug = slugify(design.name);
  const notes = [];
  const url = `${webUrl()}/a/${design.id}`;
  let customDomain = null;

  // Free subdomain on your own zone: <slug>.<APPS_BASE_DOMAIN>
  const baseDomain = env('APPS_BASE_DOMAIN');
  if (baseDomain) {
    const sub = `${slug}-${String(design.id).slice(-4)}.${baseDomain}`;
    const v = await vercelAddDomain(sub);
    const c = await cloudflareCname(sub, 'cname.vercel-dns.com');
    notes.push(v.note, c.note);
    if (v.ok && c.ok) customDomain = sub;
  }

  // Custom domain (paid)
  const requested = String(req.body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (requested) {
    if (!isPaid(plan)) notes.push('Custom domain is a paid feature');
    else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(requested)) notes.push('Invalid domain');
    else {
      const v = await vercelAddDomain(requested);
      const c = await cloudflareCname(requested, 'cname.vercel-dns.com');
      notes.push(v.note, c.note);
      if (v.ok && c.ok) customDomain = requested;
    }
  }

  let gh = { ok: false };
  if (isPaid(plan)) {
    gh = await githubRepo({ ...design, status: 'live' }, slug).catch((e) => ({ ok: false, note: e.message }));
    if (gh.note) notes.push(gh.note);
  }

  await ref.set({
    id: design.id, userId: uid, name: design.name, type: design.type, colors: design.colors,
    designJSON: { ...design, status: 'live', domain: customDomain || '' },
    domain: customDomain || '', status: 'live', url, repoUrl: gh.repoUrl || null,
    createdAt: existing.exists ? existing.data().createdAt : now(), publishedAt: now(),
  }, { merge: true });
  if (customDomain) await db.collection('domains').doc(customDomain).set({ appId: design.id, userId: uid, createdAt: now() });

  res.json({ url, customDomain, repoUrl: gh.repoUrl, apkUrl: gh.apkUrl, notes: notes.filter(Boolean) });
}));

/** Resolve a custom domain -> app id (used by the Next.js middleware). */
r.get('/apps/by-domain', wrap(async (req, res) => {
  const snap = await db.collection('domains').doc(String(req.query.host || '').toLowerCase()).get();
  if (!snap.exists) throw new HttpError(404, 'Not found');
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ appId: snap.data().appId });
}));

module.exports = r;
module.exports.normalizeDesign = normalizeDesign;
module.exports.DESIGN_SCHEMA_HINT = DESIGN_SCHEMA_HINT;
