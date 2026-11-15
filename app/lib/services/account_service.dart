import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';

class IntegrationInfo {
  final String id;
  final String name;
  final String kind; // oauth | apikey
  final String icon;
  final bool connected;
  final String? connectedAt;
  final List<String> scopes;
  IntegrationInfo({
    required this.id,
    required this.name,
    required this.kind,
    required this.icon,
    required this.connected,
    this.connectedAt,
    this.scopes = const [],
  });
}

/// Full integration catalog (mirrors functions/src/lib/providers.js).
/// OAuth providers open their OFFICIAL consent page; services that do not
/// offer third-party OAuth (OpenAI, ElevenLabs, Twilio...) use an API key the
/// user pastes, encrypted server-side (AES-256-GCM).
const integrationCatalog = <Map<String, String>>[
  {'id': 'google', 'name': 'Google (Drive, Sheets, Maps, Gmail, Calendar)', 'kind': 'oauth', 'icon': ''},
  {'id': 'youtube', 'name': 'YouTube', 'kind': 'oauth', 'icon': ''},
  {'id': 'facebook', 'name': 'Facebook', 'kind': 'oauth', 'icon': ''},
  {'id': 'instagram', 'name': 'Instagram', 'kind': 'oauth', 'icon': ''},
  {'id': 'whatsapp', 'name': 'WhatsApp Business', 'kind': 'oauth', 'icon': ''},
  {'id': 'github', 'name': 'GitHub', 'kind': 'oauth', 'icon': ''},
  {'id': 'stripe', 'name': 'Stripe', 'kind': 'oauth', 'icon': ''},
  {'id': 'vercel', 'name': 'Vercel', 'kind': 'oauth', 'icon': ''},
  {'id': 'tiktok', 'name': 'TikTok', 'kind': 'oauth', 'icon': ''},
  {'id': 'supabase', 'name': 'Supabase', 'kind': 'oauth', 'icon': ''},
  {'id': 'firebase', 'name': 'Firebase', 'kind': 'oauth', 'icon': ''},
  {'id': 'cloudflare', 'name': 'Cloudflare', 'kind': 'apikey', 'icon': ''},
  {'id': 'render', 'name': 'Render', 'kind': 'apikey', 'icon': ''},
  {'id': 'telegram', 'name': 'Telegram Bot', 'kind': 'apikey', 'icon': ''},
  {'id': 'twilio', 'name': 'Twilio', 'kind': 'apikey', 'icon': ''},
  {'id': 'sendgrid', 'name': 'SendGrid', 'kind': 'apikey', 'icon': ''},
  {'id': 'benefitpay', 'name': 'BenefitPay (Tap)', 'kind': 'apikey', 'icon': ''},
  {'id': 'paypal', 'name': 'PayPal', 'kind': 'apikey', 'icon': ''},
];

class AccountService {
  static Future<Map<String, dynamic>> profile() => Api.get('/me');

  static Future<List<IntegrationInfo>> integrations() async {
    Map<String, dynamic> connected = {};
    try {
      final res = await Api.get('/integrations');
      connected = Map<String, dynamic>.from(res['connected'] ?? {});
    } catch (_) {}
    return integrationCatalog
        .map((c) => IntegrationInfo(
              id: c['id']!,
              name: c['name']!,
              kind: c['kind']!,
              icon: c['icon']!,
              connected: connected.containsKey(c['id']),
              connectedAt: (connected[c['id']] as Map?)?['connectedAt']?.toString(),
              scopes: List<String>.from((connected[c['id']] as Map?)?['scopes'] ?? const []),
            ))
        .toList();
  }

  /// Opens the provider's official consent page. The callback stores the
  /// token encrypted; the app refreshes the list when the user returns.
  static Future<void> connectOAuth(String provider) async {
    final res = await Api.post('/integrations/start', {'provider': provider});
    await launchUrl(Uri.parse(res['url'] as String), mode: LaunchMode.externalApplication);
  }

  static Future<void> connectApiKey(String provider, String key, {Map<String, String>? extra}) =>
      Api.post('/integrations/apikey', {'provider': provider, 'key': key, 'extra': extra});

  static Future<void> disconnect(String provider) => Api.post('/integrations/disconnect', {'provider': provider});

  // ---- BYOK AI keys ----
  static Future<Map<String, bool>> byokStatus() async {
    try {
      final res = await Api.get('/keys');
      return Map<String, bool>.from(res['keys'] ?? {});
    } catch (_) {
      return {};
    }
  }

  static Future<void> saveByok(String provider, String key) => Api.post('/keys', {'provider': provider, 'key': key});

  // ---- Payments ----
  /// method: stripe | benefitpay | paypal  (Apple Pay / Google Pay via Stripe Checkout)
  static Future<void> checkout(String plan, String method) async {
    final res = await Api.post('/payments/checkout', {'plan': plan, 'method': method});
    await launchUrl(Uri.parse(res['url'] as String), mode: LaunchMode.externalApplication);
  }

  // ---- Devices ----
  static Future<List<Map<String, dynamic>>> devices() async {
    final res = await Api.get('/devices');
    return List<Map<String, dynamic>>.from((res['devices'] as List).map((e) => Map<String, dynamic>.from(e)));
  }

  static Future<List<Map<String, dynamic>>> pendingApprovals() async {
    final res = await Api.get('/devices/approvals');
    return List<Map<String, dynamic>>.from((res['approvals'] as List).map((e) => Map<String, dynamic>.from(e)));
  }

  static Future<void> decide(String id, bool approve) =>
      Api.post('/devices/approvals/decide', {'id': id, 'approve': approve});

  static Future<void> removeDevice(String id) => Api.post('/devices/remove', {'deviceId': id});

  static Future<void> setQuestions(List<String> questions, List<String> answers) =>
      Api.post('/security/questions', {'questions': questions, 'answers': answers});

  static Future<void> savePrefs(Map<String, dynamic> prefs) => Api.post('/me/prefs', prefs);
}
