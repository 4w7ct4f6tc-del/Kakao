import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

class VoiceSettingsScreen extends ConsumerStatefulWidget {
  const VoiceSettingsScreen({super.key});

  @override
  ConsumerState<VoiceSettingsScreen> createState() => _VoiceSettingsScreenState();
}

class _VoiceSettingsScreenState extends ConsumerState<VoiceSettingsScreen> {
  bool testing = false;
  bool recording = false;
  bool consent = false;
  bool cloning = false;
  DateTime? recStart;

  Future<void> _test() async {
    final lang = ref.read(languageProvider);
    final s = ref.read(voiceProvider);
    setState(() => testing = true);
    final sample = lang == 'ar'
        ? (s.voice == 'bahraini' ? 'هلا والله! شلونك؟ أنا صوتك الجديد في التطبيق.' : 'مرحباً! هذا صوتك الجديد في التطبيق.')
        : 'Hello! This is your new voice in the app.';
    try {
      await VoiceService.speak(sample, s, lang: lang);
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, lang));
    }
    if (mounted) setState(() => testing = false);
  }

  Future<void> _record() async {
    if (!recording) {
      if (await VoiceService.startRecording()) {
        setState(() {
          recording = true;
          recStart = DateTime.now();
        });
      }
      return;
    }
    setState(() {
      recording = false;
      cloning = true;
    });
    final audio = await VoiceService.stopRecording();
    try {
      if (audio == null) throw Exception('no audio');
      final id = await VoiceService.cloneVoice(audio, 'My voice');
      if (id.isNotEmpty) {
        await ref.read(voiceProvider.notifier).update(ref.read(voiceProvider).copyWith(voice: 'clone:$id'));
        if (mounted) toast(context, ref.read(tProvider)('saved'));
      }
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
    if (mounted) setState(() => cloning = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final s = ref.watch(voiceProvider);
    final n = ref.read(voiceProvider.notifier);
    final voices = [
      ('male', '👨 ${t('voiceMale')}'),
      ('female', '👩 ${t('voiceFemale')}'),
      ('bahraini', '🇧🇭 ${t('voiceBahraini')}'),
      ('en_us', '🇺🇸 English US'),
      ('en_uk', '🇬🇧 English UK'),
      ('fr', '🇫🇷 Français'),
      ('hi', '🇮🇳 हिन्दी'),
      if (s.voice.startsWith('clone:')) (s.voice, '🎙️ Clone'),
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
        const SizedBox(height: 12),
        KPills<String>(items: voices, selected: s.voice, onSelect: (v) => n.update(s.copyWith(voice: v))),
        const SizedBox(height: 12),
        KPills<String>(
          items: const [('elevenlabs', 'ElevenLabs'), ('openai', 'OpenAI Voice')],
          selected: s.provider,
          onSelect: (v) => n.update(s.copyWith(provider: v)),
        ),
        slider('${t('speed')}: ${s.speed.toStringAsFixed(1)}x', s.speed, 0.5, 2.0, (v) => n.update(s.copyWith(speed: v)), divisions: 15),
        slider('${t('pitch')}: ${s.pitch.toStringAsFixed(2)}', s.pitch, 0.5, 1.5, (v) => n.update(s.copyWith(pitch: v)), divisions: 20),
        slider('${t('volume')}: ${(s.volume * 100).round()}%', s.volume, 0, 1, (v) => n.update(s.copyWith(volume: v))),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: s.autoRead,
          activeThumbColor: K.green,
          title: Text(t('autoRead'), style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
          onChanged: (v) => n.update(s.copyWith(autoRead: v)),
        ),
        KBtn('▶ ${t('testVoice')}', v: KVariant.green, busy: testing, onTap: _test),
      ]),
      KCard(children: [
        Text(t('cloneVoice'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: consent,
          activeColor: K.green,
          title: Text(t('cloneConsent'), style: const TextStyle(color: Colors.black)),
          onChanged: (v) => setState(() => consent = v ?? false),
        ),
        KBtn(
          recording ? '⏹ ${t('stop')} (${DateTime.now().difference(recStart!).inSeconds}s / 30s)' : '🎙️ ${t('record')}',
          busy: cloning,
          onTap: consent ? _record : null,
        ),
      ]),
    ]);
  }
}
