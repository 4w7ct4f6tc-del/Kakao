import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/account_service.dart';
import '../../services/girl_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

/// Real human voice: ElevenLabs + OpenAI TTS.
/// Pick رجالي / نسائي and an accent (تلقائي follows your language: Arabic → Bahraini),
/// tune speed / pitch / volume, ▶ test it, then ✅ confirm. Plus a 30-second voice clone.
class VoiceSettingsScreen extends ConsumerStatefulWidget {
  const VoiceSettingsScreen({super.key});

  @override
  ConsumerState<VoiceSettingsScreen> createState() => _VoiceSettingsScreenState();
}

class _VoiceSettingsScreenState extends ConsumerState<VoiceSettingsScreen> {
  static const cloneSeconds = 30;
  late VoiceSettings draft = ref.read(voiceProvider);
  GirlSettings girl = GirlSettings.load();
  GirlSettings girlSaved = GirlSettings.load();
  bool testingGirl = false;
  bool testing = false;
  bool saving = false;
  bool consent = false;
  bool recording = false;
  bool cloning = false;
  int elapsed = 0;
  Timer? timer;

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  bool get ar => ref.read(languageProvider) == 'ar';

  /// Sample in the accent being tested.
  String _sample() {
    final accent = draft.isClone || draft.voice == 'auto' ? (ar ? 'bahraini' : 'en_us') : draft.voice;
    switch (accent) {
      case 'bahraini':
        return 'هلا والله! شلونك؟ أنا صوتك الجديد في خعخعو. قول لي شنو تبي، وأسويه لك على طول.';
      case 'fr':
        return 'Bonjour ! Je suis votre nouvelle voix. Dites-moi ce que vous voulez construire.';
      case 'hi':
        return 'नमस्ते! मैं आपकी नई आवाज़ हूँ। बताइए, आप क्या बनाना चाहते हैं?';
      default:
        return "Hey! I'm your new voice in KAkAo. Tell me what you want to build, and I'll make it for you.";
    }
  }

