import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/branding.dart';
import '../../core/config.dart';
import '../../services/ai_service.dart';
import '../../services/biometric_service.dart';
import '../../services/girl_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart' show toast;
import '../../widgets/kakao_ui.dart';
import '../talk/discuss_screen.dart';
import 'api_keys_screen.dart';
import 'devices_screen.dart';
import 'integrations_screen.dart';
import 'plans_screen.dart';
import 'questions_screen.dart';

/// Account: who you are, your plan, connections.
class AccountPage extends ConsumerWidget {
  const AccountPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    final t = ref.watch(tProvider);
    final user = ref.watch(authProvider).value;
    final plan = ref.watch(planProvider);
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));
    return KPage(title: ar ? 'الحساب' : 'Account', children: [
      KCard(children: [
        Text(user?.displayName ?? user?.email ?? user?.phoneNumber ?? (ar ? 'ضيف' : 'Guest'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        Text('${t('currentPlan')}: ${t(plan)}', style: TextStyle(color: KT.muted)),
        if (plan == 'free') KBtn('${t('upgrade')} — ${t('pro')} / ${t('ultra')}', v: KVariant.green, onTap: () => go(const PlansScreen())),
        KBtn(t('plans'), v: KVariant.grey, icon: Icons.workspace_premium_outlined, onTap: () => go(const PlansScreen())),
        KBtn(t('integrations'), v: KVariant.grey, icon: Icons.link, onTap: () => go(const IntegrationsScreen())),
      ]),
    ]);
  }
}

/// AI Model: default AI + your own keys.
class AiModelPage extends ConsumerWidget {
  const AiModelPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    final ai = ref.watch(aiChoiceProvider);
    return KPage(title: ar ? 'نموذج الذكاء' : 'AI Model', children: [
      KCard(children: [
        Text(ar ? 'الذكاء الافتراضي للمصنع والنقاش. تقدر تغيّره بأي وقت.' : 'Default AI for the builder and discussions. Change it anytime.', style: TextStyle(color: KT.muted)),
        const SizedBox(height: 12),
        KPills<AiEngine>(
          items: const [(AiEngine.meta, 'Meta'), (AiEngine.chatgpt, 'ChatGPT'), (AiEngine.gemini, 'Gemini')],
          selected: ai,
          onSelect: (e) => ref.read(aiChoiceProvider.notifier).set(e),
        ),
        KBtn(ar ? 'مفاتيحي الخاصة (BYOK)' : 'My own API keys (BYOK)', v: KVariant.grey, icon: Icons.key_outlined,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ApiKeysScreen()))),
      ]),
    ]);
  }
}

/// Notifications: what you want to hear about (saved on this device).
class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});
  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  static const items = [('video', 'الفيديو جاهز', 'Video is ready'), ('publish', 'تم نشر تطبيقك', 'Your app was published'), ('danu', 'دانو تسأل عنك', 'Danu checks in on you'), ('offers', 'العروض والجديد', 'Offers and news')];

  @override
  Widget build(BuildContext context) {
    final ar = ref.watch(languageProvider) == 'ar';
    return KPage(title: ar ? 'الإشعارات' : 'Notifications', children: [
      KCard(children: [
        for (final it in items)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: prefs.getBool('notif_${it.$1}') ?? true,
            activeThumbColor: KT.ink,
            title: Text(ar ? it.$2 : it.$3, style: const TextStyle(fontSize: 17)),
            onChanged: (v) async {
              await prefs.setBool('notif_${it.$1}', v);
              setState(() {});
            },
          ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(ar ? 'الإشعارات توصل للجوال بعد ربط Firebase Cloud Messaging.' : 'Push notifications arrive once Firebase Cloud Messaging is connected.',
              style: TextStyle(color: KT.muted, fontSize: 12)),
        ),
      ]),
    ]);
  }
}

/// Privacy: Face ID lock, devices, smart questions, policy.
class PrivacyPage extends ConsumerWidget {
  const PrivacyPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    final t = ref.watch(tProvider);
    final bio = ref.watch(bioLockProvider);
    void go(Widget w) => Navigator.push(context, MaterialPageRoute(builder: (_) => w));
    return KPage(title: ar ? 'الخصوصية' : 'Privacy', children: [
      KCard(children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: bio,
          activeThumbColor: KT.ink,
          title: Text(t('biometricLock'), style: const TextStyle(fontSize: 17)),
          onChanged: (v) async {
            if (v && !await BiometricService.authenticate(t('biometricLock'))) return;
            await ref.read(bioLockProvider.notifier).set(v);
          },
        ),
        KBtn(t('devices'), v: KVariant.grey, icon: Icons.devices_outlined, onTap: () => go(const DevicesScreen())),
        KBtn(t('smartQuestions'), v: KVariant.grey, icon: Icons.help_outline, onTap: () => go(const QuestionsScreen())),
        KBtn(ar ? 'سياسة الخصوصية والشروط' : 'Privacy policy & terms', v: KVariant.grey, icon: Icons.description_outlined,
            onTap: () => launchUrl(Uri.parse('${AppConfig.webBaseUrl}/legal'), mode: LaunchMode.externalApplication)),
      ]),
    ]);
  }
}

