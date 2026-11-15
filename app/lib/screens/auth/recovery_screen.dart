import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/auth_service.dart';
import '../../services/biometric_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

enum _Step { choose, otp, waiting, questions, newPassword }

/// Smart recovery — no long steps. Five instant options, then set a new password.
class RecoveryScreen extends ConsumerStatefulWidget {
  const RecoveryScreen({super.key});

  @override
  ConsumerState<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends ConsumerState<RecoveryScreen> {
  final identifier = TextEditingController();
  final code = TextEditingController();
  final newPass = TextEditingController();
  final answers = List.generate(3, (_) => TextEditingController());
  _Step step = _Step.choose;
  bool busy = false;
  String waitingText = '';
  String? approvalCode;
  List<String> via = [];
  List<String> questions = [];

  Future<void> _guard(Future<void> Function() fn) async {
    setState(() => busy = true);
    try {
      await fn();
    } catch (e) {
      if (mounted) {
        toast(context, friendlyError(e, ref.read(languageProvider)));
        if (step == _Step.waiting) setState(() => step = _Step.choose);
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  bool _needId() {
    if (identifier.text.trim().isEmpty) {
      toast(context, ref.read(tProvider)('identifier'));
      return true;
    }
    return false;
  }

  Future<void> _biometric() => _guard(() async {
        final t = ref.read(tProvider);
        if (!await BiometricService.authenticate(t('recBiometric'))) return;
        await AuthService.recoverWithDevice();
        setState(() => step = _Step.newPassword);
      });

  Future<void> _otp() async {
    if (_needId()) return;
    await _guard(() async {
      final r = await AuthService.recoverSendOtp(identifier.text.trim());
      setState(() {
        via = r.sentVia;
        step = _Step.otp;
      });
    });
  }

  Future<void> _verifyOtp() => _guard(() async {
        await AuthService.recoverVerifyOtp(identifier.text.trim(), code.text.trim());
        setState(() => step = _Step.newPassword);
      });

  Future<void> _magic() async {
    if (_needId()) return;
    final t = ref.read(tProvider);
    await _guard(() async {
      final id = await AuthService.recoverMagicStart(identifier.text.trim());
      setState(() {
        waitingText = t('waitingMagic');
        step = _Step.waiting;
      });
      await AuthService.recoverMagicWait(id);
      setState(() => step = _Step.newPassword);
    });
  }

  Future<void> _device() async {
    if (_needId()) return;
    final t = ref.read(tProvider);
    await _guard(() async {
      final r = await AuthService.recoverApprovalStart(identifier.text.trim());
      setState(() {
        approvalCode = r['code']?.toString();
        waitingText = t('waitingApproval');
        step = _Step.waiting;
      });
      await AuthService.recoverApprovalWait(r['id'] as String);
      setState(() => step = _Step.newPassword);
    });
  }

  Future<void> _questions() async {
    if (_needId()) return;
    await _guard(() async {
      final q = await AuthService.recoverQuestions(identifier.text.trim());
      setState(() {
        questions = q;
        step = _Step.questions;
      });
    });
  }

  Future<void> _answer() => _guard(() async {
        await AuthService.recoverAnswer(identifier.text.trim(), answers.take(questions.length).map((c) => c.text).toList());
        setState(() => step = _Step.newPassword);
      });

  Future<void> _savePassword() => _guard(() async {
        await AuthService.setNewPassword(newPass.text);
        if (!mounted) return;
        toast(context, ref.read(tProvider)('passwordChanged'));
        Navigator.popUntil(context, (r) => r.isFirst);
      });

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Scaffold(
      appBar: AppBar(title: const KakaoTitle()),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(t('recoveryTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          ..._body(t),
        ],
      ),
    );
  }

  List<Widget> _body(String Function(String) t) {
    switch (step) {
      case _Step.choose:
        return [
          TextField(controller: identifier, decoration: InputDecoration(labelText: t('identifier'))),
          const SizedBox(height: 16),
          BigButton(label: t('recBiometric'), icon: Icons.fingerprint, accent: true, loading: busy, onPressed: _biometric),
          BigButton(label: t('recOtp'), icon: Icons.sms_outlined, onPressed: busy ? null : _otp),
          BigButton(label: t('recMagic'), icon: Icons.auto_fix_high, onPressed: busy ? null : _magic),
          BigButton(label: t('recDevice'), icon: Icons.devices, onPressed: busy ? null : _device),
          BigButton(label: t('recQuestions'), icon: Icons.quiz_outlined, onPressed: busy ? null : _questions),
        ];
      case _Step.otp:
        return [
          Text('${t('sentVia')}: ${via.join(' + ')}', style: const TextStyle(color: Colors.white70)),
          const SizedBox(height: 12),
          TextField(
            controller: code,
            maxLength: 6,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 28, letterSpacing: 10),
            decoration: InputDecoration(labelText: t('code')),
          ),
          BigButton(label: t('verify'), accent: true, loading: busy, onPressed: _verifyOtp),
          BigButton(label: t('back'), onPressed: () => setState(() => step = _Step.choose)),
        ];
      case _Step.waiting:
        return [
          const SizedBox(height: 24),
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 24),
          Text(waitingText, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16)),
          if (approvalCode != null) ...[
            const SizedBox(height: 16),
            Center(child: Text(approvalCode!, style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w900, letterSpacing: 8))),
          ],
          const SizedBox(height: 24),
          BigButton(label: t('back'), onPressed: () => setState(() => step = _Step.choose)),
        ];
      case _Step.questions:
        return [
          for (var i = 0; i < questions.length && i < 3; i++) ...[
            Text(questions[i], style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextField(controller: answers[i], decoration: InputDecoration(labelText: t('answer'))),
            const SizedBox(height: 12),
          ],
          BigButton(label: t('verify'), accent: true, loading: busy, onPressed: _answer),
          BigButton(label: t('back'), onPressed: () => setState(() => step = _Step.choose)),
        ];
      case _Step.newPassword:
        return [
          TextField(controller: newPass, obscureText: true, decoration: InputDecoration(labelText: t('newPassword'))),
          const SizedBox(height: 12),
          BigButton(label: t('savePassword'), accent: true, loading: busy, onPressed: _savePassword),
        ];
    }
  }
}
