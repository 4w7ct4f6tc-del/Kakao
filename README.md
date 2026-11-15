# KAkAo · خعخعو

**The easiest app builder in the world.** Write what you want in one box, see a live app in a phone frame, edit it, approve, and publish it with a link and a QR code.

Windows + Android + iPhone from **one Flutter codebase**, a **Next.js 14** web version, and a **Firebase** backend.

> خعخعو • © 2026 K.A Familia Global Company — B.K.A Famy — Owner: alansari

---

## العربية — تشغيل سريع

1. **ويندوز (ضغطة وحدة):** افتح `start.bat`.
   - إذا التطبيق مبني من قبل، يفتح على طول.
   - إذا مو مبني، يبنيه بـ Flutter ويفتحه. (أول مرة تاخذ كم دقيقة.)
2. **بدون أي مفاتيح** يشتغل التطبيق في الوضع الفوري: المنشئ، المعاينة المباشرة، المحرر، القوالب العشرة، ولوحة قصة الفيديو كلها تشتغل على جهازك.
3. **عشان تشتغل كل المزايا** (الذكاء الاصطناعي، رموز OTP، الصوت الحقيقي، الدفع، النشر): حط المفاتيح في `functions/.env` (انسخه من `functions/.env.example`) واتبع الخطوات تحت.
4. **APK + EXE + IPA:** ارفع المشروع على GitHub، وGitHub Actions يبنيهم تلقائياً في كل دفعة (تبويب **Actions ← Artifacts**). وإذا سويت tag مثل `v1.0.0` ينزلون في صفحة Releases.

> **أهم نقطة:** كل المفاتيح السرية مكانها `functions/.env` بس، وعمرها ما تنحط داخل التطبيق.

---

## Design

The UI follows the owner's design exactly, in the Flutter app and on the web:

- **Colors:** background `#0F0F0F`, white cards, black buttons, green `#16A34A` approve button. White text on dark, black text on cards.
- **Header:** logo with خعخعو / KAkAo and **B.K.A Famy** under it on one side, the **عربي | English** button on the other, then a one-line description centered.
- **Tabs:** 4 in one row: دخول / مصنع / فيديو / إعدادات. The selected tab is white, the others dark grey.
- **Cards:** radius 22px, padding 16px, max width 460px, centered.
- **Fonts:** Cairo for Arabic, Inter for English.
- **Rule:** one screen = one task, with big buttons.

The shared pieces live in `app/lib/widgets/kakao_ui.dart` and `web/components/ui.tsx`.

## What's inside

```
kakao/
  app/                         Flutter app (Windows, Android, iPhone)
    lib/main.dart              entry: login → Face ID lock → app
    lib/screens/               auth/ (login, phone OTP, email, smart recovery), builder/, video/, camera/, settings/, home/
    lib/services/              auth, ai, voice, camera, builder, video, account (payments + integrations), biometric
    lib/models/                design schema; templates_data.dart is generated from templates/
    pubspec.yaml
  functions/                   Server (Firebase Functions, or `node server.js` on Render)
    index.js                   HTTPS `api` + video trigger
    auth.js                    login + phone OTP (SMS + WhatsApp + email) + smart recovery + devices
    ai.js                      ChatGPT + Claude + Meta + Gemini router, fallback, BYOK, /ai/chat, /translate
    payments.js                Stripe (card, Apple Pay, Google Pay) + BenefitPay (Tap) + PayPal
    builder.js voice.js vision.js video.js account.js   builder/publish, voice, camera AI, video jobs, integrations
    lib/                       shared helpers (Firebase admin, encryption, rate limits, messaging, users)
    server.js                  run the same API as a plain Node server (Render)
  web/                         Next.js 14 + Tailwind, same design as the Flutter app
    app/builder                one box → 3 questions → live preview in a phone frame → publish
    app/templates              every template live in a phone frame
    components/PreviewApp.tsx  the live app renderer (also serves published apps at /a/<id>)
    preview/build.mjs          builds the single-file live preview page
  video-service/               Story → MP4 (Docker on Render)
    script.js                  story → script and scenes (OpenAI → Claude → offline splitter)
    voice.js                   ElevenLabs real voice (OpenAI TTS fallback)
    images.js                  one image per scene (gpt-image → Imagen)
    assemble.js                FFmpeg: images + voice + music + subtitles → 1080p MP4
    server.js                  POST /story and /render
  templates/                   the templates every user app is built from
    clothes-shop/ restaurant/ grocery/ salon/ school/ gym/
    real-estate/ booking-clinic/ portfolio/ chat-app/
      template.json            edit this (colors, sections, products in AR + EN)
      design.ar.json / design.en.json   ready designs
    sync.js                    `node templates/sync.js` regenerates the Flutter + web template data
    _flutter-app/              Flutter app each published app is built from (customer APK + owner Admin APK)
  start.bat                    one click: opens the app on Windows
  render.yaml                  Render blueprint (API + video service)
  .github/workflows/           build.yml (APK, EXE, IPA, tests) + deploy.yml (Vercel, Render, Firebase, Cloudflare)
```

