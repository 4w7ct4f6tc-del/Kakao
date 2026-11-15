import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart' show toast, friendlyError;
import '../../widgets/kakao_ui.dart';
import 'email_screen.dart';
import 'recovery_screen.dart';

/// دخول — Google, Facebook, GitHub, Apple (black) · رقم الجوال · green send code ·
/// code · black login with code · grey "forgot password — smart unlock".
class LoginTab extends ConsumerStatefulWidget {
  const LoginTab({super.key});

  @override
  ConsumerState<LoginTab> createState() => _LoginTabState();
}

class _LoginTabState extends ConsumerState<LoginTab> {
  final phone = TextEditingController(text: '+973');
  final code = TextEditingController();
  String? busy;
  List<String>? sentVia;

  Future<void> _run(String key, Future<void> Function() fn) async {
    setState(() => busy = key);
    try {
      await fn();
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = null);
    }
  }

  void _afterLogin() => ref.read(tabProvider.notifier).set(1);

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final user = ref.watch(authProvider).value;
    if (user != null) {
      return KCard(align: CrossAxisAlignment.center, children: [
        Text(t('signedInAs'), style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 4),
        Text(user.displayName ?? user.email ?? user.phoneNumber ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        SizedBox(width: double.infinity, child: KBtn(t('signOut'), v: KVariant.grey, onTap: () => AuthService.signOut())),
      ]);
    }
    Widget social(String key, String label, SocialProvider p) =>
        KBtn(label, busy: busy == key, onTap: () => _run(key, () async {
              await AuthService.signInSocial(p);
              _afterLogin();
            }));
    return KCard(children: [
      social('g', 'Google', SocialProvider.google),
      social('f', 'Facebook', SocialProvider.facebook),
      social('h', 'GitHub', SocialProvider.github),
      social('a', 'Apple', SocialProvider.apple),
      const SizedBox(height: 6),
      KInput(phone, t('phoneLabel'), keyboard: TextInputType.phone),
      KBtn(t('sendActivation'), v: KVariant.green, busy: busy == 'send', onTap: () => _run('send', () async {
            final r = await AuthService.sendOtp(phone: phone.text.trim());
            setState(() => sentVia = r.sentVia);
          })),
      if (sentVia != null)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(sentVia!.join(' + '), textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54)),
        ),
      KInput(code, t('codePh'), keyboard: TextInputType.number, center: true),
      KBtn(t('loginCode'), busy: busy == 'code', onTap: () => _run('code', () async {
            await AuthService.verifyOtp(phone: phone.text.trim(), code: code.text.trim());
            _afterLogin();
          })),
      KBtn(t('forgotSmart'), v: KVariant.grey, onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RecoveryScreen()))),
      TextButton(
        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EmailScreen())),
        child: Text(t('emailLogin'), style: const TextStyle(color: Colors.black54, decoration: TextDecoration.underline)),
      ),
    ]);
  }
}
