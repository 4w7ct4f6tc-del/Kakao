import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

/// Trusted devices + pending "approve sign-in from another device" requests.
class DevicesScreen extends ConsumerStatefulWidget {
  const DevicesScreen({super.key});

  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  List<Map<String, dynamic>> devices = [];
  List<Map<String, dynamic>> approvals = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final d = await AccountService.devices();
      final a = await AccountService.pendingApprovals();
      setState(() {
        devices = d;
        approvals = a;
      });
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _decide(String id, bool approve) async {
    try {
      await AccountService.decide(id, approve);
      await _load();
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return KPage(children: [
      if (loading)
        const KCard(children: [LinearProgressIndicator(color: K.green, backgroundColor: K.grey, minHeight: 8)])
      else ...[
        for (final a in approvals)
          KCard(children: [
            Row(children: [const Icon(Icons.lock_outline, size: 18), const SizedBox(width: 6), Text('${a['deviceName'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))]),
            Text('${a['code'] ?? ''}  •  ${a['ip'] ?? ''}', style: const TextStyle(color: Colors.black54, fontSize: 18, letterSpacing: 4)),
            Row(children: [
              Expanded(child: KBtn(t('approve'), v: KVariant.green, onTap: () => _decide(a['id'], true))),
              const SizedBox(width: 10),
              Expanded(child: KBtn(t('deny'), v: KVariant.grey, onTap: () => _decide(a['id'], false))),
            ]),
          ]),
        KCard(children: [
          Row(children: [
            Expanded(child: Text(t('devices'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
            IconButton(icon: const Icon(Icons.refresh, color: Colors.black), onPressed: _load),
          ]),
          if (devices.isEmpty && approvals.isEmpty)
            Padding(padding: const EdgeInsets.all(16), child: Text(t('empty'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54))),
          for (final d in devices)
            Container(
              margin: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
              child: ListTile(
                leading: const Icon(Icons.smartphone, color: Colors.black),
                title: Text('${d['name']}', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w700)),
                subtitle: Text('${d['lastSeen'] ?? ''}', style: const TextStyle(color: Colors.black54)),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.black54),
                  onPressed: () async {
                    await AccountService.removeDevice(d['id']);
                    await _load();
                  },
                ),
              ),
            ),
        ]),
      ],
    ]);
  }
}
