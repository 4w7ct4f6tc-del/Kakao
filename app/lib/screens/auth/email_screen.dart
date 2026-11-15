import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'recovery_screen.dart';

class EmailScreen extends ConsumerStatefulWidget {
  const EmailScreen({super.key});

  @override
  ConsumerState<EmailScreen> createState() => _EmailScreenState();
}

class _EmailScreenState extends ConsumerState<EmailScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool signUp = false;
  bool busy = false;
  bool hide = true;

  Future<void> _submit() async {
    setState(() => busy = true);
    try {
      if (signUp) {
        await AuthService.signUpEmail(name.text, email.text, password.text);
      } else {
        await AuthService.signInEmail(email.text, password.text);
      }
      if (mounted) Navigator.popUntil(context, (r) => r.isFirst);
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Scaffold(
      appBar: AppBar(title: const KakaoTitle()),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          SegmentedButton<bool>(
            segments: [
              ButtonSegment(value: false, label: Text(t('signIn'))),
              ButtonSegment(value: true, label: Text(t('signUp'))),
            ],
            selected: {signUp},
            onSelectionChanged: (s) => setState(() => signUp = s.first),
          ),
          const SizedBox(height: 16),
          if (signUp) ...[
            TextField(controller: name, decoration: InputDecoration(labelText: t('name'))),
            const SizedBox(height: 12),
          ],
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: t('email'))),
          const SizedBox(height: 12),
          TextField(
            controller: password,
            obscureText: hide,
            decoration: InputDecoration(
              labelText: t('password'),
              suffixIcon: IconButton(icon: Icon(hide ? Icons.visibility : Icons.visibility_off), onPressed: () => setState(() => hide = !hide)),
            ),
          ),
          const SizedBox(height: 12),
          BigButton(label: signUp ? t('signUp') : t('signIn'), accent: true, loading: busy, onPressed: _submit),
          TextButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RecoveryScreen())),
            child: Text(t('forgot'), style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
