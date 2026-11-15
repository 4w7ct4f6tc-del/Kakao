import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';
import '../services/biometric_service.dart';
import '../state/providers.dart';
import '../widgets/common.dart';

class LockScreen extends ConsumerStatefulWidget {
  final VoidCallback onUnlocked;
  const LockScreen({super.key, required this.onUnlocked});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    final t = ref.read(tProvider);
    final ok = await BiometricService.authenticate(t('continueBiometric'));
    if (ok) widget.onUnlocked();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              const KakaoLogo(size: 88),
              const SizedBox(height: 24),
              const KakaoTitle(),
              const Spacer(),
              BigButton(label: t('continueBiometric'), icon: Icons.fingerprint, accent: true, onPressed: _unlock),
              BigButton(label: t('signOut'), icon: Icons.logout, onPressed: () => AuthService.signOut()),
              const KakaoFooter(),
            ],
          ),
        ),
      ),
    );
  }
}
