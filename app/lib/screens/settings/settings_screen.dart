import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../services/auth_service.dart';
import '../../services/biometric_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'api_keys_screen.dart';
import 'devices_screen.dart';
import 'integrations_screen.dart';
import 'plans_screen.dart';
import 'questions_screen.dart';
import 'voice_settings_screen.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tProvider);
    final user = ref.watch(authProvider).value;
    final plan = ref.watch(planProvider);
    final lang = ref.watch(languageProvider);
    final bio = ref.watch(bioLockProvider);
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));

    Widget tile(IconData icon, String title, {String? subtitle, VoidCallback? onTap, Widget? trailing}) => Card(
          color: KColors.surface,
          margin: const EdgeInsets.symmetric(vertical: 5),
          child: ListTile(
            leading: Icon(icon, color: Colors.white),
            title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            subtitle: subtitle == null ? null : Text(subtitle, style: const TextStyle(color: KColors.muted)),
            trailing: trailing ?? const Icon(Icons.chevron_right, color: Colors.white54),
            onTap: onTap,
          ),
        );

    return Scaffold(
      appBar: AppBar(title: const KakaoTitle()),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.white,
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.black,
                backgroundImage: user?.photoURL != null ? NetworkImage(user!.photoURL!) : null,
                child: user?.photoURL == null ? const KakaoLogo(size: 36) : null,
              ),
              title: Text(user?.displayName ?? user?.email ?? user?.phoneNumber ?? t('guest'),
                  style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w800)),
              subtitle: Text('${t('currentPlan')}: ${t(plan)}', style: const TextStyle(color: Colors.black54)),
              trailing: plan == 'free'
                  ? FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: KColors.accent),
                      onPressed: () => go(const PlansScreen()),
                      child: Text(t('upgrade')),
                    )
                  : null,
            ),
          ),
          const SizedBox(height: 8),
          tile(Icons.workspace_premium_outlined, t('plans'), onTap: () => go(const PlansScreen())),
          tile(Icons.record_voice_over_outlined, t('voice'), onTap: () => go(const VoiceSettingsScreen())),
          tile(Icons.hub_outlined, t('integrations'), onTap: () => go(const IntegrationsScreen())),
          tile(Icons.key_outlined, t('apiKeys'), onTap: () => go(const ApiKeysScreen())),
          tile(Icons.translate, t('language'), subtitle: '${lang.toUpperCase()} • ${t('languageHint')}', trailing: Text(I18n.isRtl(lang) ? 'RTL' : 'LTR')),
          const SizedBox(height: 12),
          Text(t('security'), style: const TextStyle(color: KColors.muted, fontWeight: FontWeight.w700)),
          tile(
            Icons.fingerprint,
            t('biometricLock'),
            trailing: Switch(
              value: bio,
              activeThumbColor: KColors.accent,
              onChanged: (v) async {
                if (v && !await BiometricService.authenticate(t('biometricLock'))) return;
                await ref.read(bioLockProvider.notifier).set(v);
              },
            ),
          ),
          tile(Icons.devices_other, t('devices'), onTap: () => go(const DevicesScreen())),
          tile(Icons.quiz_outlined, t('smartQuestions'), onTap: () => go(const QuestionsScreen())),
          tile(
            Icons.logout,
            t('signOut'),
            onTap: () async {
              await ref.read(guestProvider.notifier).set(false);
              await AuthService.signOut();
            },
          ),
          const KakaoFooter(),
        ],
      ),
    );
  }
}
