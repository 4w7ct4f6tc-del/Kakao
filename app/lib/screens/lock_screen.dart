import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/auth_service.dart';
import '../services/biometric_service.dart';
import '../state/providers.dart';
import '../widgets/kakao_ui.dart';

/// Face ID / fingerprint lock (Settings → Security). Same white-card design.
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
    final ok = await BiometricService.authenticate(ref.read(tProvider)('continueBiometric'));
    if (ok) widget.onUnlocked();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return KPage(children: [
      KCard(children: [
        const Icon(Icons.fingerprint, size: 72, color: Colors.black),
        KBtn(t('continueBiometric'), v: KVariant.green, onTap: _unlock),
        KBtn(t('signOut'), v: KVariant.grey, onTap: () => AuthService.signOut()),
      ]),
    ]);
  }
}
