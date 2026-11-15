import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme.dart';
import '../../services/ai_service.dart';
import '../../services/vision_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

/// Smart camera: photo of shop/menu/card/product -> app; photo of text ->
/// translation; QR/barcode; document scan; ID card -> signup fields.
class CameraScreen extends ConsumerStatefulWidget {
  const CameraScreen({super.key});

  @override
  ConsumerState<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends ConsumerState<CameraScreen> {
  bool busy = false;
  Uint8List? preview;
  VisionResult? result;
  VisionMode? mode;

  Future<void> _run(VisionMode m, {required bool camera}) async {
    final XFile? f = await VisionService.pick(camera: camera);
    if (f == null) return;
    final bytes = await f.readAsBytes();
    setState(() {
      busy = true;
      preview = bytes;
      result = null;
      mode = m;
    });
    final lang = ref.read(languageProvider);
    final r = await VisionService.analyze(f, m, lang);
    if (!mounted) return;
    setState(() {
      busy = false;
      result = r;
    });
    if (m == VisionMode.buildApp && r.design != null) {
      ref.read(builderSeedProvider.notifier).set(BuilderSeed(design: r.design));
      ref.read(tabProvider.notifier).set(1);
      Navigator.pop(context);
    }
  }

  Future<void> _choose(VisionMode m) async {
    final t = ref.read(tProvider);
    if (!VisionService.cameraSupported) return _run(m, camera: false);
    final camera = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_camera), title: Text(t('takePhoto')), onTap: () => Navigator.pop(ctx, true)),
          ListTile(leading: const Icon(Icons.photo_library), title: Text(t('gallery')), onTap: () => Navigator.pop(ctx, false)),
        ]),
      ),
    );
    if (camera != null) await _run(m, camera: camera);
  }

  void _scanQr() {
    if (!VisionService.scannerSupported) {
      _choose(VisionMode.document);
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => _QrScanner(onCode: (code) {
        setState(() {
          result = VisionResult(text: code);
          mode = VisionMode.document;
        });
      })),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t('camera'))),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(t('enterPhoto'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          BigButton(label: t('buildFromPhoto'), icon: Icons.auto_awesome, accent: true, onPressed: busy ? null : () => _choose(VisionMode.buildApp)),
          BigButton(label: t('translatePhoto'), icon: Icons.translate, onPressed: busy ? null : () => _choose(VisionMode.translate)),
          BigButton(label: t('scanQr'), icon: Icons.qr_code_scanner, onPressed: busy ? null : _scanQr),
          BigButton(label: t('scanDoc'), icon: Icons.document_scanner_outlined, onPressed: busy ? null : () => _choose(VisionMode.document)),
          BigButton(label: t('idCard'), icon: Icons.badge_outlined, onPressed: busy ? null : () => _choose(VisionMode.idCard)),
          if (preview != null) ...[
            const SizedBox(height: 16),
            ClipRRect(borderRadius: BorderRadius.circular(16), child: Image.memory(preview!, height: 220, fit: BoxFit.cover)),
          ],
          if (busy)
            ProgressWithAlternatives(
              label: t('result'),
              alternatives: [(t('retry'), () => mode == null ? null : _choose(mode!))],
            ),
          if (result != null) _resultCard(t),
        ],
      ),
    );
  }

  Widget _resultCard(String Function(String) t) {
    final r = result!;
    return Card(
      color: KColors.surface,
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t('result'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            if (r.fields.isNotEmpty)
              for (final e in r.fields.entries) Text('${e.key}: ${e.value}')
            else
              SelectableText(r.text.isEmpty ? t('empty') : r.text),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.copy, size: 16),
                label: Text(t('copy')),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: r.text));
                  toast(context, t('copied'));
                },
              ),
              if (r.text.startsWith('http'))
                OutlinedButton.icon(
                  icon: const Icon(Icons.open_in_new, size: 16),
                  label: Text(t('openLink')),
                  onPressed: () => launchUrl(Uri.parse(r.text), mode: LaunchMode.externalApplication),
                ),
              OutlinedButton.icon(
                icon: const Icon(Icons.translate, size: 16),
                label: Text(t('translate')),
                onPressed: () async {
                  final tr = await AiService.translate(r.text, ref.read(languageProvider));
                  setState(() => result = VisionResult(text: tr, fields: r.fields));
                },
              ),
              if (r.text.isNotEmpty)
                OutlinedButton.icon(
                  icon: const Icon(Icons.auto_awesome, size: 16),
                  label: Text(t('useInBuilder')),
                  onPressed: () {
                    ref.read(builderSeedProvider.notifier).set(BuilderSeed(prompt: r.text));
                    ref.read(tabProvider.notifier).set(1);
                    Navigator.pop(context);
                  },
                ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _QrScanner extends StatefulWidget {
  final ValueChanged<String> onCode;
  const _QrScanner({required this.onCode});

  @override
  State<_QrScanner> createState() => _QrScannerState();
}

class _QrScannerState extends State<_QrScanner> {
  bool done = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: MobileScanner(
        onDetect: (capture) {
          if (done) return;
          final code = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
          if (code == null) return;
          done = true;
          widget.onCode(code);
          Navigator.pop(context);
        },
      ),
    );
  }
}
