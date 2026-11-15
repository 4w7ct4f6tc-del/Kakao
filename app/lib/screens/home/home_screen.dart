import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../models/templates.dart';
import '../../services/ai_service.dart';
import '../../services/camera_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../camera/camera_screen.dart';

/// Home = the ONE box. Chat with any AI; app requests jump to the builder.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final input = TextEditingController();
  final scroll = ScrollController();
  bool thinking = false;
  bool recording = false;
  String? pendingImage;

  Future<void> _send([String? override]) async {
    final text = (override ?? input.text).trim();
    if (text.isEmpty && pendingImage == null) return;
    input.clear();
    await ref.read(languageProvider.notifier).observe(text);
    final lang = ref.read(languageProvider);
    ref.read(chatProvider.notifier).add(ChatMessage('user', text, imageBase64: pendingImage));
    setState(() {
      pendingImage = null;
      thinking = true;
    });
    _scrollDown();
    final reply = await AiService.chat(
      history: ref.read(chatProvider),
      engine: ref.read(aiChoiceProvider),
      lang: lang,
    );
    ref.read(chatProvider.notifier).add(ChatMessage('assistant', reply.text, engine: reply.engine));
    if (mounted) setState(() => thinking = false);
    _scrollDown();
    final voice = ref.read(voiceProvider);
    if (voice.autoRead) {
      VoiceService.speak(reply.text, voice, lang: lang).catchError((_) {});
    }
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) {
        scroll.animateTo(scroll.position.maxScrollExtent + 200, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _mic() async {
    if (!recording) {
      final ok = await VoiceService.startRecording();
      if (ok) setState(() => recording = true);
      return;
    }
    setState(() => recording = false);
    final audio = await VoiceService.stopRecording();
    if (audio == null) return;
    try {
      final r = await VoiceService.transcribe(audio);
      if (r['lang']!.isNotEmpty) await ref.read(languageProvider.notifier).set(r['lang']!.substring(0, 2));
      await _send(r['text']);
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
  }

  Future<void> _attach() async {
    final f = await CameraService.pick(camera: false);
    if (f == null) return;
    final bytes = await f.readAsBytes();
    setState(() => pendingImage = base64Encode(bytes));
  }

  void _openBuilder(String prompt) {
    ref.read(builderSeedProvider.notifier).set(BuilderSeed(prompt: prompt));
    ref.read(tabProvider.notifier).set(1);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final messages = ref.watch(chatProvider);
    return Scaffold(
      appBar: AppBar(
        title: const KakaoTitle(),
        actions: [
          IconButton(
            tooltip: t('camera'),
            icon: const Icon(Icons.photo_camera_outlined),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen())),
          ),
          if (messages.isNotEmpty)
            IconButton(icon: const Icon(Icons.add_comment_outlined), onPressed: () => ref.read(chatProvider.notifier).clear()),
        ],
      ),
      body: Column(
        children: [
          const AiPicker(),
          Expanded(
            child: messages.isEmpty
                ? _empty(t)
                : ListView.builder(
                    controller: scroll,
                    padding: const EdgeInsets.all(16),
                    itemCount: messages.length + (thinking ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i == messages.length) return const _Typing();
                      final m = messages[i];
                      final prev = i > 0 ? messages[i - 1] : null;
                      final offerBuild = m.role == 'assistant' && prev != null && looksLikeAppRequest(prev.text);
                      return _Bubble(message: m, offerBuild: offerBuild ? () => _openBuilder(prev.text) : null);
                    },
                  ),
          ),
          if (pendingImage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.memory(base64Decode(pendingImage!), width: 56, height: 56, fit: BoxFit.cover),
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => pendingImage = null)),
              ]),
            ),
          _inputBar(t),
        ],
      ),
    );
  }

  Widget _empty(String Function(String) t) {
    final lang = ref.watch(languageProvider);
    final ideas = lang == 'ar'
        ? ['أبي تطبيق لمحل ملابس', 'أبي تطبيق لمطعم', 'حوّل قصتي لفيديو', 'ترجم لي نص صورة']
        : ['I want an app for a clothes shop', 'I want a restaurant app', 'Turn my story into a video', 'Translate text in a photo'];
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 24),
        const Center(child: KakaoLogo(size: 72)),
        const SizedBox(height: 16),
        Text(t('welcome'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 24),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            for (final idea in ideas)
              ActionChip(
                label: Text(idea),
                onPressed: () {
                  if (looksLikeAppRequest(idea)) {
                    _openBuilder(idea);
                  } else if (idea.contains('فيديو') || idea.toLowerCase().contains('video')) {
                    ref.read(tabProvider.notifier).set(2);
                  } else {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen()));
                  }
                },
              ),
          ],
        ),
        const SizedBox(height: 40),
        const KakaoFooter(),
      ],
    );
  }

  Widget _inputBar(String Function(String) t) {
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 12),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(color: KColors.surface, borderRadius: BorderRadius.circular(28)),
        child: Row(
          children: [
            IconButton(icon: const Icon(Icons.image_outlined), onPressed: _attach),
            IconButton(
              icon: Icon(recording ? Icons.stop_circle : Icons.mic_none, color: recording ? KColors.danger : null),
              onPressed: _mic,
            ),
            Expanded(
              child: TextField(
                controller: input,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(hintText: t('oneBoxHint'), fillColor: Colors.transparent),
              ),
            ),
            IconButton.filled(
              style: IconButton.styleFrom(backgroundColor: KColors.accent),
              icon: const Icon(Icons.arrow_upward),
              onPressed: thinking ? null : _send,
            ),
          ],
        ),
      ),
    );
  }
}

