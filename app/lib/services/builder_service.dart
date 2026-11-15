import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../models/app_design.dart';
import '../models/templates.dart';

class PublishResult {
  final String url;
  final String? customDomain;
  final String? apkUrl;
  final String? repoUrl;
  final List<String> notes;
  PublishResult(this.url, {this.customDomain, this.apkUrl, this.repoUrl, this.notes = const []});
}

/// App builder engine (client side). The server AI (Claude) produces the
/// JSON design; the local template engine is the instant fallback.
class BuilderService {
  /// Step 1+2: intent -> JSON design.
  static Future<AppDesign> generate({
    required String prompt,
    required String lang,
    String? name,
    String? colors,
    String? sell,
  }) async {
    final local = buildLocalDesign(prompt: prompt, lang: lang, name: name, colorsText: colors, sellText: sell);
    try {
      final res = await Api.post('/builder/generate', {
        'prompt': prompt,
        'lang': lang,
        'answers': {'name': name, 'colors': colors, 'sell': sell},
        'base': local.toJson(),
      }, timeout: const Duration(seconds: 60), retries: 1);
      return AppDesign.fromJson(Map<String, dynamic>.from(res['design']));
    } catch (_) {
      return local;
    }
  }

  /// AI image (DALL·E / Imagen on server). Returns URL or data URL.
  static Future<String?> aiImage(String prompt) async {
    try {
      final res = await Api.post('/images/generate', {'prompt': prompt}, timeout: const Duration(seconds: 90));
      return res['url']?.toString();
    } catch (_) {
      return null;
    }
  }

  static Future<String?> uploadImage(List<int> bytes, String mime) async {
    try {
      final res = await Api.post('/images/upload', {'data': base64Encode(bytes), 'mime': mime},
          timeout: const Duration(seconds: 60));
      return res['url']?.toString();
    } catch (_) {
      return 'data:$mime;base64,${base64Encode(bytes)}';
    }
  }

  static Future<void> saveDraft(AppDesign d) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList('my_apps') ?? [];
    final others = list.where((s) => (jsonDecode(s) as Map)['id'] != d.id).toList();
    others.insert(0, jsonEncode(d.toJson()));
    await prefs.setStringList('my_apps', others.take(50).toList());
    try {
      await Api.post('/apps/save', {'design': d.toJson()}, retries: 0, timeout: const Duration(seconds: 20));
    } catch (_) {}
  }

  static Future<List<AppDesign>> myApps() async {
    try {
      final res = await Api.get('/apps/list');
      return (res['apps'] as List).map((e) => AppDesign.fromJson(Map<String, dynamic>.from(e))).toList();
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      return (prefs.getStringList('my_apps') ?? [])
          .map((s) => AppDesign.fromJson(Map<String, dynamic>.from(jsonDecode(s))))
          .toList();
    }
  }

  /// Step 5–7: publish web app (Vercel), connect domain (Cloudflare),
  /// push source to GitHub and trigger APK build (GitHub Actions).
  static Future<PublishResult> publish(AppDesign d, {String? domain}) async {
    final res = await Api.post('/apps/publish', {'design': d.toJson(), 'domain': domain},
        timeout: const Duration(seconds: 120), retries: 1);
    return PublishResult(
      (res['url'] ?? '${AppConfig.webBaseUrl}/a/${d.id}').toString(),
      customDomain: res['customDomain']?.toString(),
      apkUrl: res['apkUrl']?.toString(),
      repoUrl: res['repoUrl']?.toString(),
      notes: List<String>.from(res['notes'] ?? const []),
    );
  }
}
