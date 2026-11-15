import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../services/video_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart' show friendlyError;
import '../../widgets/kakao_ui.dart';

/// فيديو — قصة · 🎬 اصنع لي الفيديو · ✅ تم صنع الفيديو.
/// An instant storyboard (scenes + real voice) appears right away while the 1080p MP4 renders.
class VideoTab extends ConsumerStatefulWidget {
  const VideoTab({super.key});

  @override
  ConsumerState<VideoTab> createState() => _VideoTabState();
}

class _VideoTabState extends ConsumerState<VideoTab> {
  final story = TextEditingController();
  String? jobId;
  VideoJob? job;
  List<Scene> board = [];
  Timer? poll;
  VideoPlayerController? player;
  int playing = -1;
  String? msg;

  @override
  void dispose() {
    poll?.cancel();
    player?.dispose();
    super.dispose();
  }

  Future<void> _make() async {
    final lang = ref.read(languageProvider);
    if (story.text.trim().length < 10) {
      setState(() => msg = lang == 'ar' ? 'اكتب قصة أطول شوي' : 'Write a slightly longer story');
      return;
    }
    await ref.read(languageProvider.notifier).observe(story.text);
    setState(() {
      board = VideoService.localStoryboard(story.text);
      job = null;
      msg = null;
    });
    try {
      jobId = await VideoService.create(story: story.text, lang: ref.read(languageProvider), long: false, voice: ref.read(voiceProvider).voice, gender: ref.read(voiceProvider).gender);
      poll?.cancel();
      poll = Timer.periodic(const Duration(seconds: 3), (_) => _check());
    } catch (e) {
      setState(() => msg = friendlyError(e, lang));
    }
  }

  Future<void> _check() async {
    try {
      final j = await VideoService.status(jobId!);
      setState(() {
        job = j;
        if (j.scenes.isNotEmpty) board = j.scenes;
      });
      if (j.status == 'done' || j.status == 'error') {
        poll?.cancel();
        if (j.videoUrl != null && (kIsWeb || Platform.isAndroid || Platform.isIOS)) {
          final c = VideoPlayerController.networkUrl(Uri.parse(j.videoUrl!));
          await c.initialize();
          setState(() => player = c);
        }
      }
    } catch (_) {}
  }

  Future<void> _play() async {
    final voice = ref.read(voiceProvider);
    final lang = ref.read(languageProvider);
    for (var i = 0; i < board.length; i++) {
      if (!mounted) return;
      setState(() => playing = i);
      try {
        await VoiceService.speak(board[i].text, voice, lang: lang, followLanguage: true);
        await Future.delayed(Duration(milliseconds: 600 + board[i].text.length * 60));
      } catch (_) {
        await Future.delayed(const Duration(seconds: 3));
      }
    }
    if (mounted) setState(() => playing = -1);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final ar = ref.watch(languageProvider) == 'ar';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      KCard(children: [
        KInput(story, t('storyPh'), lines: 6),
        KBtn(t('makeVideo2'), onTap: _make),
        if (msg != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(msg!, style: const TextStyle(color: Colors.black54))),
        if (job != null && job!.status != 'done') ...[
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(value: job!.progress / 100, minHeight: 10, color: K.green, backgroundColor: K.grey),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('${job!.status} • ${job!.progress}%', textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontSize: 12)),
          ),
        ],
        if (job?.videoUrl != null) ...[
          const SizedBox(height: 14),
          Text(t('videoDone'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          if (player != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: GestureDetector(
                  onTap: () => setState(() => player!.value.isPlaying ? player!.pause() : player!.play()),
                  child: AspectRatio(aspectRatio: player!.value.aspectRatio, child: VideoPlayer(player!)),
                ),
              ),
            ),
          KBtn('⬇️ MP4', v: KVariant.grey, onTap: () => launchUrl(Uri.parse(job!.videoUrl!), mode: LaunchMode.externalApplication)),
        ],
      ]),
      if (board.isNotEmpty)
        KCard(children: [
          Row(children: [
            Expanded(child: Text('${t('storyboard')} • ${board.length}', style: const TextStyle(fontWeight: FontWeight.w800))),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.black, shape: const StadiumBorder()),
              onPressed: _play,
              child: Text('▶ ${ar ? 'شغّل' : 'Play'}'),
            ),
          ]),
          for (var i = 0; i < board.length; i++)
            Container(
              margin: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(
                color: K.soft,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: playing == i ? K.green : Colors.transparent, width: 2),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: board[i].imageUrl != null
                      ? Image.network(board[i].imageUrl!, fit: BoxFit.cover)
                      : Container(color: const Color(0xFF222222), alignment: Alignment.center, child: Text(board[i].emoji, style: const TextStyle(fontSize: 48))),
                ),
                Padding(padding: const EdgeInsets.all(12), child: Text(board[i].text, style: const TextStyle(color: Colors.black, height: 1.6))),
              ]),
            ),
        ]),
    ]);
  }
}
