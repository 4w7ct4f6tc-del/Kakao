import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/ai_service.dart';
import '../../services/girl_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/kakao_ui.dart';
import 'prank_screen.dart';

enum _Status { idle, thinking, speaking, listening }

/// نقاش — AI 1 thinks with you ("💡 اقتراح مني / 🫵 اقتراح منك").
/// 📞 اتصلوا حق دانو → دانو (بنت الرفاع) joins: a three-way voice discussion.
class DiscussScreen extends ConsumerStatefulWidget {
  const DiscussScreen({super.key});

  @override
  ConsumerState<DiscussScreen> createState() => _DiscussScreenState();
}

class _DiscussScreenState extends ConsumerState<DiscussScreen> {
  GirlSettings s = GirlSettings.load();
  final msgs = <Map<String, String>>[];
  final input = TextEditingController();
  final scroll = ScrollController();
  final st = DiscussState();
  _Status status = _Status.idle;
  double level = 0;
  bool setup = false, call = false, picker = false, handsFree = false;
  String? note, summary, buildPrompt, videoPrompt;
  int nudges = 0;
  Timer? nudgeTimer;

  static const _ais = [(AiEngine.meta, 'Meta'), (AiEngine.chatgpt, 'ChatGPT'), (AiEngine.gemini, 'Gemini')];

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

