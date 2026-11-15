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
import '../camera/camera_screen.dart';
import '../talk/discuss_screen.dart';
import '../settings/plans_screen.dart';
import 'design_editor.dart';
import 'phone_preview.dart';

enum _Step { build, consent, connect, done }

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

  static const _ais = [(AiEngine.claude, 'Claude'), (AiEngine.chatgpt, 'ChatGPT'), (AiEngine.meta, 'Meta'), (AiEngine.gemini, 'Gemini')];

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

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      KCard(children: [
      KLabel(ar ? 'اختر نموذج الذكاء' : 'Select AI model'),
      Row(children: [
        for (final (i, m) in _ais.indexed) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(child: _aiPill(m.$1, m.$2, ai == m.$1)),
        ],
      ]),
      const SizedBox(height: 22),
      KInput(text, t('examplePh'), lines: 3, center: true),
      const SizedBox(height: 8),
      KBtn(t('buildBtn'), icon: Icons.auto_awesome_outlined, wide: false, busy: busy == 'build', onTap: _build),
      const SizedBox(height: 18),
      Row(children: [
        Expanded(child: KBtn(ar ? 'الكاميرا' : 'Camera', icon: Icons.photo_camera_outlined, v: KVariant.grey, fontSize: 14, onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen())))),
        const SizedBox(width: 8),
        Expanded(child: KBtn(ar ? 'صوت' : 'Voice', icon: Icons.volume_up_outlined, v: KVariant.grey, fontSize: 14, busy: busy == 'voice', onTap: _voiceReply)),
        const SizedBox(width: 8),
        Expanded(
          child: KBtn(ar ? 'دانو' : 'Danu', icon: Icons.chat_bubble_outline, v: KVariant.grey, accentText: true, fontSize: 14,
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DiscussScreen()))),
        ),
      ]),
      if (reply.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(top: 14),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: K.soft, borderRadius: BorderRadius.circular(14)),
          child: SelectableText(reply, style: const TextStyle(color: Colors.black, height: 1.6)),
        ),
      if (design == null) ...[
        KLabel(ar ? 'القوالب' : 'Templates'),
        Wrap(spacing: 10, runSpacing: 10, alignment: WrapAlignment.center, children: [
          for (final tpl in templates.take(6))
            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () {
                text.text = ar ? 'أبي تطبيق ${tpl.title['ar']}' : 'I want a ${tpl.title['en']} app';
                _build();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                decoration: BoxDecoration(color: KT.chipBg, border: Border.all(color: KT.outlineBorder), borderRadius: BorderRadius.circular(14)),
                child: Text('${tpl.title[ar ? 'ar' : 'en']}', style: const TextStyle(color: Colors.black, fontSize: 16)),
              ),
            ),
        ]),
      ],
      ]),
      if (design != null && step == _Step.build) _previewCard(t),
      if (step == _Step.consent) _consentCard(t),
      if (step == _Step.connect) _connectCard(t),
      if (step == _Step.done && result != null) _doneCard(t),
    ]);
  }

  Widget _aiPill(AiEngine e, String name, bool on) => InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => ref.read(aiChoiceProvider.notifier).set(e),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: on ? KT.pillOnBg : KT.pillBg,
            border: Border.all(color: on ? KT.pillOnBorder : KT.pillBorder),
            borderRadius: BorderRadius.circular(14),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              KBrandLogo(e.name, size: 16, invert: on && KT.dark),
              const SizedBox(width: 4),
              Text(name, style: TextStyle(color: on ? KT.pillOnFg : Colors.black, fontWeight: FontWeight.w600, fontSize: 14)),
            ]),
          ),
        ),
      );

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
