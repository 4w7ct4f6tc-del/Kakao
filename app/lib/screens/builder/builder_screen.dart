import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../models/app_design.dart';
import '../../models/templates.dart';
import '../../services/ai_service.dart';
import '../../services/girl_service.dart';
import '../../services/builder_service.dart';
import '../../services/voice_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart' show toast, friendlyError;
import '../../widgets/kakao_ui.dart';
import '../../widgets/kakao_frame.dart';
import '../camera/camera_screen.dart';
import '../talk/discuss_screen.dart';
import '../settings/plans_screen.dart';
import 'design_editor.dart';
import 'phone_preview.dart';

enum _Step { build, consent, connect, done }

/// The builder page in the owner's design: top bar, the white card, the grey bottom box.
class BuilderScreen extends ConsumerStatefulWidget {
  final String? prompt;
  const BuilderScreen({super.key, this.prompt});
  @override
  ConsumerState<BuilderScreen> createState() => _BuilderScreenState();
}

class _BuilderScreenState extends ConsumerState<BuilderScreen> {
  final tab = GlobalKey<_BuilderTabState>();

  @override
  void initState() {
    super.initState();
    if (widget.prompt != null) WidgetsBinding.instance.addPostFrameCallback((_) => tab.currentState?._start(widget.prompt!));
  }

  @override
  Widget build(BuildContext context) {
    final ar = ref.watch(languageProvider) == 'ar';
    return Scaffold(
      backgroundColor: KC.bg,
      drawer: const KMenu(),
      appBar: const KTopBar(band: false),
      body: Column(children: [
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), children: [BuilderTab(key: tab)]),
            ),
          ),
        ),
        KBottomBox(
          home: false,
          onSend: (p) => tab.currentState?._start(p),
          onVoice: () => tab.currentState?._voiceReply(),
          plus: [
            (Icons.photo_camera_outlined, ar ? 'الكاميرا' : 'Camera', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen()))),
            (Icons.movie_outlined, ar ? 'قصة إلى فيديو' : 'Story to video', () => kGo(context, ref, 'video')),
            (Icons.settings_outlined, ar ? 'الإعدادات' : 'Settings', () => kGo(context, ref, 'settings')),
          ],
        ),
      ]),
    );
  }
}

/// مصنع — AI pills · selected AI · one box · ✨ build · 📷 camera · 🔊 real voice reply ·
/// live phone preview · ✅ approve → consent → connect → publish (link + QR).
class BuilderTab extends ConsumerStatefulWidget {
  const BuilderTab({super.key});

  @override
  ConsumerState<BuilderTab> createState() => _BuilderTabState();
}

class _BuilderTabState extends ConsumerState<BuilderTab> {
  final text = TextEditingController();
  final qName = TextEditingController();
  final qColors = TextEditingController();
  final qSell = TextEditingController();
  final whatsapp = TextEditingController();
  final instagram = TextEditingController();
  final domain = TextEditingController();
  AppDesign? design;
  String? busy;
  String reply = '';
  _Step step = _Step.build;
  final consent = [false, false, false];
  PublishResult? result;

  static const _ais = [(AiEngine.meta, 'Meta'), (AiEngine.chatgpt, 'ChatGPT'), (AiEngine.gemini, 'Gemini')];

  void _start(String p) {
    text.text = p;
    _build();
  }

  String get _prompt => text.text.trim().isEmpty ? ref.read(tProvider)('examplePh').split(':').last.trim() : text.text.trim();

  /// Instant local design, then the selected AI improves it.
  Future<void> _build() async {
    final lang = ref.read(languageProvider);
    await ref.read(languageProvider.notifier).observe(_prompt);
    setState(() {
      design = buildLocalDesign(prompt: _prompt, lang: lang, name: qName.text, colorsText: qColors.text, sellText: qSell.text);
      step = _Step.build;
      busy = 'build';
    });
    final d = await BuilderService.generate(prompt: _prompt, lang: lang, name: qName.text, colors: qColors.text, sell: qSell.text);
    if (mounted) {
      setState(() {
        design = d;
        busy = null;
      });
    }
  }

