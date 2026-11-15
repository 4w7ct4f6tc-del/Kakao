import '../core/api.dart';

class Scene {
  final String text;
  final String imagePrompt;
  final String? imageUrl;
  final String emoji;
  Scene(this.text, this.imagePrompt, {this.imageUrl, this.emoji = '🎬'});

  factory Scene.fromJson(Map<String, dynamic> j) => Scene(
        (j['narration'] ?? j['text'] ?? '').toString(),
        (j['imagePrompt'] ?? '').toString(),
        imageUrl: j['imageUrl']?.toString(),
        emoji: (j['emoji'] ?? '🎬').toString(),
      );
}

class VideoJob {
  final String id;
  final String status; // queued | script | images | voice | music | render | done | error
  final int progress; // 0..100
  final String? videoUrl;
  final List<Scene> scenes;
  final String? error;
  VideoJob({required this.id, required this.status, required this.progress, this.videoUrl, this.scenes = const [], this.error});

  factory VideoJob.fromJson(Map<String, dynamic> j) => VideoJob(
        id: (j['id'] ?? '').toString(),
        status: (j['status'] ?? 'queued').toString(),
        progress: (j['progress'] as num?)?.toInt() ?? 0,
        videoUrl: j['videoUrl']?.toString(),
        scenes: (j['scenes'] as List? ?? []).map((e) => Scene.fromJson(Map<String, dynamic>.from(e))).toList(),
        error: j['error']?.toString(),
      );
}

/// Story -> script + scenes (LLM) -> images (DALL·E/Imagen) -> narration
/// (ElevenLabs) -> music -> FFmpeg 1080p MP4 with subtitles (Render service).
class VideoService {
  static Future<String> create({required String story, required String lang, required bool long, String voice = 'female'}) async {
    final res = await Api.post('/video/create', {'story': story, 'lang': lang, 'length': long ? 'long' : 'short', 'voice': voice},
        timeout: const Duration(seconds: 60));
    return res['id'] as String;
  }

  static Future<VideoJob> status(String id) async {
    final res = await Api.get('/video/status', query: {'id': id});
    return VideoJob.fromJson(res);
  }

  /// Instant offline storyboard (always works): splits the story into scenes.
  static List<Scene> localStoryboard(String story) {
    final parts = story
        .split(RegExp(r'(?<=[.!؟?。])\s+|\n+'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    final chunks = <String>[];
    final target = parts.length <= 6 ? 1 : (parts.length / 6).ceil();
    for (var i = 0; i < parts.length; i += target) {
      chunks.add(parts.skip(i).take(target).join(' '));
    }
    const emojis = ['🌅', '🚶', '🏙️', '💡', '⚡', '❤️', '🌙', '🎉', '🌊', '🏁'];
    return [
      for (var i = 0; i < chunks.length && i < 10; i++) Scene(chunks[i], chunks[i], emoji: emojis[i % emojis.length]),
    ];
  }
}