  void _push(String role, String content) {
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
      setState(() => note = ar ? 'صوت دانو الحقيقي (ElevenLabs) يشتغل بعد ربط المفاتيح — هذي معاينة مكتوبة.' : "Danu's real voice (ElevenLabs) works once keys are connected — text preview.");
      await Future.delayed(Duration(milliseconds: 500 + text.length * 30));
    }
  }

  void _armNudge() {
    nudgeTimer?.cancel();
    if (!call || nudges >= 2) return;
    nudgeTimer = Timer(const Duration(seconds: 15), () {
      nudges++;
      _turn('nudge');
    });
  }

  void _hangUp(String? text, {bool showSummary = true}) {
    nudgeTimer?.cancel();
    VoiceService.stop();
    VoiceService.cancelListening();
    handsFree = false;
    setState(() {
      call = false;
      status = _Status.idle;
      if (showSummary) summary = (text == null || text.isEmpty) ? (ar ? 'انتهت المكالمة.' : 'Call ended.') : text;
    });
  }

  /// One round: AI 1 answers; on a call دانو answers after it with her real voice.
  Future<void> _turn(String event) async {
    nudgeTimer?.cancel();
    setState(() => status = _Status.thinking);
    final r = await DiscussService.send(event, call, s, msgs, st, engine: ref.read(aiChoiceProvider).name);
    if (!mounted) return;
    if (r.ai1 != null) _push('ai1', r.ai1!);
    final d = r.danu;
    if (d == null) {
      setState(() => status = _Status.idle);
      return;
    }
    st.turns++;
    st.loud = false;
    _push('danu', d.text);
    if (d.build != null || d.video != null) {
      setState(() {
        buildPrompt = d.build;
        videoPrompt = d.video;
      });
    }
    if (d.action == 'insult') st.strikes = 1;
    if (d.family) st.familyAsks++;
    await _speak(d.text, d.audio);
    if (!mounted) return;
    if (d.hangup) {
      _hangUp(d.summary);
      return;
    }
    if (d.action == 'prank') {
      await PrankScreen.show(context);
      st.strikes = 0;
      if (d.comebackText != null) {
        _push('danu', d.comebackText!);
        await _speak(d.comebackText!, d.comebackAudio);
      }
    }
    if (!mounted) return;
    setState(() => status = _Status.idle);
    if (handsFree && call) {
      _listen();
    } else {
      _armNudge();
    }
  }

  Future<void> _send(String text) async {
    if (text.trim().isEmpty || status == _Status.thinking) return;
    await VoiceService.stop();
    nudges = 0;
    _push('user', text.trim());
    await _turn('reply');
  }

  /// 🎤 interrupts دانو if she is talking, then listens until you stop.
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
    st.loud = VoiceService.lastWasLoud;
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
        note = ar ? 'تحويل الصوت لكلام يحتاج مفتاح OpenAI — اكتب تحت.' : 'Speech-to-text needs the OpenAI key — type below.';
      });
    }
  }

  void _startCall() {
    st
      ..strikes = 0
      ..familyAsks = 0
      ..turns = 0
      ..loud = false;
    nudges = 0;
    setState(() {
      setup = false;
      summary = null;
      call = true;
    });
    _turn('join');
  }

  Future<void> _test() async {
    setState(() => status = _Status.thinking);
    final r = await DiscussService.send('join', true, s, const [], DiscussState());
    if (r.danu != null) await _speak(r.danu!.text, r.danu!.audio);
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

  Widget _chip(String label, Color bg, VoidCallback onTap, {IconData? icon}) => FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: bg, shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 14)),
        onPressed: onTap,
        icon: icon == null ? null : Icon(icon, size: 18),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      );

  @override
  Widget build(BuildContext context) {
    final arUi = ref.watch(languageProvider) == 'ar';
    final ai = ref.watch(aiChoiceProvider);
    final statusText = switch (status) {
      _Status.idle => arUi ? 'اضغط المايك وتكلم' : 'Tap the mic and talk',
      _Status.thinking => arUi ? 'يفكرون…' : 'Thinking…',
      _Status.speaking => arUi ? 'دانو تتكلم… اضغط المايك تقاطعها' : 'Danu is talking… tap the mic to interrupt',
      _Status.listening => arUi ? 'أسمعك…' : 'Listening…',
    };
    final names = {'user': arUi ? 'أنت' : 'You', 'ai1': arUi ? 'المساعد' : 'Assistant', 'danu': arUi ? 'دانو' : 'Danu'};
    Widget label(String t) => Padding(padding: const EdgeInsets.only(top: 14, bottom: 8), child: Text(t, style: const TextStyle(fontWeight: FontWeight.w700)));

    return KPage(children: [
      KCard(children: [
        Row(children: [
          const Icon(Icons.chat_bubble_outline, color: Colors.black),
          const SizedBox(width: 8),
          Expanded(child: Text(arUi ? 'ناقش فكرتك' : 'Discuss your idea', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          call
              ? _chip(arUi ? 'إنهاء المكالمة' : 'End call', const Color(0xFFDC2626), () => _hangUp(null, showSummary: false), icon: Icons.call_end)
              : _chip(arUi ? 'اتصلوا حق دانو' : 'Call Danu', K.green, () => setState(() => setup = !setup), icon: Icons.phone_outlined),
        ]),
        const SizedBox(height: 12),
        KPills<AiEngine>(items: _ais, selected: ai, logos: true, onSelect: (e) => ref.read(aiChoiceProvider.notifier).set(e)),
        const SizedBox(height: 8),
        Text(
          call
              ? (arUi
                  ? 'مكالمة ثلاثية: أنت + المساعد + دانو • ${_name(girlDialects, s.dialect)} • ${_name(girlStyles, s.style)}'
                  : 'Three-way call: you + assistant + Danu • ${_name(girlDialects, s.dialect)} • ${_name(girlStyles, s.style)}')
              : (arUi ? 'المساعد يفكر معاك: يأكد فكرتك أو يعدلها، ويعطيك اقتراح منه ويسألك عن اقتراحك.' : 'The assistant thinks with you: confirms or improves your idea, suggests, and asks for yours.'),
          style: const TextStyle(color: Colors.black54, fontSize: 12),
        ),
        if (call)
          Align(alignment: AlignmentDirectional.centerEnd, child: Padding(padding: const EdgeInsets.only(top: 8), child: _chip(arUi ? 'غيري اللهجة' : 'Change dialect', Colors.black, () => setState(() => picker = !picker)))),
        if (picker)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: _pills(girlDialects, s.dialect, (v) {
              _set(s.copyWith(dialect: v));
              setState(() => picker = false);
            }),
          ),
      ]),
      if (setup && !call)
        KCard(children: [
          Text(arUi ? 'قبل لا تتصل بدانو' : 'Before you call Danu', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(arUi ? 'دانو — بنت الرفاع: شديدة وحنونة ومشاغبة، وأذكى وحدة في المكالمة.' : 'Danu — a girl from Riffa: strict, sweet, mischievous, and the smartest one on the call.',
              style: const TextStyle(color: Colors.black54)),
          label(arUi ? '1. اللهجة' : '1. Dialect'),
          _pills(girlDialects, s.dialect, (v) => _set(s.copyWith(dialect: v))),
          label(arUi ? '2. نوع البنت' : '2. Voice type'),
          _pills(girlStyles, s.style, (v) => _set(s.copyWith(style: v))),
          label(arUi ? '3. سرعة الكلام' : '3. Speed'),
          _pills(girlSpeeds, s.speed, (v) => _set(s.copyWith(speed: v))),
          label(arUi ? '4. الوضع' : '4. Mode'),
          _pills(girlModes, s.mode, (v) => _set(s.copyWith(mode: v))),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: s.lisp,
            activeThumbColor: K.green,
            title: Text(arUi ? 'لدغة رفاعية خفيفة (ر ← و في الصوت)' : 'Light Riffa lisp (R → W in speech)', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
            onChanged: (v) => _set(s.copyWith(lisp: v)),
          ),
          KBtn(arUi ? 'جرّب الصوت' : 'Test voice', icon: Icons.play_arrow, v: KVariant.grey, busy: status != _Status.idle, onTap: _test),
          KBtn(arUi ? 'اتصل' : 'Call', icon: Icons.phone_outlined, v: KVariant.green, onTap: _startCall),
        ]),
      KCard(children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 440),
          child: msgs.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(arUi ? 'اكتب فكرتك… مثال: أبي تطبيق لمحل ورد' : 'Write your idea… e.g. I want an app for a flower shop',
                      textAlign: TextAlign.center, style: const TextStyle(color: Colors.black45)),
                )
              : ListView.builder(
                  controller: scroll,
                  shrinkWrap: true,
                  itemCount: msgs.length,
                  itemBuilder: (_, i) {
                    final role = msgs[i]['role']!;
                    final me = role == 'user';
                    return Column(
                      crossAxisAlignment: me ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        Padding(padding: const EdgeInsets.only(top: 6, bottom: 2), child: Text(names[role]!, style: const TextStyle(color: Colors.black45, fontSize: 11, fontWeight: FontWeight.w700))),
                        Container(
                          constraints: const BoxConstraints(maxWidth: 340),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: me ? Colors.black : role == 'danu' ? const Color(0xFFE8F7EE) : K.soft,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(msgs[i]['content']!, style: TextStyle(color: me ? Colors.white : Colors.black, height: 1.6)),
                        ),
                      ],
                    );
                  },
                ),
        ),
        if (summary != null)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: K.grey), borderRadius: BorderRadius.circular(14)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(arUi ? 'زبدة المكالمة' : 'Call summary', style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(summary!, style: const TextStyle(color: Colors.black87)),
            ]),
          ),
        if (buildPrompt != null || videoPrompt != null)
          Row(children: [
            if (buildPrompt != null)
              Expanded(
                child: KBtn(arUi ? 'افتح المصنع' : 'Open builder', icon: Icons.auto_awesome_outlined, v: KVariant.green, onTap: () {
                  ref.read(builderSeedProvider.notifier).set(BuilderSeed(prompt: buildPrompt));
                  ref.read(tabProvider.notifier).set(1);
                  Navigator.pop(context);
                }),
              ),
            if (buildPrompt != null && videoPrompt != null) const SizedBox(width: 10),
            if (videoPrompt != null)
              Expanded(
                child: KBtn(arUi ? 'افتح الفيديو' : 'Open video', icon: Icons.movie_outlined, v: KVariant.green, onTap: () {
                  ref.read(tabProvider.notifier).set(2);
                  Navigator.pop(context);
                }),
              ),
          ]),
        if (call) ...[
          const SizedBox(height: 14),
          Center(
            child: GestureDetector(
              onTap: _listen,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 84,
                height: 84,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: status == _Status.listening ? K.green : Colors.black,
                  boxShadow: [
                    if (status == _Status.listening) BoxShadow(color: K.green.withValues(alpha: 0.3), spreadRadius: 6 + level * 22),
                    if (status == _Status.speaking) BoxShadow(color: Colors.black.withValues(alpha: 0.12), spreadRadius: 8),
                  ],
                ),
                child: const Icon(Icons.mic_none, color: Colors.white, size: 36),
              ),
            ),
          ),
          Padding(padding: const EdgeInsets.only(top: 8), child: Text(statusText, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w600))),
        ],
        Row(children: [
          Expanded(child: KInput(input, call ? (arUi ? 'تكلم أو اكتب…' : 'Talk or type…') : (arUi ? 'اكتب فكرتك…' : 'Write your idea…'))),
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
        if (status == _Status.thinking) const Padding(padding: EdgeInsets.only(top: 8), child: LinearProgressIndicator(color: K.green, backgroundColor: K.grey)),
        if (note != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(note!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontSize: 12))),
      ]),
    ]);
  }
}
