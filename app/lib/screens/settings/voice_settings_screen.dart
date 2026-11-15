import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

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
      ('male', t('voiceMale'), '👨'),
      ('female', t('voiceFemale'), '👩'),
      ('bahraini', t('voiceBahraini'), '🇧🇭'),
      ('en_us', 'English US', '🇺🇸'),
      ('en_uk', 'English UK', '🇬🇧'),
      ('fr', 'Français', '🇫🇷'),
      ('hi', 'हिन्दी', '🇮🇳'),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(t('voice'))),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final v in voices)
              ChoiceChip(
                label: Text('${v.$3} ${v.$2}'),
                selected: s.voice == v.$1,
                selectedColor: KColors.accent,
                onSelected: (_) => n.update(s.copyWith(voice: v.$1)),
              ),
            if (s.voice.startsWith('clone:'))
              ChoiceChip(label: const Text('🎙️ Clone'), selected: true, selectedColor: KColors.accent, onSelected: (_) {}),
          ]),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'elevenlabs', label: Text('ElevenLabs')),
              ButtonSegment(value: 'openai', label: Text('OpenAI Voice')),
            ],
            selected: {s.provider},
            onSelectionChanged: (v) => n.update(s.copyWith(provider: v.first)),
          ),
          const SizedBox(height: 16),
          Text('${t('speed')}: ${s.speed.toStringAsFixed(1)}x'),
          Slider(value: s.speed, min: 0.5, max: 2.0, divisions: 15, activeColor: KColors.accent, onChanged: (v) => n.update(s.copyWith(speed: v))),
          Text('${t('pitch')}: ${s.pitch.toStringAsFixed(2)}'),
          Slider(value: s.pitch, min: 0.5, max: 1.5, divisions: 20, activeColor: KColors.accent, onChanged: (v) => n.update(s.copyWith(pitch: v))),
          Text('${t('volume')}: ${(s.volume * 100).round()}%'),
          Slider(value: s.volume, min: 0, max: 1, activeColor: KColors.accent, onChanged: (v) => n.update(s.copyWith(volume: v))),
          SwitchListTile(
            value: s.autoRead,
            activeThumbColor: KColors.accent,
            title: Text(t('autoRead')),
            onChanged: (v) => n.update(s.copyWith(autoRead: v)),
          ),
          BigButton(label: t('testVoice'), icon: Icons.play_arrow, accent: true, loading: testing, onPressed: _test),
          const Divider(height: 40),
          Text(t('cloneVoice'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          CheckboxListTile(value: consent, activeColor: KColors.accent, title: Text(t('cloneConsent')), onChanged: (v) => setState(() => consent = v!)),
          BigButton(
            label: recording ? '${t('stop')} (${DateTime.now().difference(recStart!).inSeconds}s / 30s)' : t('record'),
            icon: recording ? Icons.stop : Icons.mic,
            loading: cloning,
            onPressed: consent ? _record : null,
          ),
        ],
      ),
    );
  }
}
