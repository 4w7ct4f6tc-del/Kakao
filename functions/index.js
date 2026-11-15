'use strict';
/**
 * KAKAO backend — one HTTPS API (`api`) + one Firestore trigger (video pipeline).
 * Every secret lives in functions/.env (see .env.example). Never in the apps.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');

setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'us-central1', maxInstances: 50 });

const { errorHandler } = require('./src/lib/http');

const app = express();
app.set('trust proxy', true);
app.use(cors({ origin: true }));
// Stripe needs the raw body: Firebase exposes it as req.rawBody, so JSON parsing is safe.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'kakao-api', time: new Date().toISOString() }));

app.use(require('./src/routes/auth'));
app.use(require('./src/routes/ai'));
app.use(require('./src/routes/voice'));
app.use(require('./src/routes/builder'));
app.use(require('./src/routes/vision'));
app.use(require('./src/routes/video'));
app.use(require('./src/routes/payments'));
app.use(require('./src/routes/account'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

exports.api = onRequest({ timeoutSeconds: 300, memory: '1GiB', cors: true }, app);

exports.videoPipeline = onDocumentCreated(
  { document: 'videos/{id}', timeoutSeconds: 540, memory: '1GiB' },
  async (event) => {
    const { runVideoPipeline } = require('./src/routes/video');
    await runVideoPipeline(event.params.id);
  },
);

// Exported for tests / local server.
exports._app = app;
