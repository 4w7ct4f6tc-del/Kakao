import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/theme.dart';
import '../../models/app_design.dart';
import '../../models/templates.dart';
import '../../services/account_service.dart';
import '../../services/builder_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../camera/camera_screen.dart';
import '../settings/plans_screen.dart';
import 'design_editor.dart';
import 'phone_preview.dart';

enum BStep { input, questions, generating, edit, consent, connect, publishing, done }

class BuilderScreen extends ConsumerStatefulWidget {
  const BuilderScreen({super.key});

  @override
  ConsumerState<BuilderScreen> createState() => _BuilderScreenState();
}

class _BuilderScreenState extends ConsumerState<BuilderScreen> {
  BStep step = BStep.input;
  final prompt = TextEditingController();
  final answers = List.generate(3, (_) => TextEditingController());
  int q = 0;
  AppDesign? design;
  bool terms = false, privacy = false, payment = false;
  final domain = TextEditingController();
  final whatsapp = TextEditingController();
  final instagram = TextEditingController();
  PublishResult? result;
  List<AppDesign> myApps = [];

  @override
  void initState() {
    super.initState();
    _loadApps();
  }

  Future<void> _loadApps() async {
    final list = await BuilderService.myApps();
    if (mounted) setState(() => myApps = list);
  }

  void _consumeSeed() {
    final seed = ref.read(builderSeedProvider);
    if (seed == null) return;
    ref.read(builderSeedProvider.notifier).set(null);
    if (seed.design != null) {
      setState(() {
        design = seed.design;
        step = BStep.edit;
      });
    } else if (seed.prompt != null) {
      prompt.text = seed.prompt!;
      _startQuestions();
    }
  }

  void _startQuestions() {
    if (prompt.text.trim().isEmpty) return;
    ref.read(languageProvider.notifier).observe(prompt.text);
    // Instant preview while the user answers.
    design = buildLocalDesign(prompt: prompt.text, lang: ref.read(languageProvider));
    setState(() {
      q = 0;
      step = BStep.questions;
    });
  }

  Future<void> _generate() async {
    setState(() => step = BStep.generating);
    final d = await BuilderService.generate(
      prompt: prompt.text,
      lang: ref.read(languageProvider),
      name: answers[0].text,
      colors: answers[1].text,
      sell: answers[2].text,
    );
    if (!mounted) return;
    setState(() {
      design = d;
      step = BStep.edit;
    });
    BuilderService.saveDraft(d);
  }

  void _useLocalNow() {
    setState(() {
      design = buildLocalDesign(
        prompt: prompt.text,
        lang: ref.read(languageProvider),
        name: answers[0].text,
        colorsText: answers[1].text,
        sellText: answers[2].text,
      );
      step = BStep.edit;
    });
  }

  void _update(AppDesign d) {
    setState(() => design = d);
  }

