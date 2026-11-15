import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../services/biometric_service.dart';
import '../../state/providers.dart';
import '../../widgets/kakao_ui.dart';
import 'api_keys_screen.dart';
import 'devices_screen.dart';
import 'integrations_screen.dart';
import 'plans_screen.dart';
import 'questions_screen.dart';
import 'voice_settings_screen.dart';

/// إعدادات — plan, voice, connections, own keys, security. One card per group.
class SettingsTab extends ConsumerWidget {
  const SettingsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tProvider);
    final plan = ref.watch(planProvider);
    final bio = ref.watch(bioLockProvider);
    final user = ref.watch(authProvider).value;
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      KCard(children: [
        Text('${t('currentPlan')}: ${t(plan)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        if (plan == 'free') KBtn('${t('upgrade')} — ${t('pro')} / ${t('ultra')}', v: KVariant.green, onTap: () => go(const PlansScreen())),
        KBtn(t('plans'), v: KVariant.grey, onTap: () => go(const PlansScreen())),
      ]),
      KCard(children: [
        KBtn('🔊 ${t('voice')}', onTap: () => go(const VoiceSettingsScreen())),
        KBtn('🔗 ${t('integrations')}', onTap: () => go(const IntegrationsScreen())),
        KBtn('🔑 ${t('apiKeys')}', onTap: () => go(const ApiKeysScreen())),
      ]),
      KCard(children: [
        Text(t('security'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: bio,
          activeThumbColor: K.green,
          title: Text(t('biometricLock'), style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
          onChanged: (v) async {
            if (v && !await BiometricService.authenticate(t('biometricLock'))) return;
            await ref.read(bioLockProvider.notifier).set(v);
          },
        ),
        KBtn('📱 ${t('devices')}', v: KVariant.grey, onTap: () => go(const DevicesScreen())),
        KBtn('❓ ${t('smartQuestions')}', v: KVariant.grey, onTap: () => go(const QuestionsScreen())),
        if (user != null)
          KBtn(t('signOut'), v: KVariant.grey, onTap: () async {
            await ref.read(guestProvider.notifier).set(false);
            await AuthService.signOut();
          }),
      ]),
    ]);
  }
}