  void _refine() {
    setState(() => design = buildLocalDesign(
        prompt: _prompt, lang: ref.read(languageProvider), name: qName.text, colorsText: qColors.text, sellText: qSell.text));
  }

  /// 🔊 Real girl voice reply. Dialect / type / mode come from the saved girl voice
  /// or from the text itself ("سوي لي إعلان لمحلي باللهجة المصرية بنت تضحك").
  Future<void> _voiceReply() async {
    final said = text.text.trim();
    if (said.isEmpty) return;
    setState(() => busy = 'voice');
    final settings = GirlService.applyRequest(GirlSettings.load().copyWith(mode: 'chat'), said);
    final r = await GirlService.talk('reply', settings, [{'role': 'user', 'content': said}], 0, engine: ref.read(aiChoiceProvider).name);
    setState(() => reply = r.text);
    if (r.audio != null) {
      await VoiceService.playBase64(r.audio!, volume: ref.read(voiceProvider).volume);
    } else if (mounted) {
      toast(context, ref.read(languageProvider) == 'ar' ? 'صوت البنت الحقيقي يشتغل بعد ربط مفتاح ElevenLabs.' : 'The real girl voice works once the ElevenLabs key is connected.');
    }
    if (mounted) setState(() => busy = null);
  }

  Future<void> _approve() async {
    final apps = await BuilderService.myApps();
    final live = apps.where((a) => a.status == 'live' && a.id != design!.id).length;
    if (ref.read(planProvider) == 'free' && live >= AppConfig.freeAppLimit) {
      if (mounted) {
        toast(context, ref.read(tProvider)('freeLimit'));
        Navigator.push(context, MaterialPageRoute(builder: (_) => const PlansScreen()));
      }
      return;
    }
    BuilderService.saveDraft(design!);
    setState(() => step = _Step.consent);
  }