  Future<void> _approve() async {
    final plan = ref.read(planProvider);
    final live = myApps.where((a) => a.status == 'live' && a.id != design!.id).length;
    if (plan == 'free' && live >= AppConfig.freeAppLimit) {
      final t = ref.read(tProvider);
      final go = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Text(t('freeLimit')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('back'))),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('upgrade'))),
          ],
        ),
      );
      if (go == true && mounted) Navigator.push(context, MaterialPageRoute(builder: (_) => const PlansScreen()));
      return;
    }
    BuilderService.saveDraft(design!);
    setState(() => step = BStep.consent);
  }

  Future<void> _publish() async {
    final d = design!.copyWith(
      contact: design!.contact.copyWith(whatsapp: whatsapp.text.trim(), instagram: instagram.text.trim()),
      domain: domain.text.trim(),
      status: 'live',
    );
    setState(() {
      design = d;
      step = BStep.publishing;
    });
    try {
      result = await BuilderService.publish(d, domain: domain.text.trim().isEmpty ? null : domain.text.trim());
    } catch (_) {
      // Alternative: local share link to the web viewer (works once the web app is deployed).
      result = PublishResult('${AppConfig.webBaseUrl}/a/${d.id}', notes: ['offline']);
    }
    await BuilderService.saveDraft(d);
    await _loadApps();
    if (mounted) setState(() => step = BStep.done);
  }

  void _reset() {
    prompt.clear();
    for (final a in answers) {
      a.clear();
    }
    setState(() {
      design = null;
      result = null;
      terms = privacy = payment = false;
      step = BStep.input;
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(builderSeedProvider, (_, next) {
      if (next != null) _consumeSeed();
    });
    final t = ref.watch(tProvider);
    return Scaffold(
      appBar: AppBar(
        title: const KakaoTitle(),
        leading: step == BStep.input || step == BStep.generating || step == BStep.publishing
            ? null
            : IconButton(icon: const Icon(Icons.arrow_back), onPressed: _back),
      ),
      body: SafeArea(child: _body(t)),
    );
  }

  void _back() {
    setState(() {
      switch (step) {
        case BStep.questions:
          if (q > 0) {
            q--;
          } else {
            step = BStep.input;
          }
        case BStep.edit:
          step = BStep.input;
        case BStep.consent:
          step = BStep.edit;
        case BStep.connect:
          step = BStep.consent;
        case BStep.done:
          _reset();
        default:
          break;
      }
    });
  }

  Widget _body(String Function(String) t) {
    switch (step) {
      case BStep.input:
        return _inputStep(t);
      case BStep.questions:
        return _questionsStep(t);
      case BStep.generating:
        return Center(
          child: ProgressWithAlternatives(
            label: t('livePreview'),
            slowAfter: const Duration(seconds: 10),
            alternatives: [(t('useLocal'), _useLocalNow), (t('retry'), _generate)],
          ),
        );
      case BStep.edit:
        return _editStep(t);
      case BStep.consent:
        return _consentStep(t);
      case BStep.connect:
        return _connectStep(t);
      case BStep.publishing:
        return Center(
          child: ProgressWithAlternatives(
            label: t('publishing'),
            slowAfter: const Duration(seconds: 25),
            alternatives: [(t('retry'), _publish)],
          ),
        );
      case BStep.done:
        return _doneStep(t);
    }
  }

  Widget _inputStep(String Function(String) t) {
    final lang = ref.watch(languageProvider);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(t('welcome'), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        TextField(
          controller: prompt,
          minLines: 3,
          maxLines: 6,
          decoration: InputDecoration(hintText: t('oneBoxHint')),
        ),
        const SizedBox(height: 12),
        BigButton(label: t('next'), icon: Icons.auto_awesome, accent: true, onPressed: _startQuestions),
        BigButton(
          label: t('buildFromPhoto'),
          icon: Icons.photo_camera,
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen())),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final tpl in templates)
              ActionChip(
                avatar: Text(tpl.emoji),
                label: Text(tpl.title[lang == 'ar' ? 'ar' : 'en']!),
                onPressed: () {
                  prompt.text = lang == 'ar' ? 'أبي تطبيق ${tpl.title['ar']}' : 'I want a ${tpl.title['en']} app';
                  _startQuestions();
                },
              ),
          ],
        ),
        if (myApps.isNotEmpty) ...[
          const SizedBox(height: 28),
          Text(t('myApps'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          for (final a in myApps)
            Card(
              color: KColors.surface,
              child: ListTile(
                leading: CircleAvatar(backgroundColor: a.primaryColor, child: Text(a.logoEmoji)),
                title: Text(a.name),
                subtitle: Text(a.status == 'live' ? '🟢 live' : '📝 draft', style: const TextStyle(color: KColors.muted)),
                trailing: const Icon(Icons.edit),
                onTap: () => setState(() {
                  design = a;
                  step = BStep.edit;
                }),
              ),
            ),
        ],
        const KakaoFooter(),
      ],
    );
  }

  Widget _questionsStep(String Function(String) t) {
    final labels = [t('q1'), t('q2'), t('q3')];
    final wide = MediaQuery.of(context).size.width > 900;
    final form = ListView(
      padding: const EdgeInsets.all(20),
      children: [
        LinearProgressIndicator(value: (q + 1) / 3, color: KColors.accent, backgroundColor: KColors.surface),
        const SizedBox(height: 24),
        Text('${q + 1}/3', style: const TextStyle(color: KColors.muted)),
        Text(labels[q], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        TextField(
          key: ValueKey(q),
          controller: answers[q],
          autofocus: true,
          onChanged: (_) => setState(() {
            design = buildLocalDesign(
              prompt: prompt.text,
              lang: ref.read(languageProvider),
              name: answers[0].text,
              colorsText: answers[1].text,
              sellText: answers[2].text,
            );
          }),
          onSubmitted: (_) => q < 2 ? setState(() => q++) : _generate(),
        ),
        const SizedBox(height: 16),
        BigButton(label: q < 2 ? t('next') : t('livePreview'), accent: true, onPressed: () => q < 2 ? setState(() => q++) : _generate()),
        BigButton(label: t('skip'), onPressed: () => q < 2 ? setState(() => q++) : _generate()),
      ],
    );
    if (!wide || design == null) return form;
    return Row(children: [
      Expanded(child: form),
      Expanded(child: Center(child: PhoneFrame(child: LivePreviewApp(design: design!)))),
    ]);
  }

  Widget _editStep(String Function(String) t) {
    final d = design!;
    final wide = MediaQuery.of(context).size.width > 900;
    final preview = Center(
      child: FittedBox(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: PhoneFrame(child: LivePreviewApp(design: d, onChanged: _update)),
        ),
      ),
    );
    final editor = DesignEditor(design: d, onChanged: _update);
    final approve = Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: BigButton(label: t('iLikeIt'), icon: Icons.check_circle, accent: true, onPressed: _approve),
    );
    if (wide) {
      return Row(children: [
        Expanded(child: preview),
        Expanded(child: Column(children: [Expanded(child: editor), approve])),
      ]);
    }
    return Column(children: [
      Expanded(flex: 5, child: preview),
      Expanded(flex: 4, child: editor),
      approve,
    ]);
  }

  Widget _consentStep(String Function(String) t) {
    final ok = terms && privacy && payment;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(t('consentTitle'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        CheckboxListTile(value: terms, activeColor: KColors.accent, onChanged: (v) => setState(() => terms = v!), title: Text(t('terms'))),
        CheckboxListTile(value: privacy, activeColor: KColors.accent, onChanged: (v) => setState(() => privacy = v!), title: Text(t('privacy'))),
        CheckboxListTile(value: payment, activeColor: KColors.accent, onChanged: (v) => setState(() => payment = v!), title: Text(t('payment'))),
        TextButton(
          onPressed: () => launchUrl(Uri.parse('${AppConfig.webBaseUrl}/legal'), mode: LaunchMode.externalApplication),
          child: const Text('Terms • Privacy • Payment'),
        ),
        const SizedBox(height: 16),
        BigButton(label: t('next'), accent: true, onPressed: ok ? () => setState(() => step = BStep.connect) : null),
      ],
    );
  }

  Widget _connectStep(String Function(String) t) {
    final paid = ref.watch(planProvider) != 'free';
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(t('connectTitle'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        TextField(controller: whatsapp, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('whatsapp'), prefixIcon: const Icon(Icons.chat))),
        const SizedBox(height: 12),
        TextField(controller: instagram, decoration: InputDecoration(labelText: t('instagram'), prefixIcon: const Icon(Icons.camera_alt_outlined))),
        const SizedBox(height: 12),
        TextField(
          controller: domain,
          enabled: paid,
          decoration: InputDecoration(
            labelText: t('domain'),
            prefixIcon: const Icon(Icons.language),
            helperText: paid ? null : t('paidFeature'),
          ),
        ),
        const SizedBox(height: 12),
        BigButton(
          label: t('paymentConnect'),
          icon: Icons.credit_card,
          onPressed: () async {
            try {
              await AccountService.connectOAuth('stripe');
            } catch (e) {
              if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
            }
          },
        ),
        const SizedBox(height: 20),
        BigButton(label: t('publish'), icon: Icons.rocket_launch, accent: true, onPressed: _publish),
      ],
    );
  }

  Widget _doneStep(String Function(String) t) {
    final r = result!;
    final link = r.customDomain != null ? 'https://${r.customDomain}' : r.url;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('🎉', textAlign: TextAlign.center, style: TextStyle(fontSize: 64)),
        Text(t('published'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
        const SizedBox(height: 20),
        Center(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
            child: QrImageView(data: link, size: 200),
          ),
        ),
        const SizedBox(height: 16),
        SelectableText(link, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, color: KColors.accent)),
        const SizedBox(height: 16),
        BigButton(label: t('openLink'), icon: Icons.open_in_new, accent: true, onPressed: () => launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication)),
        BigButton(
          label: t('copy'),
          icon: Icons.copy,
          onPressed: () {
            Clipboard.setData(ClipboardData(text: link));
            toast(context, t('copied'));
          },
        ),
        BigButton(label: t('share'), icon: Icons.share, onPressed: () => SharePlus.instance.share(ShareParams(text: '${design!.name}\n$link'))),
        if (r.apkUrl != null)
          BigButton(label: 'APK', icon: Icons.android, onPressed: () => launchUrl(Uri.parse(r.apkUrl!), mode: LaunchMode.externalApplication)),
        if (r.repoUrl != null)
          BigButton(label: 'GitHub', icon: Icons.code, onPressed: () => launchUrl(Uri.parse(r.repoUrl!), mode: LaunchMode.externalApplication)),
        for (final n in r.notes.where((n) => n != 'offline'))
          Padding(padding: const EdgeInsets.only(top: 6), child: Text('• $n', style: const TextStyle(color: KColors.muted))),
        const SizedBox(height: 12),
        BigButton(label: t('newApp'), icon: Icons.add, onPressed: _reset),
      ],
    );
  }
}
