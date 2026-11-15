import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../core/api.dart';

/// Voice preferences. [voice] is the accent: auto (follows the language —
/// Arabic → Bahraini), bahraini, en_us, en_uk, fr, hi, or `clone:ID`.
class VoiceSettings {
  final String voice;
  final String gender; // male | female
  final double speed; // 0.5 .. 2.0
  final double pitch; // 0.5 .. 1.5
  final double volume; // 0 .. 1
  final bool autoRead;
  final String provider; // elevenlabs | openai

  const VoiceSettings({
    this.voice = 'auto',
    this.gender = 'female',
    this.speed = 1.0,
    this.pitch = 1.0,
    this.volume = 1.0,
    this.autoRead = false,
    this.provider = 'elevenlabs',
  });

  bool get isClone => voice.startsWith('clone:');

  VoiceSettings copyWith({String? voice, String? gender, double? speed, double? pitch, double? volume, bool? autoRead, String? provider}) =>
      VoiceSettings(
        voice: voice ?? this.voice,
        gender: gender ?? this.gender,
        speed: speed ?? this.speed,
        pitch: pitch ?? this.pitch,
        volume: volume ?? this.volume,
        autoRead: autoRead ?? this.autoRead,
        provider: provider ?? this.provider,
      );

  Map<String, dynamic> toJson() =>
      {'voice': voice, 'gender': gender, 'speed': speed, 'pitch': pitch, 'volume': volume, 'autoRead': autoRead, 'provider': provider};

  factory VoiceSettings.fromJson(Map<String, dynamic> j) {
    var voice = (j['voice'] ?? 'auto').toString();
    var gender = (j['gender'] ?? 'female').toString();
    if (voice == 'male' || voice == 'female') {
      gender = voice;
      voice = 'auto';
    }
    return VoiceSettings(
      voice: voice,
      gender: gender,
      speed: (j['speed'] as num?)?.toDouble() ?? 1.0,
      pitch: (j['pitch'] as num?)?.toDouble() ?? 1.0,
      volume: (j['volume'] as num?)?.toDouble() ?? 1.0,
      autoRead: j['autoRead'] == true,
      provider: (j['provider'] ?? 'elevenlabs').toString(),
    );
  }

  @override
  bool operator ==(Object other) => other is VoiceSettings && other.toJson().toString() == toJson().toString();

  @override
  int get hashCode => toJson().toString().hashCode;
}

/// Real voice: ElevenLabs (primary) / OpenAI TTS (fallback) on the server.
/// Speech-to-text: OpenAI Whisper on the server (any language).
class VoiceService {
  static final AudioPlayer _player = AudioPlayer();
  static final AudioRecorder _recorder = AudioRecorder();

  /// Speaks [text] with a real human voice. With [followLanguage] the accent
  /// follows the text (Arabic → Bahraini, English → English), keeping the
  /// chosen gender, speed, pitch and volume. A cloned voice is always kept.
  static Future<void> speak(String text, VoiceSettings s, {String? lang, bool followLanguage = false}) async {
    if (text.trim().isEmpty) return;
    final res = await Api.post('/voice/tts', {
      'text': text.length > 2500 ? text.substring(0, 2500) : text,
      'voice': followLanguage && !s.isClone ? 'auto' : s.voice,
      'gender': s.gender,
      'speed': s.speed,
      'pitch': s.pitch,
      'provider': s.provider,
      'lang': lang,
    }, timeout: const Duration(seconds: 60));
    final bytes = base64Decode(res['audio'] as String);
    await _player.stop();
    await _player.setVolume(s.volume);
    // Speed and pitch are applied on the server, so the voice stays natural.
    await _player.play(BytesSource(bytes, mimeType: 'audio/mpeg'));
  }

  static Future<void> stop() => _player.stop();

  /// Plays her MP3 (base64) and completes when she finishes or is interrupted.
  static Future<void> playBase64(String audio, {double volume = 1}) async {
    await _player.stop();
    await _player.setVolume(volume);
    final done = Completer<void>();
    late StreamSubscription<void> a;
    late StreamSubscription<PlayerState> b;
    a = _player.onPlayerComplete.listen((_) => done.isCompleted ? null : done.complete());
    b = _player.onPlayerStateChanged.listen((st) {
      if ((st == PlayerState.stopped || st == PlayerState.paused) && !done.isCompleted) done.complete();
    });
    await _player.play(BytesSource(base64Decode(audio), mimeType: 'audio/mpeg'));
    await done.future;
    await a.cancel();
    await b.cancel();
  }

  static bool _cancelListen = false;

  /// True when the last recording had shouting (used by دانو: "هي هي، تكلم بالعدال").
  static bool lastWasLoud = false;
  static void cancelListening() => _cancelListen = true;

  /// Records until the user stops talking (1.3 s of silence after speech).
  /// Returns null when nothing was said within 8 s. [onLevel] gets 0..1 for the mic animation.
  static Future<List<int>?> listenUntilSilence({void Function(double level)? onLevel}) async {
    if (!await startRecording()) return null;
    _cancelListen = false;
    final started = DateTime.now();
    var lastVoice = DateTime.now();
    var spoke = false;
    var loudFrames = 0;
    final done = Completer<void>();
    final sub = _recorder.onAmplitudeChanged(const Duration(milliseconds: 120)).listen((amp) {
      final level = ((amp.current + 60) / 60).clamp(0.0, 1.0);
      onLevel?.call(level);
      final now = DateTime.now();
      if (amp.current > -10) loudFrames++;
      if (amp.current > -38) {
        spoke = true;
        lastVoice = now;
      }
      final silentFor = now.difference(lastVoice).inMilliseconds;
      final total = now.difference(started).inMilliseconds;
      if (_cancelListen || (spoke && silentFor > 1300) || (!spoke && total > 8000) || total > 30000) {
        if (!done.isCompleted) done.complete();
      }
    });
    await done.future;
    await sub.cancel();
    final bytes = await stopRecording();
    onLevel?.call(0);
    lastWasLoud = loudFrames >= 4;
    return spoke ? bytes : null;
  }


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
      'mime': 'audio/mp4',
      'name': name,
      'consent': true,
    }, timeout: const Duration(seconds: 120));
    return (res['voiceId'] ?? '').toString();
  }
}
