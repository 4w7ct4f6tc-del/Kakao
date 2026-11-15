import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/i18n.dart';
import '../models/app_design.dart';
import '../services/ai_service.dart';
import '../services/auth_service.dart';
import '../services/voice_service.dart';

late SharedPreferences prefs;

// ---------------- Language (auto) ----------------
class LanguageNotifier extends Notifier<String> {
  @override
  String build() => prefs.getString('lang') ?? I18n.deviceLanguage();

  Future<void> set(String lang) async {
    if (lang == state) return;
    await I18n.ensureLoaded(lang);
    state = lang;
    await prefs.setString('lang', lang);
  }

  /// Called with everything the user types/says. Switches only on explicit
  /// command or on a confident change of script/language.
  Future<void> observe(String text) async {
    final cmd = I18n.detectSwitchCommand(text);
    if (cmd != null) return set(cmd);
    final detected = I18n.detectFromText(text);
    if (detected != null && detected != state && text.trim().length >= 6) await set(detected);
  }
}

final languageProvider = NotifierProvider<LanguageNotifier, String>(LanguageNotifier.new);

/// Shortcut translator bound to current language.
final tProvider = Provider<String Function(String)>((ref) {
  final lang = ref.watch(languageProvider);
  return (key) => I18n.t(lang, key);
});

// ---------------- Auth ----------------
final authProvider = StreamProvider<User?>((ref) => AuthService.authChanges());

class GuestNotifier extends Notifier<bool> {
  @override
  bool build() => prefs.getBool('guest') ?? false;
  Future<void> set(bool v) async {
    state = v;
    await prefs.setBool('guest', v);
  }
}

final guestProvider = NotifierProvider<GuestNotifier, bool>(GuestNotifier.new);

// ---------------- Plan ----------------
class PlanNotifier extends Notifier<String> {
  @override
  String build() => prefs.getString('plan') ?? 'free';
  Future<void> set(String plan) async {
    state = plan;
    await prefs.setString('plan', plan);
  }

  bool get isPaid => state == 'pro' || state == 'ultra';
}

final planProvider = NotifierProvider<PlanNotifier, String>(PlanNotifier.new);

// ---------------- AI choice ----------------
class AiChoiceNotifier extends Notifier<AiEngine> {
  @override
  AiEngine build() {
    final saved = prefs.getString('ai');
    return AiEngine.values.firstWhere((e) => e.name == saved, orElse: () => AiEngine.auto);
  }

  Future<void> set(AiEngine e) async {
    state = e;
    await prefs.setString('ai', e.name);
  }
}

final aiChoiceProvider = NotifierProvider<AiChoiceNotifier, AiEngine>(AiChoiceNotifier.new);

// ---------------- Chat (one shared history across AIs) ----------------
class ChatNotifier extends Notifier<List<ChatMessage>> {
  @override
  List<ChatMessage> build() => [];
  void add(ChatMessage m) => state = [...state, m];
  void clear() => state = [];
}

final chatProvider = NotifierProvider<ChatNotifier, List<ChatMessage>>(ChatNotifier.new);

// ---------------- Voice ----------------
class VoiceNotifier extends Notifier<VoiceSettings> {
  @override
  VoiceSettings build() {
    final s = prefs.getString('voice');
    return s == null ? const VoiceSettings() : VoiceSettings.fromJson(jsonDecode(s));
  }

  Future<void> update(VoiceSettings v) async {
    state = v;
    await prefs.setString('voice', jsonEncode(v.toJson()));
  }
}

final voiceProvider = NotifierProvider<VoiceNotifier, VoiceSettings>(VoiceNotifier.new);

// ---------------- Biometric lock ----------------
class BioLockNotifier extends Notifier<bool> {
  @override
  bool build() => prefs.getBool('bio_lock') ?? false;
  Future<void> set(bool v) async {
    state = v;
    await prefs.setBool('bio_lock', v);
  }
}

final bioLockProvider = NotifierProvider<BioLockNotifier, bool>(BioLockNotifier.new);

// ---------------- Builder hand-off ----------------
/// Text / design handed to the builder from chat or camera.
class BuilderSeed {
  final String? prompt;
  final AppDesign? design;
  const BuilderSeed({this.prompt, this.design});
}

class BuilderSeedNotifier extends Notifier<BuilderSeed?> {
  @override
  BuilderSeed? build() => null;
  void set(BuilderSeed? s) => state = s;
}

final builderSeedProvider = NotifierProvider<BuilderSeedNotifier, BuilderSeed?>(BuilderSeedNotifier.new);

// ---------------- Bottom nav ----------------
class TabNotifier extends Notifier<int> {
  @override
  int build() => 0;
  void set(int i) => state = i;
}

final tabProvider = NotifierProvider<TabNotifier, int>(TabNotifier.new);
