import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  final String? code;
  ApiException(this.status, this.message, {this.code});
  @override
  String toString() => message;
}

/// Thin HTTPS client for the Firebase Functions `api` (works on every
/// platform including Windows, where cloud_functions has no plugin).
/// Retries transient failures with backoff — callers add their own fallback.
class Api {
  static Future<Map<String, String>> _headers() async {
    final h = {'Content-Type': 'application/json'};
    if (AppConfig.firebaseReady) {
      final user = FirebaseAuth.instance.currentUser;
      final token = await user?.getIdToken();
      if (token != null) h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  static Uri uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${AppConfig.apiBaseUrl}$path').replace(queryParameters: query);

  static Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    int retries = 2,
    Duration timeout = const Duration(seconds: 60),
  }) async {
    if (!AppConfig.apiConfigured) {
      throw ApiException(0, 'offline', code: 'not_configured');
    }
    Object? lastError;
    for (var attempt = 0; attempt <= retries; attempt++) {
      try {
        final res = await http
            .post(uri(path), headers: await _headers(), body: jsonEncode(body))
            .timeout(timeout);
        return _decode(res);
      } on ApiException catch (e) {
        lastError = e;
        if (e.status > 0 && e.status < 500 && e.status != 429) rethrow;
      } catch (e) {
        lastError = e;
      }
      await Future.delayed(Duration(milliseconds: 600 * (attempt + 1)));
    }
    if (lastError is ApiException) throw lastError;
    throw ApiException(0, lastError.toString(), code: 'network');
  }

  static Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    if (!AppConfig.apiConfigured) {
      throw ApiException(0, 'offline', code: 'not_configured');
    }
    final res = await http
        .get(uri(path, query), headers: await _headers())
        .timeout(timeout);
    return _decode(res);
  }

  static Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> data;
    try {
      data = res.body.isEmpty ? {} : Map<String, dynamic>.from(jsonDecode(res.body));
    } catch (_) {
      data = {'error': res.body};
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    throw ApiException(
      res.statusCode,
      (data['error'] ?? 'Request failed').toString(),
      code: data['code']?.toString(),
    );
  }
}