Every template includes Home, Products, Search, Cart, Checkout, WhatsApp order, Booking, Map, Reviews and an Admin Panel.

### Feature map

| Feature | Where | Works offline? |
|---|---|---|
| One box → 3 questions → live phone preview → edit → consent → connect → publish + QR | `app/lib/screens/builder/*`, `web/app/builder` | Yes. A local template engine gives instant results; AI (Claude) improves them when keys are set |
| Interactive generated app: Home, Products, Search, Cart, WhatsApp checkout, Booking, Contact, Instagram, Map, Reviews, Admin (add products) | `phone_preview.dart`, `web/components/PreviewApp.tsx` | Yes |
| AI picker (ChatGPT / Claude / Meta AI / Gemini / Auto). The same chat continues when you switch | `home_screen.dart` → `/ai/chat` | Gives a helpful offline reply |
| Auto-route (code → Claude, writing → ChatGPT, images → Gemini, fast → Meta). Fallback: up to 3 tries on other engines | `functions/ai.js` | — |
| BYOK: users paste their own OpenAI, Anthropic, Gemini, Llama or ElevenLabs keys, stored encrypted with AES-256-GCM | Settings → My own API keys | — |
| Login: Google, Apple, Facebook, GitHub, phone OTP, email, Face ID / fingerprint | `auth_service.dart`, `functions/auth.js` | Guest mode |
| One OTP code sent at the same time by SMS + WhatsApp + email | `functions/lib/notify.js` | — |
| Smart recovery: biometric on a trusted device, OTP on all channels, magic link, approval from another device, smart questions → new password | `recovery_screen.dart`, `functions/auth.js` | — |
| Auto language (device locale + script detection + "تكلم فرنسي"). RTL for Arabic, Persian and Urdu. Any other language is translated on the fly | `core/i18n.dart` | Arabic and English are bundled |
| Real voice: ElevenLabs, with OpenAI TTS as fallback. Male / Female / Bahraini / EN / FR / HI voices, speed, pitch (FFmpeg), volume, test button, auto-read, 30-second voice clone with consent | `voice_settings_screen.dart`, `functions/voice.js` | — |
| Speech-to-text in any language (Whisper) | mic in chat | — |
| Smart camera: photo → app (name, colors, products, prices), translate text in a photo, QR/barcode, document scan, ID card → signup fields. Photos never go to your gallery | `camera_screen.dart`, `functions/vision.js` | On-device ML Kit OCR + local design |
| Story → video: script and scenes → images → narration → music → FFmpeg 1080p MP4 with subtitles | `video_screen.dart`, `functions/video.js`, `video-service/` | An instant storyboard you can play with a voice |
| Integrations, each with a Connect button that opens the official site, an encrypted token, and Disconnect + revoke: Google (Drive, Sheets, Maps, Gmail, Calendar), YouTube, Facebook, Instagram, WhatsApp, GitHub, Stripe, Vercel, TikTok, Supabase, Firebase; plus Cloudflare, Render, Telegram, Twilio, SendGrid, BenefitPay and PayPal by API key | `integrations_screen.dart`, `functions/account.js` | — |
| Plans: Free (3 apps, 1 connection, Meta + basic Claude) / Pro / Ultra. Payment by Stripe (card, Apple Pay, Google Pay), BenefitPay or PayPal | `plans_screen.dart`, `functions/payments.js` | — |
| Publishing: web link + QR, free subdomain, custom domain (Cloudflare DNS + Vercel), GitHub repo + APK build | `functions/builder.js` | Shows the share link |

