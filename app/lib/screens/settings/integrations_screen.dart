import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

/// "Connect X" -> official X consent page -> token stored encrypted ->
/// used only for approved scopes -> Disconnect revokes it.
class IntegrationsScreen extends ConsumerStatefulWidget {
  const IntegrationsScreen({super.key});

  @override
  ConsumerState<IntegrationsScreen> createState() => _IntegrationsScreenState();
}

class _IntegrationsScreenState extends ConsumerState<IntegrationsScreen> with WidgetsBindingObserver {
  List<IntegrationInfo> items = [];
  String? busy;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Refresh when the user comes back from the provider's consent page.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    final list = await AccountService.integrations();
    if (mounted) setState(() => items = list);
  }

  Future<void> _connect(IntegrationInfo i) async {
    final t = ref.read(tProvider);
    final paid = ref.read(planProvider) != 'free';
    final connectedCount = items.where((x) => x.connected).length;
    if (!paid && connectedCount >= 1) {
      toast(context, t('paidFeature'));
      return;
    }
    setState(() => busy = i.id);
    try {
      if (i.kind == 'oauth') {
        await AccountService.connectOAuth(i.id);
      } else {
        final key = TextEditingController();
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('${i.icon} ${i.name}'),
            content: TextField(controller: key, obscureText: true, decoration: const InputDecoration(labelText: 'API key / token')),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('back'))),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('save'))),
            ],
          ),
        );
        if (ok == true && key.text.trim().isNotEmpty) {
          await AccountService.connectApiKey(i.id, key.text.trim());
          await _load();
        }
      }
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = null);
    }
  }

  Future<void> _disconnect(IntegrationInfo i) async {
    setState(() => busy = i.id);
    try {
      await AccountService.disconnect(i.id);
      await _load();
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return KPage(children: [
      KCard(children: [
        Row(children: [
          Expanded(child: Text(t('integrations'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          IconButton(icon: const Icon(Icons.refresh, color: Colors.black), onPressed: _load),
        ]),
        for (final i in items)
          Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              Icon(i.connected ? Icons.link : Icons.link_off, color: i.connected ? K.green : Colors.black45),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(i.name, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w700)),
                  Text(
                    i.connected ? t('connected') : (i.kind == 'oauth' ? 'OAuth' : 'API key'),
                    style: const TextStyle(color: Colors.black54, fontSize: 12),
                  ),
                ]),
              ),
              if (busy == i.id)
                const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
              else
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: i.connected ? K.grey : Colors.black,
                    foregroundColor: i.connected ? Colors.black : Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => i.connected ? _disconnect(i) : _connect(i),
                  child: Text(i.connected ? t('disconnect') : t('connect')),
                ),
            ]),
          ),
      ]),
    ]);
  }
}
