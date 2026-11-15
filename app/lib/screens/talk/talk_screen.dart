import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/girl_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/kakao_ui.dart';
import 'prank_screen.dart';

enum _Status { idle, thinking, speaking, listening }

/// 🎤 تكلم — continuous voice conversation with "بنت خعخعو" in the chosen dialect.
/// Tap 🎤 to talk (it stops when you stop), tap again while she talks to interrupt.
/// If you go quiet she nudges you. "غيري اللهجة" changes the dialect anytime.
class TalkScreen extends ConsumerStatefulWidget {
  const TalkScreen({super.key});

  @override
  ConsumerState<TalkScreen> createState() => _TalkScreenState();
}

class _TalkScreenState extends ConsumerState<TalkScreen> {
  GirlSettings s = GirlSettings.load();
  bool started = false;
  bool picker = false;
  _Status status = _Status.idle;
  double level = 0;
  String? note;
  String? buildPrompt, videoPrompt;
  final msgs = <Map<String, String>>[];
  final input = TextEditingController();
  final scroll = ScrollController();
  int strikes = 0;
  int nudges = 0;
  bool handsFree = false;
  Timer? nudgeTimer;

  bool get ar => ref.read(languageProvider) == 'ar';

  @override
  void dispose() {
    nudgeTimer?.cancel();
    VoiceService.stop();
    VoiceService.cancelListening();
    super.dispose();
  }

  void _set(GirlSettings next) {
    setState(() => s = next);
    next.save();
  }

  void _add(String role, String content) {
    setState(() => msgs.add({'role': role, 'content': content}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) scroll.animateTo(scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    });
  }

  Future<void> _speak(String text, String? audio) async {
    if (!mounted) return;
    setState(() => status = _Status.speaking);
    if (audio != null) {
      await VoiceService.playBase64(audio, volume: ref.read(voiceProvider).volume);
    } else {
      setState(() => note = ar ? 'صوت البنت الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح — هذي معاينة مكتوبة.' : 'The real girl voice (ElevenLabs) works once keys are connected — text preview.');
      await Future.delayed(Duration(milliseconds: 600 + text.length * 35));
    }
  }

  void _armNudge() {
    nudgeTimer?.cancel();
    if (nudges >= 2 || !started) return;
    nudgeTimer = Timer(const Duration(seconds: 15), () {
      nudges++;
      _turn('nudge');
    });
  }

  /// One turn: she replies (text + real voice), handles prank / actions, then listens again if hands-free.
  Future<void> _turn(String event) async {
    nudgeTimer?.cancel();
    setState(() => status = _Status.thinking);
    final r = await GirlService.talk(event, s, msgs, strikes, engine: ref.read(aiChoiceProvider).name);
    if (!mounted) return;
    if (r.settings != s) _set(r.settings);
    _add('assistant', r.text);
    if (r.build != null || r.video != null) {
      setState(() {
        buildPrompt = r.build;
        videoPrompt = r.video;
      });
    }
    if (r.action == 'insult') strikes = 1;
    await _speak(r.text, r.audio);
    if (!mounted) return;
    if (r.action == 'prank') {
      await PrankScreen.show(context);
      strikes = 0;
      if (r.comebackText != null) {
        _add('assistant', r.comebackText!);
        await _speak(r.comebackText!, r.comebackAudio);
      }
    }
    if (!mounted) return;
    setState(() => status = _Status.idle);
    if (handsFree) {
      _listen();
    } else {
      _armNudge();
    }
  }

  Future<void> _send(String text) async {
    if (text.trim().isEmpty) return;
    await VoiceService.stop();
    nudges = 0;
    _add('user', text.trim());
    await _turn('reply');
  }

