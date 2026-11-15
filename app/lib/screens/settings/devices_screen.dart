import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

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
    return Scaffold(
      appBar: AppBar(title: Text(t('devices')), actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)]),
      body: loading
          ? const LinearProgressIndicator(color: KColors.accent)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final a in approvals)
                  Card(
                    color: Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('🔐 ${a['deviceName'] ?? ''}', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 16)),
                        Text('${a['code'] ?? ''}  •  ${a['ip'] ?? ''}', style: const TextStyle(color: Colors.black54, fontSize: 18, letterSpacing: 4)),
                        const SizedBox(height: 10),
                        Row(children: [
                          Expanded(
                            child: FilledButton(
                              style: FilledButton.styleFrom(backgroundColor: KColors.accent),
                              onPressed: () => _decide(a['id'], true),
                              child: Text(t('approve')),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(foregroundColor: Colors.black),
                              onPressed: () => _decide(a['id'], false),
                              child: Text(t('deny')),
                            ),
                          ),
                        ]),
                      ]),
                    ),
                  ),
                for (final d in devices)
                  Card(
                    color: KColors.surface,
                    child: ListTile(
                      leading: const Icon(Icons.devices, color: Colors.white),
                      title: Text('${d['name']}', style: const TextStyle(color: Colors.white)),
                      subtitle: Text('${d['lastSeen'] ?? ''}', style: const TextStyle(color: KColors.muted)),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.white54),
                        onPressed: () async {
                          await AccountService.removeDevice(d['id']);
                          await _load();
                        },
                      ),
                    ),
                  ),
                if (devices.isEmpty && approvals.isEmpty) Center(child: Padding(padding: const EdgeInsets.all(40), child: Text(t('empty')))),
              ],
            ),
    );
  }
}