/// Appearance: light (new design, default) or dark (first design).
class AppearancePage extends ConsumerWidget {
  const AppearancePage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    final current = ref.watch(appearanceProvider);
    Widget option(String id, String label, Color bg, Color accent, Color bar) => Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => ref.read(appearanceProvider.notifier).set(id),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: current == id ? KT.ink : const Color(0xFFD6D9DE), width: 2),
              ),
              child: Column(children: [
                Container(
                  height: 80,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFD6D9DE))),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Container(width: 14, height: 14, decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(4))),
                    FractionallySizedBox(widthFactor: 0.66, child: Container(height: 8, decoration: BoxDecoration(color: bar, borderRadius: BorderRadius.circular(4)))),
                  ]),
                ),
                const SizedBox(height: 8),
                Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        );
    return KPage(title: ar ? 'المظهر' : 'Appearance', children: [
      KCard(children: [
        Row(children: [
          option('light', ar ? 'فاتح (الأساسي)' : 'Light (default)', const Color(0xFFF5F5F4), KT.ink, const Color(0xFFFCFCFB)),
          const SizedBox(width: 12),
          option('dark', ar ? 'داكن' : 'Dark', const Color(0xFF0F0F0F), Colors.white, Colors.white),
        ]),
      ]),
    ]);
  }
}

class AboutPage extends ConsumerWidget {
  const AboutPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final ar = lang == 'ar';
    return KPage(title: ar ? 'عن التطبيق' : 'About', children: [
      KCard(children: [
        Text(Brand.name(lang), style: wordmark(lang, 30, color: KT.dark ? Colors.black : null)),
        Text('${ar ? 'الإصدار' : 'Version'} 1.0.0', style: TextStyle(color: KT.muted)),
        const SizedBox(height: 14),
        Text(Brand.companyFull, style: const TextStyle(fontSize: 16)),
        Text('${Brand.company} • ${ar ? 'المالك' : 'Owner'}: ${Brand.owner}', style: TextStyle(color: KT.muted)),
        KBtn(ar ? 'الشروط • الخصوصية • الدفع' : 'Terms • Privacy • Payment', v: KVariant.grey,
            onTap: () => launchUrl(Uri.parse('${AppConfig.webBaseUrl}/legal'), mode: LaunchMode.externalApplication)),
      ]),
    ]);
  }
}

/// Danu: her dialect (default Bahraini Riffa), type, speed, mode, lisp; test; call.
class DanuPage extends ConsumerStatefulWidget {
  const DanuPage({super.key});
  @override
  ConsumerState<DanuPage> createState() => _DanuPageState();
}

class _DanuPageState extends ConsumerState<DanuPage> {
  GirlSettings g = GirlSettings.load();
  GirlSettings saved = GirlSettings.load();
  bool testing = false;

  Future<void> _test() async {
    setState(() => testing = true);
    final r = await DiscussService.send('join', true, g, const [], DiscussState());
    final d = r.danu;
    if (d?.audio != null) {
      await VoiceService.playBase64(d!.audio!, volume: ref.read(voiceProvider).volume);
    } else if (mounted && d != null) {
      toast(context, '${d.text}\n${ref.read(languageProvider) == 'ar' ? '(صوت دانو الحقيقي يشتغل بعد ربط ElevenLabs)' : "(Danu's real voice works once ElevenLabs is connected)"}');
    }
    if (mounted) setState(() => testing = false);
  }

  @override
  Widget build(BuildContext context) {
    final ar = ref.watch(languageProvider) == 'ar';
    Widget section(String title, List<(String, String, String)> items, String selected, ValueChanged<String> onSelect) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(padding: const EdgeInsets.only(top: 16, bottom: 8), child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600))),
            Align(alignment: AlignmentDirectional.centerStart, child: KPills<String>(items: [for (final i in items) (i.$1, ar ? i.$2 : i.$3)], selected: selected, onSelect: onSelect)),
          ],
        );
    return KPage(title: ar ? 'دانو' : 'Danu', children: [
      KCard(children: [
        Text(ar ? 'دانو — بنت الرفاع. تطلع لما تتصل فيها من شاشة النقاش.' : 'Danu — a girl from Riffa. She joins when you call her from the discussion screen.', style: TextStyle(color: KT.muted)),
        section(ar ? 'اللهجة' : 'Dialect', girlDialects, g.dialect, (v) => setState(() => g = g.copyWith(dialect: v))),
        section(ar ? 'نوع البنت' : 'Voice type', girlStyles, g.style, (v) => setState(() => g = g.copyWith(style: v))),
        section(ar ? 'سرعة الكلام' : 'Speed', girlSpeeds, g.speed, (v) => setState(() => g = g.copyWith(speed: v))),
        section(ar ? 'الوضع' : 'Mode', girlModes, g.mode, (v) => setState(() => g = g.copyWith(mode: v))),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: g.lisp,
          activeThumbColor: KT.ink,
          title: Text(ar ? 'لدغة رفاعية خفيفة (ر ← و في الصوت)' : 'Light Riffa lisp (R → W in speech)', style: const TextStyle(fontWeight: FontWeight.w600)),
          onChanged: (v) => setState(() => g = g.copyWith(lisp: v)),
        ),
        KBtn(ar ? 'جرّب الصوت' : 'Test voice', icon: Icons.play_arrow, v: KVariant.grey, busy: testing, onTap: _test),
        KBtn(ar ? 'اعتمد' : 'Save', icon: Icons.check, onTap: g == saved ? null : () async {
          await g.save();
          setState(() => saved = g);
          if (context.mounted) toast(context, ar ? 'تم الحفظ' : 'Saved');
        }),
        KBtn(ar ? 'اتصلوا حق دانو' : 'Call Danu', icon: Icons.phone_outlined, v: KVariant.green, onTap: () async {
          await g.save();
          if (context.mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => const DiscussScreen()));
        }),
      ]),
    ]);
  }
}
