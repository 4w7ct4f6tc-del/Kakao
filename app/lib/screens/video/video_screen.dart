import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../core/theme.dart';
import '../../services/video_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'dart:io' show Platform;

/// Story -> full video. While the cloud render runs, an instant storyboard
/// (scenes + voice + subtitles) is playable right away — no waiting screen.
class VideoScreen extends ConsumerStatefulWidget {
  const VideoScreen({super.key});

  @override
  ConsumerState<VideoScreen> createState() => _VideoScreenState();
}

class _VideoScreenState extends ConsumerState<VideoScreen> {
  final story = TextEditingController();
  bool long = false;
  String? jobId;
  VideoJob? job;
  List<Scene> board = [];
  Timer? poll;
  VideoPlayerController? player;
  int playingScene = -1;
  String? error;

  @override
  void dispose() {
    poll?.cancel();
    player?.dispose();
    super.dispose();
  }

  Future<void> _make() async {
    if (story.text.trim().isEmpty) return;
    await ref.read(languageProvider.notifier).observe(story.text);
    final lang = ref.read(languageProvider);
    setState(() {
      board = VideoService.localStoryboard(story.text);
      job = null;
      error = null;
    });
    try {
      jobId = await VideoService.create(story: story.text, lang: lang, long: long, voice: ref.read(voiceProvider).voice);
      poll?.cancel();
      poll = Timer.periodic(const Duration(seconds: 3), (_) => _check());
    } catch (e) {
      setState(() => error = friendlyError(e, lang));
    }
  }

  Future<void> _check() async {
    if (jobId == null) return;
    try {
      final j = await VideoService.status(jobId!);
      setState(() {
        job = j;
        if (j.scenes.isNotEmpty) board = j.scenes;
      });
      if (j.status == 'done' || j.status == 'error') {
        poll?.cancel();
        if (j.videoUrl != null) _initPlayer(j.videoUrl!);
      }
    } catch (_) {}
  }

  bool get _canInlinePlay => kIsWeb || Platform.isAndroid || Platform.isIOS;

  Future<void> _initPlayer(String url) async {
    if (!_canInlinePlay) return;
    final c = VideoPlayerController.networkUrl(Uri.parse(url));
    await c.initialize();
    setState(() => player = c);
  }

  /// Plays the storyboard: each scene narrated with the real voice.
  Future<void> _playBoard() async {
    final voice = ref.read(voiceProvider);
    final lang = ref.read(languageProvider);
    for (var i = 0; i < board.length; i++) {
      if (!mounted) return;
      setState(() => playingScene = i);
      try {
        await VoiceService.speak(board[i].text, voice, lang: lang);
        await Future.delayed(Duration(milliseconds: 600 + board[i].text.length * 60));
      } catch (_) {
        await Future.delayed(const Duration(seconds: 3));
      }
    }
    if (mounted) setState(() => playingScene = -1);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final status = job?.status;
    return Scaffold(
      appBar: AppBar(title: const KakaoTitle()),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(controller: story, minLines: 5, maxLines: 10, decoration: InputDecoration(hintText: t('storyHint'))),
          const SizedBox(height: 12),
          Row(children: [
            Text(t('duration')),
            const SizedBox(width: 12),
            ChoiceChip(label: Text(t('short')), selected: !long, onSelected: (_) => setState(() => long = false)),
            const SizedBox(width: 8),
            ChoiceChip(label: Text(t('long')), selected: long, onSelected: (_) => setState(() => long = true)),
          ]),
          const SizedBox(height: 12),
          BigButton(label: t('makeVideo'), icon: Icons.movie_creation, accent: true, onPressed: _make),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: const TextStyle(color: KColors.muted))),
          if (job != null && status != 'done')
            ProgressWithAlternatives(
              key: ValueKey(jobId),
              label: '${job!.status}…',
              progress: job!.progress / 100,
              slowAfter: const Duration(seconds: 45),
              alternatives: [(t('play'), _playBoard), (t('retry'), _make)],
            ),
          if (player != null) ...[
            const SizedBox(height: 16),
            AspectRatio(aspectRatio: player!.value.aspectRatio, child: VideoPlayer(player!)),
            IconButton(
              icon: Icon(player!.value.isPlaying ? Icons.pause_circle : Icons.play_circle, size: 48),
              onPressed: () => setState(() => player!.value.isPlaying ? player!.pause() : player!.play()),
            ),
          ],
          if (job?.videoUrl != null) ...[
            Text(t('videoReady'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            BigButton(label: t('download'), icon: Icons.download, onPressed: () => launchUrl(Uri.parse(job!.videoUrl!), mode: LaunchMode.externalApplication)),
            BigButton(label: t('share'), icon: Icons.share, onPressed: () => SharePlus.instance.share(ShareParams(text: job!.videoUrl!))),
          ],
          if (board.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(children: [
              Text('${t('storyboard')} • ${board.length} ${t('scenes')}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const Spacer(),
              IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: KColors.accent),
                icon: const Icon(Icons.play_arrow),
                onPressed: _playBoard,
              ),
            ]),
            const SizedBox(height: 8),
            for (var i = 0; i < board.length; i++) _sceneCard(i),
          ],
          const KakaoFooter(),
        ],
      ),
    );
  }

  Widget _sceneCard(int i) {
    final s = board[i];
    final active = i == playingScene;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: KColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: active ? KColors.accent : Colors.transparent, width: 2),
      ),
      child: Column(children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: s.imageUrl != null
                ? Image.network(s.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, _, _) => _emojiScene(s))
                : _emojiScene(s),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text(s.text, style: const TextStyle(height: 1.5)),
        ),
      ]),
    );
  }

  Widget _emojiScene(Scene s) => Container(
        color: const Color(0xFF222222),
        alignment: Alignment.center,
        child: Text(s.emoji, style: const TextStyle(fontSize: 64)),
      );
}