  Future<void> _publish() async {
    final d = design!.copyWith(
      contact: design!.contact.copyWith(whatsapp: whatsapp.text.trim(), instagram: instagram.text.trim()),
      domain: domain.text.trim(),
      status: 'live',
    );
    setState(() {
      design = d;
      busy = 'publish';
    });
    try {
      result = await BuilderService.publish(d, domain: domain.text.trim().isEmpty ? null : domain.text.trim());
      await BuilderService.saveDraft(d);
      setState(() => step = _Step.done);
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
    if (mounted) setState(() => busy = null);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(builderSeedProvider, (_, seed) {
      if (seed == null) return;
      ref.read(builderSeedProvider.notifier).set(null);
      if (seed.design != null) {
        setState(() {
          design = seed.design;
          step = _Step.build;
        });
      } else if (seed.prompt != null) {
        text.text = seed.prompt!;
        _build();
      }
    });
    final t = ref.watch(tProvider);
    final ai = ref.watch(aiChoiceProvider);
    final ar = ref.watch(languageProvider) == 'ar';

    final lbl = TextStyle(color: KC.ink, fontSize: 13, fontWeight: FontWeight.w500, letterSpacing: ar ? 0 : 2.8);
    Widget tile(String label, VoidCallback onTap, {bool on = false, Color? bg}) => Material(
          color: on ? KC.ink : (bg ?? KC.grey),
          elevation: on ? 3 : 0,
          shadowColor: Colors.black38,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: SizedBox(
              height: 54,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Text(label, style: TextStyle(color: on ? Colors.white : KC.ink, fontSize: 16, fontWeight: FontWeight.w500)),
                  ),
                ),
              ),
            ),
          ),
        );
    Widget outlined(IconData icon, String label, VoidCallback? onTap, bool isBusy) => Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFDEDDDA))),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: isBusy ? null : onTap,
            child: SizedBox(
              height: 54,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(icon, size: 20, color: KC.ink),
                    const SizedBox(width: 8),
                    Text(isBusy ? '…' : label, style: const TextStyle(color: KC.ink, fontSize: 16)),
                  ]),
                ),
              ),
            ),
          ),
        );
    Widget grid(List<Widget> items) => Column(children: [
          for (var r = 0; r < items.length; r += 3) ...[
            if (r > 0) const SizedBox(height: 10),
            Row(children: [
              for (var i = r; i < r + 3 && i < items.length; i++) ...[
                if (i > r) const SizedBox(width: 10),
                Expanded(child: items[i]),
              ],
            ]),
          ],
        ]);

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
        padding: const EdgeInsets.fromLTRB(18, 28, 18, 22),
        decoration: BoxDecoration(
          color: KC.card,
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 2, offset: Offset(0, 1)), BoxShadow(color: Color(0x0F3C2814), blurRadius: 32, offset: Offset(0, 12))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(ar ? 'اختر نموذج الذكاء' : 'SELECT AI MODEL', textAlign: TextAlign.center, style: lbl),
          const SizedBox(height: 24),
          Row(children: [
            for (final (i, m) in _ais.indexed) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(child: tile(m.$2, () => ref.read(aiChoiceProvider.notifier).set(m.$1), on: ai == m.$1)),
            ],
          ]),
          const SizedBox(height: 24),
          TextField(
            controller: text,
            onSubmitted: (_) => _build(),
            style: const TextStyle(color: KC.ink, fontSize: 16),
            decoration: InputDecoration(
              hintText: t('examplePh'),
              hintStyle: const TextStyle(color: Color(0xFF8E8C88), fontSize: 15),
              filled: true,
              fillColor: const Color(0xFFF1F0EE),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: Color(0xFFE7E6E3))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: Color(0xFFE7E6E3))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(18), borderSide: const BorderSide(color: Color(0xFFBDBBB7))),
            ),
          ),
          const SizedBox(height: 16),
          Material(
            color: KC.ink,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: busy == 'build' ? null : _build,
              child: SizedBox(
                height: 54,
                child: Center(child: Text(busy == 'build' ? '…' : t('buildBtn'), style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600))),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(child: outlined(Icons.photo_camera_outlined, ar ? 'الكاميرا' : 'Camera', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen())), false)),
            const SizedBox(width: 10),
            Expanded(child: outlined(Icons.mic_none, ar ? 'صوت' : 'Voice', _voiceReply, busy == 'voice')),
            const SizedBox(width: 10),
            Expanded(child: outlined(Icons.auto_fix_high_outlined, ar ? 'دانو' : 'Danu', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DiscussScreen())), false)),
          ]),
          if (reply.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
              child: SelectableText(reply, style: const TextStyle(color: Colors.black, height: 1.6)),
            ),
          if (design == null) ...[
            const SizedBox(height: 30),
            Text(ar ? 'القوالب' : 'TEMPLATES', textAlign: TextAlign.center, style: lbl),
            const SizedBox(height: 20),
            grid([
              for (final tpl in templates.take(6))
                tile('${tpl.title[ar ? 'ar' : 'en']}', () {
                  text.text = ar ? 'أبي تطبيق ${tpl.title['ar']}' : 'I want a ${tpl.title['en']} app';
                  _build();
                }),
            ]),
          ],
        ]),
      ),
      if (design != null && step == _Step.build) _previewCard(t),
      if (step == _Step.consent) _consentCard(t),
      if (step == _Step.connect) _connectCard(t),
      if (step == _Step.done && result != null) _doneCard(t),
    ]);
  }

  Widget _previewCard(String Function(String) t) => KCard(children: [
        Text(t('liveDemo'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Center(child: PhoneFrame(width: 290, child: LivePreviewApp(design: design!, onChanged: (d) => setState(() => design = d)))),
        const SizedBox(height: 12),
        _expand(t('quickQ'), Column(children: [
          KInput(qName, t('q1'), onChanged: (_) => _refine()),
          KInput(qColors, t('q2'), onChanged: (_) => _refine()),
          KInput(qSell, t('q3'), onChanged: (_) => _refine()),
        ])),
        const SizedBox(height: 10),
        _expand(
          t('editDesign'),
          Theme(
            data: ThemeData.dark(useMaterial3: true).copyWith(colorScheme: const ColorScheme.dark(primary: K.green)),
            child: Container(
            height: 440,
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(color: const Color(0xFF1A1A1A), borderRadius: BorderRadius.circular(14)),
            clipBehavior: Clip.antiAlias,
            child: DesignEditor(design: design!, onChanged: (d) => setState(() => design = d)),
          ),
          ),
        ),
        KBtn(t('approveFull'), icon: Icons.check, v: KVariant.green, onTap: _approve),
      ]);

  Widget _expand(String title, Widget child) => Container(
        decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            iconColor: Colors.black,
            collapsedIconColor: Colors.black,
            title: Text(title, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w700, fontSize: 14)),
            childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            children: [child],
          ),
        ),
      );

  Widget _consentCard(String Function(String) t) => KCard(children: [
        Text(t('consentTitle'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        for (final (i, label) in [t('terms'), t('privacy'), t('payment')].indexed)
          Container(
            margin: const EdgeInsets.only(top: 10),
            decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
            child: CheckboxListTile(
              value: consent[i],
              activeColor: K.green,
              onChanged: (v) => setState(() => consent[i] = v ?? false),
              title: Text(label, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
            ),
          ),
        TextButton(
          onPressed: () => launchUrl(Uri.parse('${AppConfig.webBaseUrl}/legal'), mode: LaunchMode.externalApplication),
          child: const Text('Terms • Privacy • Payment', style: TextStyle(color: Colors.black54)),
        ),
        KBtn(t('next'), v: KVariant.green, onTap: consent.every((c) => c) ? () => setState(() => step = _Step.connect) : null),
        KBtn(t('back'), v: KVariant.grey, onTap: () => setState(() => step = _Step.build)),
      ]);

  Widget _connectCard(String Function(String) t) => KCard(children: [
        Text(t('connectTitle'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        KInput(whatsapp, t('whatsapp'), keyboard: TextInputType.phone),
        KInput(instagram, t('instagram')),
        KInput(domain, t('domain')),
        KBtn(t('publish'), icon: Icons.rocket_launch_outlined, v: KVariant.green, busy: busy == 'publish', onTap: _publish),
        KBtn(t('back'), v: KVariant.grey, onTap: () => setState(() => step = _Step.consent)),
      ]);

  Widget _doneCard(String Function(String) t) {
    final r = result!;
    final link = r.customDomain != null ? 'https://${r.customDomain}' : r.url;
    return KCard(align: CrossAxisAlignment.center, children: [
      const Icon(Icons.check_circle_outline, size: 56, color: K.green),
      Text(t('published'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
      const SizedBox(height: 12),
      QrImageView(data: link, size: 190),
      SelectableText(link, textAlign: TextAlign.center, style: const TextStyle(color: K.green, fontWeight: FontWeight.w700)),
      SizedBox(width: double.infinity, child: KBtn(t('openLink'), onTap: () => launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication))),
      SizedBox(
        width: double.infinity,
        child: KBtn(t('copy'), v: KVariant.grey, onTap: () {
          Clipboard.setData(ClipboardData(text: link));
          toast(context, t('copied'));
        }),
      ),
      SizedBox(width: double.infinity, child: KBtn(t('share'), v: KVariant.grey, onTap: () => SharePlus.instance.share(ShareParams(text: '${design!.name}\n$link')))),
      if (r.apkUrl != null) SizedBox(width: double.infinity, child: KBtn('APK', v: KVariant.grey, onTap: () => launchUrl(Uri.parse(r.apkUrl!), mode: LaunchMode.externalApplication))),
      for (final n in r.notes) Text('• $n', style: const TextStyle(color: Colors.black54, fontSize: 12)),
      SizedBox(
        width: double.infinity,
        child: KBtn('+ ${t('newApp')}', v: KVariant.grey, onTap: () => setState(() {
              design = null;
              result = null;
              text.clear();
              consent.fillRange(0, 3, false);
              step = _Step.build;
            })),
      ),
    ]);
  }
}