---

## Where to paste each key

All server keys go in **`functions/.env`**. Copy it from `functions/.env.example`. Anything still set to `YOUR_...` counts as "not configured", and that feature switches to its fallback instead of crashing.

| Key(s) | Get it from | Unlocks |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com | ChatGPT, DALL·E / gpt-image, Whisper, OpenAI voice |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Claude (Opus 5.5 for Ultra, Sonnet 5.5 for Pro, Haiku 5.5 for Free). Also generates app designs |
| `GEMINI_API_KEY` | aistudio.google.com | Gemini, vision, Imagen |
| `META_LLAMA_API_KEY` | console.groq.com (or Together AI) | Meta AI (Llama), the free and fast engine |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_*` | elevenlabs.io | Real voice. Pick a Gulf/Bahraini voice in the Voice Library and paste its ID into `ELEVENLABS_VOICE_BAHRAINI` |
| `TWILIO_*` | twilio.com | SMS OTP (+ WhatsApp sandbox) |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE` | Meta for Developers → WhatsApp | Production WhatsApp OTP (needs an approved authentication template) |
| `SENDGRID_*` | sendgrid.com | Email OTP + magic links |
| `GOOGLE_OAUTH_*`, `GITHUB_OAUTH_*`, `FACEBOOK_APP_*`, `APPLE_*` | each provider's developer console | Windows login (browser bridge) + Connect integrations |
| `STRIPE_*` | dashboard.stripe.com | Card / Apple Pay / Google Pay checkout + Stripe Connect |
| `TAP_SECRET_KEY` | tap.company | BenefitPay (Bahrain) |
| `PAYPAL_*` | developer.paypal.com | PayPal |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` | vercel.com → Settings → Tokens | Custom domains on published apps |
| `CLOUDFLARE_API_TOKEN`, `APPS_BASE_DOMAIN` | dash.cloudflare.com | DNS for custom domains and free subdomains |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_TEMPLATE_REPO` | github.com → Settings → Developer settings | Repo + APK for each published app |
| `VIDEO_SERVICE_URL`, `VIDEO_SERVICE_SECRET`, `MUSIC_TRACK_*` | your Render service | Story → MP4 |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` | Encrypts tokens and BYOK keys (**required**) |

The client apps hold **no secrets**. They only need:
- `app/lib/firebase_options.dart`. Generate it with `flutterfire configure`.
- The API URL: `--dart-define=KAKAO_API=...` (or `kakao.config.bat` for `start.bat`).
- `web/.env.local`. Copy it from `web/.env.example`.

---

## Setup step by step

### 1. Firebase
```bash
npm i -g firebase-tools
firebase login
# Create a project at console.firebase.google.com → set its id in .firebaserc
# Enable: Authentication (Google, Apple, Facebook, GitHub, Email/Password, Phone), Firestore, Storage
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 2. Backend (Firebase Functions)
```bash
cd functions
cp .env.example .env     # fill in your keys
npm install
npm test                 # 9 unit/integration tests
firebase deploy --only functions
```
Your API URL will be `https://us-central1-<project>.cloudfunctions.net/api`. Put it in `PUBLIC_API_URL`.

Register these redirect URIs with each OAuth provider:
- `{PUBLIC_API_URL}/auth/bridge/callback` for login on Windows
- `{PUBLIC_API_URL}/integrations/callback` for Connect X

Webhooks:
- Stripe: `{PUBLIC_API_URL}/payments/stripe/webhook`, event `checkout.session.completed`
- Tap: set automatically per charge

### 3. Deploy everything to ONE link (Vercel + Render + Cloudflare)

One domain serves the app, the API and every published user app:

