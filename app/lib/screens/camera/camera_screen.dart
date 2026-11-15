import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/ai_service.dart';
import '../../services/camera_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

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
    final XFile? f = await CameraService.pick(camera: camera);
    if (f == null) return;
    final bytes = await f.readAsBytes();
    setState(() {
      busy = true;
      preview = bytes;
      result = null;
      mode = m;
    });
    final lang = ref.read(languageProvider);
    final r = await CameraService.analyze(f, m, lang);
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
    if (!CameraService.cameraSupported) return _run(m, camera: false);
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
    if (!CameraService.scannerSupported) {
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
    return KPage(children: [
      KCard(children: [
        Text(t('camera'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(t('enterPhoto'), style: const TextStyle(color: Colors.black54)),
        KBtn('✨ ${t('buildFromPhoto')}', v: KVariant.green, onTap: busy ? null : () => _choose(VisionMode.buildApp)),
        KBtn('🌐 ${t('translatePhoto')}', onTap: busy ? null : () => _choose(VisionMode.translate)),
        KBtn('🔳 ${t('scanQr')}', onTap: busy ? null : _scanQr),
        KBtn('📄 ${t('scanDoc')}', v: KVariant.grey, onTap: busy ? null : () => _choose(VisionMode.document)),
        KBtn('🪪 ${t('idCard')}', v: KVariant.grey, onTap: busy ? null : () => _choose(VisionMode.idCard)),
      ]),
      if (preview != null || busy)
        KCard(children: [
          if (preview != null) ClipRRect(borderRadius: BorderRadius.circular(14), child: Image.memory(preview!, height: 220, fit: BoxFit.cover)),
          if (busy) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(color: K.green, backgroundColor: K.grey, minHeight: 8),
            const SizedBox(height: 6),
            Text(t('result'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54)),
          ],
        ]),
      if (result != null) _resultCard(t),
    ]);
  }

  Widget _resultCard(String Function(String) t) {
    final r = result!;
    return KCard(children: [
      Text(t('result'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      const SizedBox(height: 8),
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
        child: r.fields.isNotEmpty
            ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final e in r.fields.entries) Text('${e.key}: ${e.value}')])
            : SelectableText(r.text.isEmpty ? t('empty') : r.text, style: const TextStyle(color: Colors.black, height: 1.6)),
      ),
      KBtn('📋 ${t('copy')}', v: KVariant.grey, onTap: () {
        Clipboard.setData(ClipboardData(text: r.text));
        toast(context, t('copied'));
      }),
      if (r.text.startsWith('http'))
        KBtn('🔗 ${t('openLink')}', v: KVariant.grey, onTap: () => launchUrl(Uri.parse(r.text), mode: LaunchMode.externalApplication)),
      KBtn('🌐 ${t('translate')}', v: KVariant.grey, onTap: () async {
        final tr = await AiService.translate(r.text, ref.read(languageProvider));
        setState(() => result = VisionResult(text: tr, fields: r.fields));
      }),
      if (r.text.isNotEmpty)
        KBtn('✨ ${t('useInBuilder')}', onTap: () {
          ref.read(builderSeedProvider.notifier).set(BuilderSeed(prompt: r.text));
          ref.read(tabProvider.notifier).set(1);
          Navigator.pop(context);
        }),
    ]);
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