/// Top bar AI picker. Switching keeps the same conversation.
class AiPicker extends ConsumerWidget {
  const AiPicker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tProvider);
    final current = ref.watch(aiChoiceProvider);
    final items = [
      (AiEngine.auto, t('aiAuto'), '✨', ''),
      (AiEngine.chatgpt, t('aiChatgpt'), '🟢', t('aiChatgptDesc')),
      (AiEngine.claude, t('aiClaude'), '🟠', t('aiClaudeDesc')),
      (AiEngine.meta, t('aiMeta'), '🔵', t('aiMetaDesc')),
      (AiEngine.gemini, t('aiGemini'), '🔷', t('aiGeminiDesc')),
    ];
    return SizedBox(
      height: 54,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: [
          for (final it in items)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: Tooltip(
                message: it.$4,
                child: ChoiceChip(
                  label: Text('${it.$3} ${it.$2}'),
                  selected: current == it.$1,
                  selectedColor: KColors.accent,
                  onSelected: (_) => ref.read(aiChoiceProvider.notifier).set(it.$1),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Bubble extends ConsumerWidget {
  final ChatMessage message;
  final VoidCallback? offerBuild;
  const _Bubble({required this.message, this.offerBuild});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tProvider);
    final me = message.role == 'user';
    return Align(
      alignment: me ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 560),
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: me ? Colors.white : KColors.surface,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (message.imageBase64 != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.memory(base64Decode(message.imageBase64!), height: 160, fit: BoxFit.cover),
                ),
              ),
            SelectableText(message.text, style: TextStyle(color: me ? Colors.black : Colors.white, fontSize: 16, height: 1.5)),
            if (!me) ...[
              const SizedBox(height: 6),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (message.engine != null)
                    Text(message.engine!, style: const TextStyle(color: KColors.muted, fontSize: 11)),
                  IconButton(
                    tooltip: t('listen'),
                    icon: const Icon(Icons.volume_up_outlined, size: 18),
                    onPressed: () => VoiceService.speak(message.text, ref.read(voiceProvider), lang: ref.read(languageProvider))
                        .catchError((e) {
                      if (context.mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
                    }),
                  ),
                  IconButton(
                    tooltip: t('copy'),
                    icon: const Icon(Icons.copy, size: 18),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: message.text));
                      toast(context, t('copied'));
                    },
                  ),
                  IconButton(
                    tooltip: t('translate'),
                    icon: const Icon(Icons.translate, size: 18),
                    onPressed: () async {
                      final target = ref.read(languageProvider) == 'ar' ? 'en' : 'ar';
                      final tr = await AiService.translate(message.text, target);
                      if (context.mounted) {
                        showModalBottomSheet(
                          context: context,
                          builder: (_) => Padding(padding: const EdgeInsets.all(24), child: SelectableText(tr)),
                        );
                      }
                    },
                  ),
                ],
              ),
              if (offerBuild != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: KColors.accent),
                    onPressed: offerBuild,
                    icon: const Icon(Icons.auto_awesome),
                    label: Text(t('buildThis')),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Typing extends StatelessWidget {
  const _Typing();
  @override
  Widget build(BuildContext context) => const Align(
        alignment: AlignmentDirectional.centerStart,
        child: Padding(
          padding: EdgeInsets.all(12),
          child: SizedBox(width: 40, child: LinearProgressIndicator(color: KColors.accent)),
        ),
      );
}
