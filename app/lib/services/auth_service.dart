import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';

import '../core/api.dart';
import '../core/config.dart';
import 'device_service.dart';

enum SocialProvider { google, apple, facebook, github }

class OtpResult {
  final List<String> sentVia;
  final String? requestId;
  OtpResult(this.sentVia, this.requestId);
}

/// All sign-in + smart recovery flows.
///
/// Mobile (Android/iOS): native Firebase `signInWithProvider` for Google,
/// Apple, Facebook, GitHub.
/// Windows (and any platform as a fallback): "auth bridge" — the official
/// provider page opens in the browser, the backend completes OAuth and hands
/// this app a one-time Firebase custom token (polled by nonce).
class AuthService {
  static FirebaseAuth get _auth => FirebaseAuth.instance;

  static User? get currentUser => AppConfig.firebaseReady ? _auth.currentUser : null;

  static Stream<User?> authChanges() =>
      AppConfig.firebaseReady ? _auth.authStateChanges() : Stream.value(null);

  static bool get _nativeOAuth => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  // ---------------- Social ----------------
  static Future<void> signInSocial(SocialProvider p) async {
    if (!AppConfig.firebaseReady) throw ApiException(0, 'Firebase not configured', code: 'not_configured');
    if (kIsWeb) {
      await _auth.signInWithPopup(_provider(p));
    } else if (_nativeOAuth) {
      try {
        await _auth.signInWithProvider(_provider(p));
      } on FirebaseAuthException catch (e) {
        if (e.code == 'web-context-canceled' || e.code == 'canceled') rethrow;
        await _bridge(p.name); // alternative path if the native flow fails
      }
    } else {
      await _bridge(p.name);
    }
    await registerDevice();
  }

  static AuthProvider _provider(SocialProvider p) {
    switch (p) {
      case SocialProvider.google:
        return GoogleAuthProvider()..addScope('email');
      case SocialProvider.apple:
        return AppleAuthProvider()..addScope('email')..addScope('name');
      case SocialProvider.facebook:
        return FacebookAuthProvider()..addScope('email');
      case SocialProvider.github:
        return GithubAuthProvider()..addScope('read:user')..addScope('user:email');
    }
  }

  /// Browser-based OAuth for desktop. Polls up to 3 minutes.
  static Future<void> _bridge(String provider) async {
    final nonce = const Uuid().v4();
    final url = Api.uri('/auth/bridge/start', {'provider': provider, 'nonce': nonce});
    await launchUrl(url, mode: LaunchMode.externalApplication);
    final token = await _pollToken('/auth/bridge/poll', {'nonce': nonce});
    await _auth.signInWithCustomToken(token);
  }

  static Future<String> _pollToken(String path, Map<String, String> query, {Duration max = const Duration(minutes: 3)}) async {
    final end = DateTime.now().add(max);
    while (DateTime.now().isBefore(end)) {
      await Future.delayed(const Duration(seconds: 2));
      try {
        final res = await Api.get(path, query: query);
        if (res['token'] != null) return res['token'] as String;
        if (res['status'] == 'denied') throw ApiException(403, 'denied', code: 'denied');
      } on ApiException catch (e) {
        if (e.code == 'denied') rethrow;
      } catch (_) {}
    }
    throw ApiException(408, 'timeout', code: 'timeout');
  }

  // ---------------- Email / password ----------------
  static Future<void> signInEmail(String email, String password) async {
    await _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    await registerDevice();
  }

  static Future<void> signUpEmail(String name, String email, String password) async {
    final cred = await _auth.createUserWithEmailAndPassword(email: email.trim(), password: password);
    await cred.user?.updateDisplayName(name);
    await registerDevice();
  }

  // ---------------- Phone OTP (SMS + WhatsApp + Email at once) ----------------
  static Future<OtpResult> sendOtp({String? phone, String? email, String purpose = 'login'}) async {
    final res = await Api.post('/otp/send', {'phone': phone, 'email': email, 'purpose': purpose});
    return OtpResult(List<String>.from(res['sentVia'] ?? const []), res['requestId'] as String?);
  }

  static Future<void> verifyOtp({String? phone, String? email, required String code}) async {
    final res = await Api.post('/otp/verify', {'phone': phone, 'email': email, 'code': code}, retries: 0);
    await _auth.signInWithCustomToken(res['token'] as String);
    await registerDevice();
  }

  // ---------------- Trusted device registration ----------------
  static Future<void> registerDevice() async {
    if (currentUser == null) return;
    try {
      await Api.post('/devices/register', {
        'deviceId': await DeviceService.deviceId(),
        'deviceSecret': await DeviceService.deviceSecret(),
        'name': DeviceService.deviceName(),
      }, retries: 0);
      await DeviceService.write('last_uid', currentUser!.uid);
    } catch (_) {}
  }

  // ---------------- Smart recovery ----------------
  /// 1) Biometric on a device that was signed in before.
  static Future<void> recoverWithDevice() async {
    final res = await Api.post('/recovery/device', {
      'deviceId': await DeviceService.deviceId(),
      'deviceSecret': await DeviceService.deviceSecret(),
    }, retries: 0);
    await _auth.signInWithCustomToken(res['token'] as String);
  }

  /// 2) OTP to every channel on file (identifier = email or phone).
  static Future<OtpResult> recoverSendOtp(String identifier) async {
    final res = await Api.post('/recovery/otp/send', {'identifier': identifier});
    return OtpResult(List<String>.from(res['sentVia'] ?? const []), res['requestId'] as String?);
  }

  static Future<void> recoverVerifyOtp(String identifier, String code) async {
    final res = await Api.post('/recovery/otp/verify', {'identifier': identifier, 'code': code}, retries: 0);
    await _auth.signInWithCustomToken(res['token'] as String);
  }

  /// 3) Magic link — open on any device, this device logs in automatically.
  static Future<String> recoverMagicStart(String email) async {
    final res = await Api.post('/recovery/magic', {'email': email});
    return res['id'] as String;
  }

  static Future<void> recoverMagicWait(String id) async {
    final token = await _pollToken('/recovery/magic/poll', {'id': id}, max: const Duration(minutes: 15));
    await _auth.signInWithCustomToken(token);
  }

  /// 4) Approval from another logged-in device.
  static Future<Map<String, dynamic>> recoverApprovalStart(String identifier) async {
    return Api.post('/recovery/approval/request', {
      'identifier': identifier,
      'deviceName': DeviceService.deviceName(),
    });
  }

  static Future<void> recoverApprovalWait(String id) async {
    final token = await _pollToken('/recovery/approval/poll', {'id': id}, max: const Duration(minutes: 10));
    await _auth.signInWithCustomToken(token);
  }

  /// 5) Smart questions.
  static Future<List<String>> recoverQuestions(String identifier) async {
    final res = await Api.post('/recovery/questions/get', {'identifier': identifier});
    return List<String>.from(res['questions'] ?? const []);
  }

  static Future<void> recoverAnswer(String identifier, List<String> answers) async {
    final res = await Api.post('/recovery/questions/verify', {'identifier': identifier, 'answers': answers}, retries: 0);
    await _auth.signInWithCustomToken(res['token'] as String);
  }

  /// After any recovery: set a new password (server-side, bcrypt via Firebase).
  static Future<void> setNewPassword(String password) async {
    await Api.post('/auth/set-password', {'password': password}, retries: 0);
    await registerDevice();
  }

  static Future<void> signOut() async {
    if (AppConfig.firebaseReady) await _auth.signOut();
  }
}
