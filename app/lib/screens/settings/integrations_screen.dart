import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

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
    return Scaffold(
      appBar: AppBar(title: Text(t('integrations')), actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _load)]),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (_, idx) {
          final i = items[idx];
          return Card(
            color: KColors.surface,
            margin: const EdgeInsets.symmetric(vertical: 5),
            child: ListTile(
              leading: Text(i.icon, style: const TextStyle(fontSize: 26)),
              title: Text(i.name, style: const TextStyle(color: Colors.white)),
              subtitle: Text(
                i.connected ? '✅ ${t('connected')}${i.scopes.isEmpty ? '' : ' • ${i.scopes.join(', ')}'}' : (i.kind == 'oauth' ? 'OAuth' : 'API key'),
                style: const TextStyle(color: KColors.muted),
              ),
              trailing: busy == i.id
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                  : i.connected
                      ? OutlinedButton(onPressed: () => _disconnect(i), child: Text(t('disconnect')))
                      : FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: KColors.accent),
                          onPressed: () => _connect(i),
                          child: Text(t('connect')),
                        ),
            ),
          );
        },
      ),
    );
  }
}
