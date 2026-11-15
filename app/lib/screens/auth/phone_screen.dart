import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

/// Phone + OTP. One code is delivered by SMS (Twilio) + WhatsApp (Twilio /
/// WhatsApp Business) + Email (SendGrid) at the same time.
class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final phone = TextEditingController(text: '+973');
  final email = TextEditingController();
  final code = TextEditingController();
  bool sent = false;
  bool busy = false;
  List<String> via = [];

  Future<void> _send() async {
    setState(() => busy = true);
    try {
      final r = await AuthService.sendOtp(phone: phone.text.trim(), email: email.text.trim().isEmpty ? null : email.text.trim());
      setState(() {
        sent = true;
        via = r.sentVia;
      });
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() => busy = true);
    try {
      await AuthService.verifyOtp(phone: phone.text.trim(), code: code.text.trim());
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
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('phone'))),
          const SizedBox(height: 12),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: '${t('email')} (+)')),
          const SizedBox(height: 12),
          BigButton(label: t('sendCode'), accent: !sent, loading: busy && !sent, onPressed: _send),
          if (sent) ...[
            const SizedBox(height: 8),
            Text('${t('sentVia')}: ${via.isEmpty ? '—' : via.join(' + ')}', style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 12),
            TextField(
              controller: code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 28, letterSpacing: 10),
              decoration: InputDecoration(labelText: t('code')),
            ),
            BigButton(label: t('verify'), accent: true, loading: busy, onPressed: _verify),
          ],
        ],
      ),
    );
  }
}
