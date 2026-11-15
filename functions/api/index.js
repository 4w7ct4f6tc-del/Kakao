'use strict';
// Vercel entry: the same KAKAO API (Express) as Firebase Functions / Render.
process.env.RUN_PIPELINE_INLINE = process.env.RUN_PIPELINE_INLINE || 'true';
module.exports = require('../app');
