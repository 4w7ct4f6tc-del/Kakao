import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../services/biometric_service.dart';
import '../../services/device_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'email_screen.dart';
import 'phone_screen.dart';
import 'recovery_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String? busy;
  bool canBio = false;

  @override
  void initState() {
    super.initState();
    _checkBio();
  }

  Future<void> _checkBio() async {
    final last = await DeviceService.read('last_uid');
    final ok = await BiometricService.available();
    if (mounted) setState(() => canBio = ok && last != null);
  }

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

  Future<void> _bioLogin() async {
    final t = ref.read(tProvider);
    if (!await BiometricService.authenticate(t('continueBiometric'))) return;
    await AuthService.recoverWithDevice();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const SizedBox(height: 24),
                const Center(child: KakaoLogo(size: 84)),
                const SizedBox(height: 16),
                const Center(child: KakaoTitle()),
                const SizedBox(height: 8),
                Text(t('welcome'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, color: Colors.white70)),
                const SizedBox(height: 28),
                if (canBio)
                  BigButton(
                    label: t('continueBiometric'),
                    icon: Icons.fingerprint,
                    accent: true,
                    loading: busy == 'bio',
                    onPressed: () => _run('bio', _bioLogin),
                  ),
                BigButton(
                  label: t('continueGoogle'),
                  leading: 'G',
                  loading: busy == 'google',
                  onPressed: () => _run('google', () => AuthService.signInSocial(SocialProvider.google)),
                ),
                BigButton(
                  label: t('continueApple'),
                  icon: Icons.apple,
                  loading: busy == 'apple',
                  onPressed: () => _run('apple', () => AuthService.signInSocial(SocialProvider.apple)),
                ),
                BigButton(
                  label: t('continueFacebook'),
                  icon: Icons.facebook,
                  loading: busy == 'facebook',
                  onPressed: () => _run('facebook', () => AuthService.signInSocial(SocialProvider.facebook)),
                ),
                BigButton(
                  label: t('continueGithub'),
                  icon: Icons.code,
                  loading: busy == 'github',
                  onPressed: () => _run('github', () => AuthService.signInSocial(SocialProvider.github)),
                ),
                BigButton(
                  label: t('continuePhone'),
                  icon: Icons.phone_iphone,
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PhoneScreen())),
                ),
                BigButton(
                  label: t('continueEmail'),
                  icon: Icons.email_outlined,
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EmailScreen())),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RecoveryScreen())),
                  child: Text(t('forgot'), style: const TextStyle(color: Colors.white)),
                ),
                TextButton(
                  onPressed: () => ref.read(guestProvider.notifier).set(true),
                  child: Text(t('guest'), style: const TextStyle(color: Colors.white54)),
                ),
                const KakaoFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