```
https://kakao.yourdomain.com          → Vercel (web/)          ← Cloudflare DNS
https://kakao.yourdomain.com/api/...  → proxied to Render (functions/server.js)
https://kakao.yourdomain.com/a/<id>   → published user apps
video-service                         → Render (Docker), called by the API
```

1. **Render:** render.com → New → **Blueprint** → pick this repo. `render.yaml` creates `kakao-api` and `kakao-video-service`. Paste `FIREBASE_SERVICE_ACCOUNT` (Firebase → Project settings → Service accounts → Generate key) and the keys from `functions/.env.example`. Set `PUBLIC_API_URL=https://kakao.yourdomain.com/api` and `VIDEO_SERVICE_URL=https://kakao-video-service.onrender.com`.
2. **Vercel:** vercel.com → Import the repo → **Root Directory = `web`**. Env: `KAKAO_API_ORIGIN=https://kakao-api.onrender.com`, `NEXT_PUBLIC_KAKAO_API=/api`, plus the Firebase web values from `web/.env.example`.
3. **Cloudflare:** add your domain, then a DNS record `CNAME kakao → cname.vercel-dns.com` (DNS only). In Vercel → Domains, add `kakao.yourdomain.com`.
4. **Auto-deploy on every push:** add these GitHub secrets and `.github/workflows/deploy.yml` redeploys the same link each time: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_VIDEO`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` (optional: `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`).

### 4. Web only, without Render
You can also call Firebase Functions directly: set `NEXT_PUBLIC_KAKAO_API=https://us-central1-<project>.cloudfunctions.net/api` in Vercel.

### 5. Flutter app
```bash
cd app
dart pub global activate flutterfire_cli
flutterfire configure --project=<project> --platforms=android,ios,windows,web
flutter pub get
flutter run -d windows   --dart-define=KAKAO_API=https://...cloudfunctions.net/api   # or -d android / -d ios
```

## Build APK, EXE and IPA

**Automatic:** push to GitHub and `.github/workflows/build.yml` builds all three. Download them from **Actions → run → Artifacts**. To publish them as a Release, push a tag: `git tag v1.0.0 && git push --tags`.

**Manual:**
```bash
cd app
flutter build apk --release       # build/app/outputs/flutter-apk/app-release.apk
flutter build windows --release   # build/windows/x64/runner/Release/kakao.exe
flutter build ipa                 # needs a Mac + Apple Developer account (signing)
```

---

## Notes before launch

- **App Store and Google Play:** an IPA needs an Apple Developer account to sign it, and store releases go through Apple/Google review. CI builds an unsigned IPA. Add Fastlane with your accounts to upload automatically.
- **Domains:** publishing connects any domain that is in your Cloudflare account (DNS + Vercel). New domains are bought in the Cloudflare Registrar dashboard; the publisher then connects them automatically. Every app also gets a free link (`/a/<id>`) and, if `APPS_BASE_DOMAIN` is set, a free subdomain.
- **WhatsApp OTP in production** needs a Meta-approved authentication template. Twilio's WhatsApp sandbox works for testing.
- **Meta AI** runs on Meta's Llama models through an OpenAI-compatible host (Groq by default). **Background music** uses your licensed tracks (`MUSIC_TRACK_*`) or any music-generation API at `MUSIC_API_URL`.
- **Legal text** in `web/app/legal` is a template. Have it reviewed before launch.
- **Model names** can be changed in `.env` without touching code (`OPENAI_MODEL`, `CLAUDE_MODEL_*`, `GEMINI_MODEL`, `META_MODEL`).

## Security
- Secrets exist only on the server. User tokens and BYOK keys are encrypted with AES-256-GCM.
- Firebase Auth issues JWTs and refresh tokens. Passwords are hashed by Firebase. OTP codes, device secrets and recovery answers are stored as bcrypt hashes.
- Firestore rate limits protect OTP, recovery, chat and generation. Account enumeration is blocked on recovery.
- Firestore/Storage rules deny all client writes. Everything goes through the API with ID-token checks.

---

KAkAo • © 2026 K.A Familia Global Company
