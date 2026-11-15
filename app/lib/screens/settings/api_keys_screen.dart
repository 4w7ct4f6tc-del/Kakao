import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

/// BYOK — the user's own AI keys, encrypted server-side (AES-256-GCM).
/// When present, the router uses them instead of the platform keys and
/// unlocks that AI regardless of plan.
class ApiKeysScreen extends ConsumerStatefulWidget {
  const ApiKeysScreen({super.key});

  @override
  ConsumerState<ApiKeysScreen> createState() => _ApiKeysScreenState();
}

class _ApiKeysScreenState extends ConsumerState<ApiKeysScreen> {
  static const providers = [
    ('openai', 'OpenAI (ChatGPT, DALL·E, Whisper, TTS)', 'sk-...'),
    ('anthropic', 'Anthropic (Claude)', 'sk-ant-...'),
    ('gemini', 'Google Gemini', 'AIza...'),
    ('meta', 'Meta Llama (Groq / Together)', 'gsk_...'),
    ('elevenlabs', 'ElevenLabs (voice)', 'xi-...'),
  ];
  final controllers = {for (final p in providers) p.$1: TextEditingController()};
  Map<String, bool> status = {};
  String? busy;

  @override
  void initState() {
    super.initState();
    AccountService.byokStatus().then((s) {
      if (mounted) setState(() => status = s);
    });
  }

  Future<void> _save(String id) async {
    setState(() => busy = id);
    try {
      await AccountService.saveByok(id, controllers[id]!.text.trim());
      controllers[id]!.clear();
      setState(() => status[id] = true);
      if (mounted) toast(context, ref.read(tProvider)('saved'));
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t('apiKeys'))),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          for (final p in providers)
            Card(
              color: KColors.surface,
              margin: const EdgeInsets.symmetric(vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(p.$2, style: const TextStyle(fontWeight: FontWeight.w700))),
                    if (status[p.$1] == true) Text('✅ ${t('saved')}', style: const TextStyle(color: KColors.accent)),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: controllers[p.$1],
                        obscureText: true,
                        decoration: InputDecoration(hintText: p.$3, isDense: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    busy == p.$1
                        ? const CircularProgressIndicator()
                        : FilledButton(
                            style: FilledButton.styleFrom(backgroundColor: KColors.accent),
                            onPressed: () => _save(p.$1),
                            child: Text(t('save')),
                          ),
                  ]),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}
