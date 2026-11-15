import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/branding.dart';
import '../core/theme.dart';
import '../state/providers.dart';

class KakaoLogo extends ConsumerWidget {
  final double size;
  const KakaoLogo({super.key, this.size = 40});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(size * 0.22),
        border: Border.all(color: const Color(0xFF2A2A2A)),
      ),
      child: Text(
        Brand.logoLetter(lang),
        style: TextStyle(color: Colors.white, fontSize: size * 0.55, fontWeight: FontWeight.w900, height: 1.1),
      ),
    );
  }
}

/// Header: logo + ONE brand name (Arabic OR English, never both).
class KakaoTitle extends ConsumerWidget {
  const KakaoTitle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const KakaoLogo(size: 32),
        const SizedBox(width: 10),
        Text(Brand.name(lang), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      ],
    );
  }
}

class KakaoFooter extends ConsumerWidget {
  const KakaoFooter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        Brand.footer(lang),
        textAlign: TextAlign.center,
        style: const TextStyle(color: KColors.muted, fontSize: 12),
      ),
    );
  }
}

/// Same look as KBtn (owner's design): black, or green when [accent].
class BigButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final String? leading;
  final VoidCallback? onPressed;
  final bool accent;
  final bool loading;
  const BigButton({super.key, required this.label, this.icon, this.leading, this.onPressed, this.accent = false, this.loading = false});

  @override
  Widget build(BuildContext context) {
    final bg = accent ? KColors.accent : Colors.black;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: SizedBox(
        height: 54,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: bg,
            foregroundColor: Colors.white,
            disabledBackgroundColor: bg.withValues(alpha: 0.4),
            disabledForegroundColor: Colors.white70,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: loading ? null : onPressed,
          child: loading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  if (leading != null) Text(leading!, style: const TextStyle(fontSize: 18)),
                  if (icon != null) Icon(icon, size: 20),
                  if (leading != null || icon != null) const SizedBox(width: 8),
                  Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
                ]),
        ),
      ),
    );
  }
}

/// Never an infinite spinner: shows progress, and after [slowAfter] shows the
/// alternatives the caller provides (retry, offline version, etc.).
class ProgressWithAlternatives extends ConsumerStatefulWidget {
  final String label;
  final double? progress;
  final Duration slowAfter;
  final List<(String, VoidCallback)> alternatives;
  const ProgressWithAlternatives({
    super.key,
    required this.label,
    this.progress,
    this.slowAfter = const Duration(seconds: 12),
    this.alternatives = const [],
  });

  @override
  ConsumerState<ProgressWithAlternatives> createState() => _ProgressWithAlternativesState();
}

class _ProgressWithAlternativesState extends ConsumerState<ProgressWithAlternatives> {
  bool slow = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.slowAfter, () {
      if (mounted) setState(() => slow = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(widget.label, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(value: widget.progress, minHeight: 10, color: KColors.accent, backgroundColor: KColors.surface),
          ),
          if (widget.progress != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('${(widget.progress! * 100).round()}%', style: const TextStyle(color: KColors.muted)),
            ),
          if (slow && widget.alternatives.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(t('slow'), style: const TextStyle(color: KColors.muted)),
            Text(t('alternatives'), style: const TextStyle(color: KColors.muted)),
            const SizedBox(height: 8),
            for (final a in widget.alternatives) BigButton(label: a.$1, onPressed: a.$2),
          ],
        ],
      ),
    );
  }
}

void toast(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
}

/// Friendly error text — never "I can't", always a next step.
String friendlyError(Object e, String lang) {
  final ar = lang == 'ar';
  final s = e.toString();
  if (s.contains('not_configured') || s.contains('offline')) {
    return ar
        ? 'الخدمة تحتاج ربط المفاتيح (README). جرّب الخيار الفوري أو تسجيل الدخول كضيف.'
        : 'This service needs its keys connected (see README). Try the instant option or guest mode.';
  }
  if (s.contains('plan') || s.contains('402')) {
    return ar ? 'هذي ميزة مدفوعة — رقّ باقتك من الإعدادات أو أضف مفتاحك الخاص.' : 'Paid feature — upgrade in Settings or add your own key.';
  }
  return ar ? 'صار تأخير بسيط — حاول مرة ثانية أو اختر طريقة ثانية.' : 'Small hiccup — try again or choose another way.';
}
