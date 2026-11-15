import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../models/app_design.dart';
import '../models/templates.dart';

enum VisionMode { buildApp, translate, document, idCard }

class VisionResult {
  final String text;
  final AppDesign? design;
  final Map<String, String> fields;
  VisionResult({this.text = '', this.design, this.fields = const {}});
}

/// Camera -> GPT-4o Vision / Gemini Vision on the server, with on-device
/// ML Kit OCR as the instant fallback (Android / iOS).
/// Photos are kept in memory and sent straight to the builder — they are
/// never saved to the user's gallery/album.
class VisionService {
  static final _picker = ImagePicker();

  static bool get cameraSupported => kIsWeb || Platform.isAndroid || Platform.isIOS;
  static bool get scannerSupported => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  static Future<XFile?> pick({required bool camera}) => _picker.pickImage(
        source: camera && cameraSupported ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 85,
        requestFullMetadata: false,
      );

  static Future<VisionResult> analyze(XFile file, VisionMode mode, String lang) async {
    final bytes = await file.readAsBytes();
    final b64 = base64Encode(bytes);
    try {
      final res = await Api.post('/vision/analyze', {
        'image': b64,
        'mime': 'image/jpeg',
        'mode': mode.name,
        'lang': lang,
      }, timeout: const Duration(seconds: 90));
      AppDesign? design;
      if (res['design'] != null) {
        design = AppDesign.fromJson(Map<String, dynamic>.from(res['design']));
      }
      return VisionResult(
        text: (res['text'] ?? '').toString(),
        design: design,
        fields: Map<String, String>.from((res['fields'] as Map?)?.map((k, v) => MapEntry('$k', '$v')) ?? {}),
      );
    } catch (_) {
      // Fallback: on-device OCR, then local design generation from the text.
      final text = await _localOcr(file.path);
      if (mode == VisionMode.buildApp) {
        return VisionResult(text: text, design: buildLocalDesign(prompt: text, lang: lang));
      }
      return VisionResult(text: text);
    }
  }

  static Future<String> _localOcr(String path) async {
    if (kIsWeb || !(Platform.isAndroid || Platform.isIOS)) return '';
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final result = await recognizer.processImage(InputImage.fromFilePath(path));
      return result.text;
    } catch (_) {
      return '';
    } finally {
      await recognizer.close();
    }
  }
}
