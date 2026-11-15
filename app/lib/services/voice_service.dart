import 'dart:convert';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../core/api.dart';

class VoiceSettings {
  final String voice; // male | female | bahraini | en_us | en_uk | fr | hi | clone
  final double speed; // 0.5 .. 2.0
  final double pitch; // 0.5 .. 1.5
  final double volume; // 0 .. 1
  final bool autoRead;
  final String provider; // elevenlabs | openai

  const VoiceSettings({
    this.voice = 'female',
    this.speed = 1.0,
    this.pitch = 1.0,
    this.volume = 1.0,
    this.autoRead = false,
    this.provider = 'elevenlabs',
  });

  VoiceSettings copyWith({String? voice, double? speed, double? pitch, double? volume, bool? autoRead, String? provider}) =>
      VoiceSettings(
        voice: voice ?? this.voice,
        speed: speed ?? this.speed,
        pitch: pitch ?? this.pitch,
        volume: volume ?? this.volume,
        autoRead: autoRead ?? this.autoRead,
        provider: provider ?? this.provider,
      );

  Map<String, dynamic> toJson() =>
      {'voice': voice, 'speed': speed, 'pitch': pitch, 'volume': volume, 'autoRead': autoRead, 'provider': provider};

  factory VoiceSettings.fromJson(Map<String, dynamic> j) => VoiceSettings(
        voice: (j['voice'] ?? 'female').toString(),
        speed: (j['speed'] as num?)?.toDouble() ?? 1.0,
        pitch: (j['pitch'] as num?)?.toDouble() ?? 1.0,
        volume: (j['volume'] as num?)?.toDouble() ?? 1.0,
        autoRead: j['autoRead'] == true,
        provider: (j['provider'] ?? 'elevenlabs').toString(),
      );
}

/// Real voice: ElevenLabs (primary) / OpenAI TTS (fallback) on the server.
/// Speech-to-text: OpenAI Whisper on the server (any language).
class VoiceService {
  static final AudioPlayer _player = AudioPlayer();
  static final AudioRecorder _recorder = AudioRecorder();

  static Future<void> speak(String text, VoiceSettings s, {String? lang}) async {
    if (text.trim().isEmpty) return;
    final res = await Api.post('/voice/tts', {
      'text': text.length > 2500 ? text.substring(0, 2500) : text,
      'voice': s.voice,
      'speed': s.speed,
      'pitch': s.pitch,
      'provider': s.provider,
      'lang': lang,
    }, timeout: const Duration(seconds: 60));
    final bytes = base64Decode(res['audio'] as String);
    await _player.stop();
    await _player.setVolume(s.volume);
    await _player.play(BytesSource(bytes, mimeType: 'audio/mpeg'));
    try {
      await _player.setPlaybackRate(s.speed);
    } catch (_) {}
  }

  static Future<void> stop() => _player.stop();

  static Future<bool> startRecording() async {
    if (!await _recorder.hasPermission()) return false;
    String path = '';
    if (!kIsWeb) {
      final dir = await getTemporaryDirectory();
      path = '${dir.path}/kakao_${DateTime.now().millisecondsSinceEpoch}.m4a';
    }
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    return true;
  }

  static Future<List<int>?> stopRecording() async {
    final path = await _recorder.stop();
    if (path == null || kIsWeb) return null;
    final f = File(path);
    if (!await f.exists()) return null;
    final bytes = await f.readAsBytes();
    try {
      await f.delete();
    } catch (_) {}
    return bytes;
  }

  /// Whisper — returns {text, lang}.
  static Future<Map<String, String>> transcribe(List<int> audio) async {
    final res = await Api.post('/voice/stt', {'audio': base64Encode(audio), 'format': 'm4a'},
        timeout: const Duration(seconds: 60));
    return {'text': (res['text'] ?? '').toString(), 'lang': (res['lang'] ?? '').toString()};
  }

  /// ElevenLabs instant voice clone (requires explicit consent flag).
  static Future<String> cloneVoice(List<int> audio, String name) async {
    final res = await Api.post('/voice/clone', {
      'audio': base64Encode(audio),
      'name': name,
      'consent': true,
    }, timeout: const Duration(seconds: 120));
    return (res['voiceId'] ?? '').toString();
  }
}
