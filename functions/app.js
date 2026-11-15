'use strict';
/**
 * The KAKAO API as a plain Express app — used by Firebase Functions (index.js),
 * Vercel (api/index.js), Render / your PC (server.js) and the tests.
 */
const express = require('express');
const cors = require('cors');

const { errorHandler } = require('./lib/http');

const app = express();
app.set('trust proxy', true);
app.use(cors({ origin: true }));
// Stripe needs the raw body: Firebase sets req.rawBody; elsewhere (Vercel, Render) keep it here.
app.use(express.json({ limit: '25mb', verify: (req, _res, buf) => { if (!req.rawBody) req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'kakao-api', time: new Date().toISOString() }));

app.use(require('./auth'));
app.use(require('./ai'));
app.use(require('./voice'));
app.use(require('./talk'));
app.use(require('./builder'));
app.use(require('./vision'));
app.use(require('./video'));
app.use(require('./payments'));
app.use(require('./account'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