  /// 🎤 Interrupts her if she is talking, then listens until you stop speaking.
  Future<void> _listen() async {
    nudgeTimer?.cancel();
    if (status == _Status.listening) {
      VoiceService.cancelListening();
      return;
    }
    await VoiceService.stop();
    handsFree = true;
    setState(() => status = _Status.listening);
    final audio = await VoiceService.listenUntilSilence(onLevel: (v) => mounted ? setState(() => level = v) : null);
    if (!mounted) return;
    if (audio == null) {
      setState(() => status = _Status.idle);
      _armNudge();
      return;
    }
    setState(() => status = _Status.thinking);
    try {
      final heard = await VoiceService.transcribe(audio);
      if ((heard['text'] ?? '').trim().isNotEmpty) {
        await _send(heard['text']!);
      } else {
        setState(() => status = _Status.idle);
      }
    } catch (_) {
      handsFree = false;
      setState(() {
        status = _Status.idle;
        note = ar ? 'تحويل الصوت لكلام يحتاج مفتاح OpenAI — اكتب لها تحت.' : 'Speech-to-text needs the OpenAI key — type below.';
      });
    }
  }

  void _start() {
    setState(() {
      started = true;
      msgs.clear();
      strikes = 0;
      nudges = 0;
      buildPrompt = videoPrompt = null;
    });
    _turn('start');
  }

  void _end() {
    nudgeTimer?.cancel();
    VoiceService.stop();
    VoiceService.cancelListening();
    handsFree = false;
    setState(() {
      started = false;
      status = _Status.idle;
    });
  }

  Future<void> _test() async {
    setState(() => status = _Status.thinking);
    final r = await GirlService.talk('start', s, const [], 0);
    await _speak(r.text, r.audio);
    if (mounted) setState(() => status = _Status.idle);
  }

  Widget _pills(List<(String, String, String)> items, String selected, ValueChanged<String> onSelect) {
    final arUi = ref.watch(languageProvider) == 'ar';
    return KPills<String>(items: [for (final i in items) (i.$1, arUi ? i.$2 : i.$3)], selected: selected, onSelect: onSelect);
  }

  String _name(List<(String, String, String)> items, String id) {
    final it = items.firstWhere((x) => x.$1 == id, orElse: () => items.first);
    return ref.watch(languageProvider) == 'ar' ? it.$2 : it.$3;
  }

