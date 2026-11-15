'use strict';
/**
 * KAKAO backend — one HTTPS API (`api`) + one Firestore trigger (video pipeline).
 * Every secret lives in functions/.env (see .env.example). Never in the apps.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'us-central1', maxInstances: 50 });

const app = require('./app');

exports.api = onRequest({ timeoutSeconds: 300, memory: '1GiB', cors: true }, app);

exports.videoPipeline = onDocumentCreated(
  { document: 'videos/{id}', timeoutSeconds: 540, memory: '1GiB' },
  async (event) => {
    const { runVideoPipeline } = require('./video');
    await runVideoPipeline(event.params.id);
  },
);

// Exported for tests / local server.
exports._app = app;
