/// Central configuration. Nothing secret lives here: every AI / payment /
/// messaging key is stored on the server (Firebase Functions `.env`) or as a
/// per-user BYOK key encrypted in Firestore.
///
/// Override at build time:
///   flutter run --dart-define=KAKAO_API=https://REGION-PROJECT.cloudfunctions.net/api
///   flutter run --dart-define=KAKAO_WEB=https://kakao.yourdomain.com
class AppConfig {
  /// Base URL of the Firebase Functions HTTPS API (functions/index.js -> `api`).
  static const String apiBaseUrl = String.fromEnvironment(
    'KAKAO_API',
    defaultValue: 'https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/api',
  );

  /// Public web app (Next.js on Vercel). Published apps live at `$webBaseUrl/a/<id>`.
  static const String webBaseUrl = String.fromEnvironment(
    'KAKAO_WEB',
    defaultValue: 'https://YOUR_WEB_DOMAIN',
  );

  static bool get apiConfigured => !apiBaseUrl.contains('YOUR_');

  /// Set at startup once Firebase.initializeApp succeeds.
  static bool firebaseReady = false;

  static const int freeAppLimit = 3;
  static const String supportWhatsApp = 'YOUR_SUPPORT_WHATSAPP_NUMBER';
}