  @override
  Widget build(BuildContext context) {
    final arUi = ref.watch(languageProvider) == 'ar';
    final statusText = switch (status) {
      _Status.idle => arUi ? 'اضغط 🎤 وتكلم' : 'Tap 🎤 and talk',
      _Status.thinking => arUi ? 'تفكر…' : 'Thinking…',
      _Status.speaking => arUi ? 'تتكلم… اضغط 🎤 تقاطعها' : 'Talking… tap 🎤 to interrupt',
      _Status.listening => arUi ? 'أسمعك…' : 'Listening…',
    };
    Widget label(String t) => Padding(padding: const EdgeInsets.only(top: 14, bottom: 8), child: Text(t, style: const TextStyle(fontWeight: FontWeight.w700)));

    if (!started) {
      return KPage(children: [
        KCard(children: [
          Text(arUi ? '🎤 تكلم مع بنت خعخعو' : '🎤 Talk with the KAkAo girl', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(arUi ? 'بنت حقيقية الصوت، شديدة وحنونة ومشاغبة. اختار قبل ما تبدأ:' : 'A real girl voice — strict, sweet and mischievous. Choose before you start:',
              style: const TextStyle(color: Colors.black54)),
          label(arUi ? '1. اللهجة' : '1. Dialect'),
          _pills(girlDialects, s.dialect, (v) => _set(s.copyWith(dialect: v))),
          label(arUi ? '2. نوع البنت' : '2. Voice type'),
          _pills(girlStyles, s.style, (v) => _set(s.copyWith(style: v))),
          label(arUi ? '3. سرعة الكلام' : '3. Speed'),
          _pills(girlSpeeds, s.speed, (v) => _set(s.copyWith(speed: v))),
          label(arUi ? '4. الوضع' : '4. Mode'),
          _pills(girlModes, s.mode, (v) => _set(s.copyWith(mode: v))),
          KBtn(arUi ? '▶ جرّب الصوت' : '▶ Test voice', v: KVariant.grey, busy: status != _Status.idle, onTap: _test),
          KBtn(arUi ? '🎤 تكلم' : '🎤 Talk', v: KVariant.green, onTap: _start),
          if (note != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(note!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontSize: 12))),
        ]),
      ]);
    }

    return KPage(children: [
      KCard(children: [
        Row(children: [
          Expanded(
            child: Text('${_name(girlDialects, s.dialect)} • ${_name(girlStyles, s.style)} • ${_name(girlModes, s.mode)}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.black, shape: const StadiumBorder()),
            onPressed: () => setState(() => picker = !picker),
            child: Text(arUi ? 'غيري اللهجة' : 'Change dialect'),
          ),
        ]),
        if (picker)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: _pills(girlDialects, s.dialect, (v) {
              _set(s.copyWith(dialect: v));
              setState(() => picker = false);
            }),
          ),
        const SizedBox(height: 10),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 380),
          child: ListView.builder(
            controller: scroll,
            shrinkWrap: true,
            itemCount: msgs.length,
            itemBuilder: (_, i) {
              final me = msgs[i]['role'] == 'user';
              return Align(
                alignment: me ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 330),
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(color: me ? Colors.black : K.soft, borderRadius: BorderRadius.circular(16)),
                  child: Text(msgs[i]['content']!, style: TextStyle(color: me ? Colors.white : Colors.black, height: 1.6)),
                ),
              );
            },
          ),
        ),
        if (buildPrompt != null || videoPrompt != null)
          Row(children: [
            if (buildPrompt != null)
              Expanded(
                child: KBtn(arUi ? '✨ افتح المصنع' : '✨ Open builder', v: KVariant.green, onTap: () {
                  ref.read(builderSeedProvider.notifier).set(BuilderSeed(prompt: buildPrompt));
                  ref.read(tabProvider.notifier).set(1);
                  Navigator.pop(context);
                }),
              ),
            if (buildPrompt != null && videoPrompt != null) const SizedBox(width: 10),
            if (videoPrompt != null)
              Expanded(
                child: KBtn(arUi ? '🎬 افتح الفيديو' : '🎬 Open video', v: KVariant.green, onTap: () {
                  ref.read(tabProvider.notifier).set(2);
                  Navigator.pop(context);
                }),
              ),
          ]),
      ]),
      KCard(align: CrossAxisAlignment.center, children: [
        GestureDetector(
          onTap: _listen,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            width: 96,
            height: 96,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: status == _Status.listening ? K.green : Colors.black,
              boxShadow: [
                if (status == _Status.listening) BoxShadow(color: K.green.withValues(alpha: 0.3), spreadRadius: 6 + level * 22),
                if (status == _Status.speaking) BoxShadow(color: Colors.black.withValues(alpha: 0.12), spreadRadius: 8),
              ],
            ),
            child: const Text('🎤', style: TextStyle(fontSize: 38)),
          ),
        ),
        const SizedBox(height: 10),
        Text(statusText, style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w600)),
        Row(children: [
          Expanded(child: KInput(input, arUi ? 'أو اكتب لها…' : 'Or type to her…')),
          const SizedBox(width: 8),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: IconButton.filled(
              style: IconButton.styleFrom(backgroundColor: Colors.black, fixedSize: const Size(52, 52)),
              icon: const Icon(Icons.arrow_upward, color: Colors.white),
              onPressed: () {
                handsFree = false;
                final t = input.text;
                input.clear();
                _send(t);
              },
            ),
          ),
        ]),
        if (note != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(note!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontSize: 12))),
        SizedBox(width: double.infinity, child: KBtn(arUi ? 'إنهاء المكالمة' : 'End conversation', v: KVariant.grey, onTap: _end)),
      ]),
    ]);
  }
}