  Future<void> _test() async {
    setState(() => testing = true);
    try {
      await VoiceService.speak(_sample(), draft, lang: ar ? 'ar' : 'en');
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
    if (mounted) setState(() => testing = false);
  }

  Future<void> _testGirl() async {
    setState(() => testingGirl = true);
    final r = await GirlService.talk('start', girl.copyWith(mode: 'chat'), const [], 0);
    try {
      if (r.audio != null) {
        await VoiceService.playBase64(r.audio!, volume: draft.volume);
      } else if (mounted) {
        toast(context, ar ? 'صوت البنت الحقيقي يشتغل بعد ربط مفتاح ElevenLabs.\n${r.text}' : 'The real girl voice works once ElevenLabs is connected.\n${r.text}');
      }
    } catch (_) {}
    if (mounted) setState(() => testingGirl = false);
  }

  Future<void> _confirm() async {
    setState(() => saving = true);
    await ref.read(voiceProvider.notifier).update(draft);
    try {
      await AccountService.savePrefs({'voice': draft.toJson()});
    } catch (_) {}
    if (mounted) {
      setState(() => saving = false);
      toast(context, ref.read(tProvider)('saved'));
    }
  }

  Future<void> _startClone() async {
    if (!await VoiceService.startRecording()) {
      if (mounted) toast(context, ar ? 'اسمح للتطبيق باستخدام المايك' : 'Allow microphone access');
      return;
    }
    setState(() {
      recording = true;
      elapsed = 0;
    });
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      setState(() => elapsed++);
      if (elapsed >= cloneSeconds) _finishClone();
    });
  }

  Future<void> _finishClone() async {
    timer?.cancel();
    if (!recording) return;
    setState(() {
      recording = false;
      cloning = true;
    });
    final audio = await VoiceService.stopRecording();
    try {
      if (audio == null || elapsed < 10) throw Exception(ar ? 'سجّل 30 ثانية تقريباً' : 'Record about 30 seconds');
      final id = await VoiceService.cloneVoice(audio, 'My voice');
      if (id.isNotEmpty) {
        draft = draft.copyWith(voice: 'clone:$id');
        await _confirm();
      }
    } catch (e) {
      if (mounted) toast(context, e is Exception && e.toString().contains('30') ? e.toString().replaceFirst('Exception: ', '') : friendlyError(e, ref.read(languageProvider)));
    }
    if (mounted) setState(() => cloning = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final saved = ref.watch(voiceProvider);
    final arUi = ref.watch(languageProvider) == 'ar';
    final changed = draft != saved;
    final accents = <(String, String)>[
      ('auto', arUi ? 'تلقائي حسب لغتك' : 'Auto by language'),
      ('bahraini', arUi ? 'بحريني' : 'Bahraini Arabic'),
      ('en_us', 'English US'),
      ('en_uk', 'English UK'),
      ('fr', 'Français'),
      ('hi', 'हिन्दी'),
      if (draft.isClone) (draft.voice, arUi ? 'صوتي' : 'My voice'),
    ];
    Widget slider(String label, double value, double min, double max, ValueChanged<double> onChanged, {int? divisions}) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 12), child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
            Slider(value: value, min: min, max: max, divisions: divisions, activeColor: Colors.black, inactiveColor: K.grey, onChanged: onChanged),
          ],
        );
    return KPage(children: [
      KCard(children: [
        Text(t('voice'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(arUi ? 'صوت إنسان حقيقي — ElevenLabs و OpenAI' : 'Real human voice — ElevenLabs & OpenAI', style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 12),
        KPills<String>(
          items: [('male', arUi ? 'رجالي' : 'Male'), ('female', arUi ? 'نسائي' : 'Female')],
          selected: draft.gender,
          onSelect: (g) => setState(() => draft = draft.copyWith(gender: g)),
        ),
        const SizedBox(height: 10),
        KPills<String>(items: accents, selected: draft.voice, onSelect: (v) => setState(() => draft = draft.copyWith(voice: v))),
        if (draft.voice == 'auto')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(arUi ? 'تكتب عربي → يرد بحريني. تكتب إنجليزي → يرد إنجليزي.' : 'Write Arabic → Bahraini voice. Write English → English voice.',
                style: const TextStyle(color: Colors.black54, fontSize: 12)),
          ),
        const SizedBox(height: 12),
        KPills<String>(
          items: const [('elevenlabs', 'ElevenLabs'), ('openai', 'OpenAI Voice')],
          selected: draft.provider,
          onSelect: (v) => setState(() => draft = draft.copyWith(provider: v)),
        ),
        slider('${t('speed')}: ${draft.speed.toStringAsFixed(1)}x', draft.speed, 0.5, 2.0, (v) => setState(() => draft = draft.copyWith(speed: v)), divisions: 15),
        slider('${t('pitch')}: ${draft.pitch.toStringAsFixed(2)}', draft.pitch, 0.5, 1.5, (v) => setState(() => draft = draft.copyWith(pitch: v)), divisions: 20),
        slider('${t('volume')}: ${(draft.volume * 100).round()}%', draft.volume, 0, 1, (v) => setState(() => draft = draft.copyWith(volume: v))),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: draft.autoRead,
          activeThumbColor: K.green,
          title: Text(t('autoRead'), style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
          onChanged: (v) => setState(() => draft = draft.copyWith(autoRead: v)),
        ),
        KBtn(t('testVoice'), icon: Icons.play_arrow, busy: testing, onTap: _test),
        KBtn(arUi ? 'اعتمد هذا الصوت' : 'Use this voice', icon: Icons.check, v: KVariant.green, busy: saving, onTap: changed ? _confirm : null),
        if (!changed)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(arUi ? 'هذا صوتك الحالي' : 'This is your current voice', textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontSize: 12)),
          ),
      ]),
      KCard(children: [
        Text(arUi ? 'صوت البنت' : 'Girl voice', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(arUi ? 'بنت حقيقية بكل اللهجات العربية — للرد الصوتي والمحادثة والقصص والإعلانات.' : 'A real girl voice in every Arabic dialect — for voice replies, conversation, stories and ads.',
            style: const TextStyle(color: Colors.black54)),
        Padding(padding: const EdgeInsets.only(top: 12, bottom: 8), child: Text(arUi ? 'اللهجة' : 'Dialect', style: const TextStyle(fontWeight: FontWeight.w700))),
        KPills<String>(items: [for (final d in girlDialects) (d.$1, arUi ? d.$2 : d.$3)], selected: girl.dialect, onSelect: (v) => setState(() => girl = girl.copyWith(dialect: v))),
        Padding(padding: const EdgeInsets.only(top: 12, bottom: 8), child: Text(arUi ? 'النوع' : 'Type', style: const TextStyle(fontWeight: FontWeight.w700))),
        KPills<String>(items: [for (final d in girlStyles) (d.$1, arUi ? d.$2 : d.$3)], selected: girl.style, onSelect: (v) => setState(() => girl = girl.copyWith(style: v))),
        Padding(padding: const EdgeInsets.only(top: 12, bottom: 8), child: Text(arUi ? 'السرعة' : 'Speed', style: const TextStyle(fontWeight: FontWeight.w700))),
        KPills<String>(items: [for (final d in girlSpeeds) (d.$1, arUi ? d.$2 : d.$3)], selected: girl.speed, onSelect: (v) => setState(() => girl = girl.copyWith(speed: v))),
        KBtn(arUi ? 'جرّب الصوت' : 'Test voice', icon: Icons.play_arrow, busy: testingGirl, onTap: _testGirl),
        KBtn(arUi ? 'اعتمد صوت البنت' : 'Use this girl voice', icon: Icons.check, v: KVariant.green, onTap: girl == girlSaved ? null : () async {
          await girl.save();
          setState(() => girlSaved = girl);
          if (context.mounted) toast(context, t('saved'));
        }),
      ]),
      KCard(children: [
        Text(t('cloneVoice'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(
          arUi ? 'اقرأ أي كلام بصوتك الطبيعي لمدة 30 ثانية في مكان هادئ. التسجيل يوقف لحاله.' : 'Read anything in your natural voice for 30 seconds in a quiet place. Recording stops by itself.',
          style: const TextStyle(color: Colors.black54),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: consent,
          activeColor: K.green,
          title: Text(t('cloneConsent'), style: const TextStyle(color: Colors.black)),
          onChanged: recording ? null : (v) => setState(() => consent = v ?? false),
        ),
        if (recording) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(value: elapsed / cloneSeconds, minHeight: 10, color: Colors.black, backgroundColor: K.grey),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.fiber_manual_record, color: Color(0xFFDC2626), size: 14),
              const SizedBox(width: 6),
              Text('$elapsed / $cloneSeconds', style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
          ),
        ],
        KBtn(
          recording ? t('stop') : '${t('record')} (30s)',
          icon: recording ? Icons.stop : Icons.mic_none,
          busy: cloning,
          onTap: !consent ? null : (recording ? _finishClone : _startClone),
        ),
        if (draft.isClone)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(arUi ? 'صوتك المستنسخ جاهز — اختاره فوق وجربه' : 'Your cloned voice is ready — pick it above and test it',
                textAlign: TextAlign.center, style: const TextStyle(color: K.green, fontWeight: FontWeight.w700)),
          ),
      ]),
    ]);
  }
}
