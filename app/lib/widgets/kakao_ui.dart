import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/branding.dart';
import '../state/providers.dart';

/// Owner's KAKAO design:
///  background #0F0F0F · white cards radius 22, padding 16, max width 460, centered
///  black buttons · green #16A34A approve · grey secondary · white text on dark, black on cards
class K {
  static const bg = Color(0xFF0F0F0F);
  static const card = Colors.white;
  static const black = Color(0xFF000000);
  static const green = Color(0xFF16A34A);
  static const grey = Color(0xFFE5E5E5);
  static const tabGrey = Color(0xFF2A2A2A);
  static const soft = Color(0xFFF3F3F3);
  static const maxWidth = 460.0;
}

enum KVariant { black, green, grey }

/// Logo + name + "B.K.A Famy" on the start side, عربي | English on the other.
class KHeader extends ConsumerWidget {
  const KHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final t = ref.watch(tProvider);
    final ar = lang == 'ar';
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(children: [
        Row(children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(12)),
            child: Text(Brand.logoLetter(lang), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900, height: 1.1)),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(Brand.name(lang), style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, height: 1.1)),
            Text(Brand.company, style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11)),
          ]),
          const Spacer(),
          InkWell(
            borderRadius: BorderRadius.circular(30),
            onTap: () => ref.read(languageProvider.notifier).set(ar ? 'en' : 'ar'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFF222222), borderRadius: BorderRadius.circular(30)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text('عربي', style: TextStyle(color: ar ? Colors.white : Colors.white54, fontWeight: FontWeight.w700)),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('|', style: TextStyle(color: Colors.white24))),
                Text('English', style: TextStyle(color: ar ? Colors.white54 : Colors.white, fontWeight: FontWeight.w700)),
              ]),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Text(t('tagline'), textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 14)),
      ]),
    );
  }
}

/// 4 tabs in one row: دخول / مصنع / فيديو / إعدادات — selected white, others dark grey.
class KTabs extends ConsumerWidget {
  const KTabs({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tProvider);
    final current = ref.watch(tabProvider);
    final labels = [t('tabLogin'), t('tabBuilder'), t('tabVideo'), t('tabSettings')];
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Row(children: [
        for (var i = 0; i < 4; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => ref.read(tabProvider.notifier).set(i),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: current == i ? Colors.white : K.tabGrey, borderRadius: BorderRadius.circular(14)),
                child: Text(labels[i], style: TextStyle(color: current == i ? Colors.black : Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// White rounded card: radius 22, padding 16.
class KCard extends StatelessWidget {
  final List<Widget> children;
  final CrossAxisAlignment align;
  const KCard({super.key, required this.children, this.align = CrossAxisAlignment.stretch});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: K.card, borderRadius: BorderRadius.circular(22)),
      child: Theme(
        data: Theme.of(context).copyWith(
          brightness: Brightness.light,
          colorScheme: const ColorScheme.light(primary: Colors.black, secondary: K.green, surface: Colors.white),
          textTheme: Theme.of(context).textTheme.apply(bodyColor: Colors.black, displayColor: Colors.black),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            labelStyle: const TextStyle(color: Colors.black54),
            hintStyle: const TextStyle(color: Colors.black38),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFDDDDDD))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFDDDDDD))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.black)),
          ),
          textSelectionTheme: const TextSelectionThemeData(cursorColor: Colors.black),
        ),
        child: DefaultTextStyle.merge(
          style: const TextStyle(color: Colors.black),
          child: Column(crossAxisAlignment: align, children: children),
        ),
      ),
    );
  }
}

class KBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final KVariant v;
  final bool busy;
  final double fontSize;
  final IconData? icon;
  const KBtn(this.label, {super.key, this.onTap, this.v = KVariant.black, this.busy = false, this.fontSize = 17, this.icon});

  @override
  Widget build(BuildContext context) {
    final bg = switch (v) { KVariant.black => K.black, KVariant.green => K.green, KVariant.grey => K.grey };
    final fg = v == KVariant.grey ? Colors.black : Colors.white;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: SizedBox(
        height: 54,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: bg,
            foregroundColor: fg,
            disabledBackgroundColor: bg.withValues(alpha: 0.4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          onPressed: busy ? null : onTap,
          child: busy
              ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: fg))
              : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
                  Flexible(child: Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w700))),
                ]),
        ),
      ),
    );
  }
}

/// White input with a light border, black text (inside cards).
class KInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final int lines;
  final TextInputType? keyboard;
  final bool obscure;
  final bool center;
  final ValueChanged<String>? onChanged;
  const KInput(this.controller, this.hint, {super.key, this.lines = 1, this.keyboard, this.obscure = false, this.center = false, this.onChanged});

  bool get _ltr => keyboard == TextInputType.phone || keyboard == TextInputType.number;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFDDDDDD)));
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: TextField(
        controller: controller,
        minLines: lines,
        maxLines: lines,
        keyboardType: keyboard,
        obscureText: obscure,
        onChanged: onChanged,
        textAlign: center ? TextAlign.center : TextAlign.start,
        textDirection: _ltr ? TextDirection.ltr : null,
        style: const TextStyle(color: Colors.black, fontSize: 16),
        cursorColor: Colors.black,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.black38),
          filled: true,
          fillColor: Colors.white,
          border: border,
          enabledBorder: border,
          focusedBorder: border.copyWith(borderSide: const BorderSide(color: Colors.black)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }
}

class KFooter extends ConsumerWidget {
  const KFooter({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Text(Brand.footer(ref.watch(languageProvider)),
            textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12)),
      );
}

/// Centered 460px column with header (+ optional tabs) and footer. Used by the
/// main shell and by pushed pages (with a back button instead of tabs).
class KPage extends StatelessWidget {
  final List<Widget> children;
  final bool tabs;
  const KPage({super.key, required this.children, this.tabs = false});

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      backgroundColor: K.bg,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: K.maxWidth),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                const KHeader(),
                if (tabs) const KTabs(),
                if (!tabs && canPop)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => Navigator.pop(context)),
                  ),
                ...children,
                const KFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Pills row (selected black, others grey).
class KPills<T> extends StatelessWidget {
  final List<(T, String)> items;
  final T selected;
  final ValueChanged<T> onSelect;
  const KPills({super.key, required this.items, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
        for (final it in items)
          InkWell(
            borderRadius: BorderRadius.circular(30),
            onTap: () => onSelect(it.$1),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(color: it.$1 == selected ? Colors.black : K.grey, borderRadius: BorderRadius.circular(30)),
              child: Text(it.$2, style: TextStyle(color: it.$1 == selected ? Colors.white : Colors.black, fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ),
      ]);
}
