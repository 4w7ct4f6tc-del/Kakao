import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../state/providers.dart';
import '../../widgets/kakao_ui.dart';
import 'settings_pages.dart';
import 'voice_settings_screen.dart';

/// Settings — a list like the owner's design:
/// Account · Language · AI Model · Notifications · Voice · Privacy · Appearance · About · Danu · Log out.
class SettingsTab extends ConsumerWidget {
  const SettingsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    final user = ref.watch(authProvider).value;
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));
    return KCard(children: [
      KRow(icon: Icons.person_outline, label: ar ? 'الحساب' : 'Account', onTap: () => go(const AccountPage())),
      KRow(
        icon: Icons.language,
        label: ar ? 'اللغة' : 'Language',
        trailing: const KLangToggle(onCard: true),
        onTap: () => ref.read(languageProvider.notifier).set(ar ? 'en' : 'ar'),
      ),
      KRow(icon: Icons.auto_awesome_outlined, label: ar ? 'نموذج الذكاء' : 'AI Model', onTap: () => go(const AiModelPage())),
      KRow(icon: Icons.notifications_none, label: ar ? 'الإشعارات' : 'Notifications', onTap: () => go(const NotificationsPage())),
      KRow(icon: Icons.mic_none, label: ar ? 'الصوت' : 'Voice', onTap: () => go(const VoiceSettingsScreen())),
      KRow(icon: Icons.lock_outline, label: ar ? 'الخصوصية' : 'Privacy', onTap: () => go(const PrivacyPage())),
      KRow(icon: Icons.dark_mode_outlined, label: ar ? 'المظهر' : 'Appearance', onTap: () => go(const AppearancePage())),
      KRow(icon: Icons.info_outline, label: ar ? 'عن التطبيق' : 'About', onTap: () => go(const AboutPage())),
      KRow(icon: Icons.star_border, label: ar ? 'دانو' : 'Danu', onTap: () => go(const DanuPage())),
      const SizedBox(height: 26),
      if (user != null)
        KBtn(ar ? 'تسجيل الخروج' : 'Log out', wide: false, onTap: () async {
          await ref.read(guestProvider.notifier).set(false);
          await AuthService.signOut();
        })
      else
        KBtn(ar ? 'تسجيل الدخول' : 'Log in', wide: false, onTap: () => ref.read(tabProvider.notifier).set(0)),
      const SizedBox(height: 8),
    ]);
  }
}
