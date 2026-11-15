import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Per-device identity used for: trusted-device biometric recovery and
/// "approve from another device". The secret never leaves secure storage
/// except to the KAKAO API over HTTPS (server stores only a bcrypt hash).
class DeviceService {
  static const _storage = FlutterSecureStorage();

  static Future<String> deviceId() async {
    var id = await _storage.read(key: 'device_id');
    if (id == null) {
      id = const Uuid().v4();
      await _storage.write(key: 'device_id', value: id);
    }
    return id;
  }

  static Future<String> deviceSecret() async {
    var s = await _storage.read(key: 'device_secret');
    if (s == null) {
      final r = Random.secure();
      s = base64Url.encode(List<int>.generate(32, (_) => r.nextInt(256)));
      await _storage.write(key: 'device_secret', value: s);
    }
    return s;
  }

  static String deviceName() {
    if (kIsWeb) return 'Web browser';
    if (Platform.isIOS) return 'iPhone';
    if (Platform.isAndroid) return 'Android';
    if (Platform.isWindows) return 'Windows PC';
    if (Platform.isMacOS) return 'Mac';
    return 'Device';
  }

  static Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  static Future<String?> read(String key) => _storage.read(key: key);
  static Future<void> delete(String key) => _storage.delete(key: key);
}
