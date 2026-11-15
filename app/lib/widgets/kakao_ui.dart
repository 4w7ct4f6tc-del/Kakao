import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/branding.dart';
import '../state/providers.dart';

/// Fixed colors used everywhere (status colors, light surfaces).
class K {
  static const green = Color(0xFF16A34A);
  static const blue = Color(0xFF4A78B5);
  static const grey = Color(0xFFE5E5E5);
  static const soft = Color(0xFFF3F3F3);
  static const maxWidth = 460.0;
}

/// Appearance tokens. Dark (default) = the first design; light = the second design (option).
/// `KT.dark` is set by the app root from Settings → Appearance; the whole tree rebuilds on change.
class KT {
  static bool dark = true;
  static Color get bg => dark ? const Color(0xFF0F0F0F) : Colors.white;
  static Color get text => dark ? Colors.white : const Color(0xFF1F2328);
  static Color get muted => dark ? Colors.white60 : const Color(0xFF8A8F98);
  static Color get line => dark ? const Color(0xFF2A2A2A) : const Color(0xFFDFE2E6);
  static Color get card => dark ? Colors.white : Colors.white;
  static double get cardPad => dark ? 16 : 4;
  static Color get tile => dark ? Colors.black : const Color(0xFFDCE7F6);
  static Color get primaryBg => dark ? Colors.black : const Color(0xFFE8F0FB);
  static Color get primaryFg => dark ? Colors.white : const Color(0xFF3F6FB0);
  static Color get strongBg => dark ? K.green : K.blue;
  static Color get outlineBg => dark ? K.grey : Colors.white;
  static Color get outlineBorder => dark ? K.grey : const Color(0xFFD6D9DE);
  static Color get tabOnBg => dark ? Colors.white : const Color(0xFFEAF1FB);
  static Color get tabOnFg => dark ? Colors.black : K.blue;
  static Color get tabOffBg => dark ? const Color(0xFF2A2A2A) : Colors.transparent;
  static Color get tabOffFg => dark ? Colors.white : const Color(0xFF8A8F98);
  static Color get pillBg => dark ? K.grey : Colors.white;
  static Color get pillBorder => dark ? K.grey : const Color(0xFFD6D9DE);
  static Color get pillOnBg => dark ? Colors.black : const Color(0xFFEEF3FB);
  static Color get pillOnFg => dark ? Colors.white : const Color(0xFF3F6FB0);
  static Color get pillOnBorder => dark ? Colors.black : const Color(0xFF9DB8DE);
  static Color get chipBg => dark ? K.soft : const Color(0xFFEFEFEF);
}

enum KVariant { black, green, grey }

/// Serif wordmark: Cormorant Garamond (Latin), Amiri (Arabic).
TextStyle wordmark(String lang, double size, {Color? color}) => lang == 'ar'
    ? GoogleFonts.amiri(fontSize: size, color: color ?? KT.text, fontWeight: FontWeight.w400)
    : GoogleFonts.cormorantGaramond(fontSize: size, color: color ?? KT.text, fontWeight: FontWeight.w500, letterSpacing: size * 0.18);

class KLangToggle extends ConsumerWidget {
  final bool onCard;
  const KLangToggle({super.key, this.onCard = false});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    final on = onCard ? Colors.black : KT.text;
    final off = onCard ? Colors.black38 : KT.muted;
    return InkWell(
      onTap: () => ref.read(languageProvider.notifier).set(ar ? 'en' : 'ar'),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text('عربي', style: TextStyle(color: ar ? on : off, fontSize: 15)),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: Text('|', style: TextStyle(color: off))),
        Text('English', style: TextStyle(color: ar ? off : on, fontSize: 15)),
      ]),
    );
  }
}

/// Language switch on top, then the soft-blue K tile + serif name + "B.K.A Famy".
class KHeader extends ConsumerWidget {
  const KHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(children: [
        const Align(alignment: AlignmentDirectional.centerEnd, child: KLangToggle()),
        const SizedBox(height: 28),
        Row(children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: KT.tile, borderRadius: BorderRadius.circular(12), border: Border.all(color: KT.line)),
            child: Text(Brand.logoLetter(lang), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w300)),
          ),
          const SizedBox(width: 16),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(Brand.name(lang), style: wordmark(lang, 36)),
            Text(Brand.company, style: TextStyle(color: KT.muted, fontSize: 15, letterSpacing: 0.8)),
          ]),
        ]),
      ]),
    );
  }
}

/// Compact header (Settings): small wordmark on one side, page title on the other.
class KCompactHeader extends ConsumerWidget {
  final String title;
  const KCompactHeader(this.title, {super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Row(children: [
        Text(Brand.name(lang), style: wordmark(lang, 22)),
        const Spacer(),
        Text(title, style: TextStyle(color: KT.text, fontSize: 18, fontWeight: FontWeight.w500)),
      ]),
    );
  }
}

/// 4 icon tabs: Login / Builder / Video / Settings.
class KTabs extends ConsumerWidget {
  const KTabs({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tProvider);
    final current = ref.watch(tabProvider);
    final items = [
      (Icons.person_outline, t('tabLogin')),
      (Icons.auto_awesome_outlined, t('tabBuilder')),
      (Icons.smart_display_outlined, t('tabVideo')),
      (Icons.settings_outlined, t('tabSettings')),
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Row(children: [
        for (var i = 0; i < 4; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () {
                Navigator.of(context).popUntil((r) => r.isFirst);
                ref.read(tabProvider.notifier).set(i);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(color: current == i ? KT.tabOnBg : KT.tabOffBg, borderRadius: BorderRadius.circular(18)),
                child: Column(children: [
                  Icon(items[i].$1, size: 26, color: current == i ? KT.tabOnFg : KT.tabOffFg),
                  const SizedBox(height: 4),
                  Text(items[i].$2, style: TextStyle(color: current == i ? KT.tabOnFg : KT.tabOffFg, fontWeight: FontWeight.w600, fontSize: 15)),
                ]),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Section label, e.g. "SELECT AI MODEL".
class KLabel extends ConsumerWidget {
  final String text;
  const KLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    return Padding(
      padding: const EdgeInsets.only(top: 28, bottom: 14),
      child: Text(ar ? text : text.toUpperCase(),
          textAlign: TextAlign.center, style: TextStyle(color: (DefaultTextStyle.of(context).style.color ?? KT.text).withValues(alpha: 0.8), fontSize: 13, letterSpacing: ar ? 0 : 2.4)),
    );
  }
}

/// Content block: flat in light, a white 22px card in dark. Content is dark-on-light in both.
class KCard extends StatelessWidget {
  final List<Widget> children;
  final CrossAxisAlignment align;
  const KCard({super.key, required this.children, this.align = CrossAxisAlignment.stretch});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: EdgeInsets.all(KT.cardPad),
      decoration: BoxDecoration(color: KT.dark ? KT.card : Colors.transparent, borderRadius: BorderRadius.circular(22)),
      child: Theme(
        data: Theme.of(context).copyWith(
          brightness: Brightness.light,
          colorScheme: ColorScheme.light(primary: KT.dark ? Colors.black : K.blue, secondary: KT.strongBg, surface: Colors.white),
          textTheme: Theme.of(context).textTheme.apply(bodyColor: Colors.black, displayColor: Colors.black),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            labelStyle: const TextStyle(color: Colors.black54),
            hintStyle: const TextStyle(color: Colors.black38),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFD6D9DE))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFD6D9DE))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF9DB8DE))),
          ),
          textSelectionTheme: const TextSelectionThemeData(cursorColor: Colors.black),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: KT.dark ? Colors.black : KT.text),
          child: Column(crossAxisAlignment: align, children: children),
        ),
      ),
    );
  }
}

/// black = main action (soft blue in light) · green = final approve · grey = secondary (outlined in light).
class KBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final KVariant v;
  final bool busy;
  final double fontSize;
  final IconData? icon;
  final bool wide;
  final bool accentText;
  const KBtn(this.label, {super.key, this.onTap, this.v = KVariant.black, this.busy = false, this.fontSize = 17, this.icon, this.wide = true, this.accentText = false});

  @override
  Widget build(BuildContext context) {
    final bg = switch (v) { KVariant.black => KT.primaryBg, KVariant.green => KT.strongBg, KVariant.grey => KT.outlineBg };
    var fg = switch (v) { KVariant.black => KT.primaryFg, KVariant.green => Colors.white, KVariant.grey => KT.dark ? Colors.black : const Color(0xFF1F2328) };
    if (accentText) fg = KT.dark ? K.green : const Color(0xFF3F6FB0);
    final border = v == KVariant.grey ? KT.outlineBorder : bg;
    final button = SizedBox(
      height: 52,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          disabledBackgroundColor: bg.withValues(alpha: 0.4),
          disabledForegroundColor: fg.withValues(alpha: 0.6),
          side: BorderSide(color: border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          padding: EdgeInsets.symmetric(horizontal: wide ? 8 : 18),
        ),
        onPressed: busy ? null : onTap,
        child: busy
            ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: fg))
            : Row(mainAxisSize: wide ? MainAxisSize.max : MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 6)],
                Flexible(child: Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600))),
              ]),
      ),
    );
    return Padding(padding: const EdgeInsets.only(top: 10), child: wide ? button : Center(child: button));
  }
}

/// White input with a light border.
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
    final border = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFD6D9DE)));
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
          focusedBorder: border.copyWith(borderSide: const BorderSide(color: Color(0xFF9DB8DE))),
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
        padding: const EdgeInsets.symmetric(vertical: 28),
        child: Text(Brand.footer(ref.watch(languageProvider)), textAlign: TextAlign.center, style: TextStyle(color: KT.muted, fontSize: 13)),
      );
}

/// Centered 460px column: header (+ tabs), the content, footer.
/// [title] switches to the compact Settings header.
class KPage extends StatelessWidget {
  final List<Widget> children;
  final bool tabs;
  final String? title;
  const KPage({super.key, required this.children, this.tabs = false, this.title});

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      backgroundColor: KT.bg,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: K.maxWidth),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                if (title != null) KCompactHeader(title!) else const KHeader(),
                if (tabs) const KTabs(),
                if (title != null) Padding(padding: const EdgeInsets.only(top: 14), child: Divider(color: KT.line, height: 1)),
                if (!tabs && canPop)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.arrow_back_ios_new, size: 16, color: KT.primaryFg),
                      label: Text(MaterialLocalizations.of(context).backButtonTooltip, style: TextStyle(color: KT.primaryFg)),
                    ),
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

/// Outlined pills (selected = soft blue in light, black in dark).
class KPills<T> extends StatelessWidget {
  final List<(T, String)> items;
  final T selected;
  final ValueChanged<T> onSelect;
  final Map<T, IconData>? icons;
  final bool logos; // T is AiEngine: show official provider logos
  const KPills({super.key, required this.items, required this.selected, required this.onSelect, this.icons, this.logos = false});

  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
        for (final it in items)
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => onSelect(it.$1),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: it.$1 == selected ? KT.pillOnBg : KT.pillBg,
                border: Border.all(color: it.$1 == selected ? KT.pillOnBorder : KT.pillBorder),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                if (icons?[it.$1] != null) ...[Icon(icons![it.$1], size: 17, color: it.$1 == selected ? KT.pillOnFg : Colors.black87), const SizedBox(width: 6)],
                if (logos) ...[KBrandLogo((it.$1 as Enum).name, size: 17, invert: it.$1 == selected && KT.dark), const SizedBox(width: 6)],
                Text(it.$2, style: TextStyle(color: it.$1 == selected ? KT.pillOnFg : Colors.black, fontWeight: FontWeight.w600, fontSize: 14)),
              ]),
            ),
          ),
      ]);
}

/// Settings list row: icon, label, optional trailing, chevron, divider.
class KRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget? trailing;
  final VoidCallback onTap;
  const KRow({super.key, required this.icon, required this.label, required this.onTap, this.trailing});

  @override
  Widget build(BuildContext context) {
    final fg = DefaultTextStyle.of(context).style.color ?? Colors.black;
    return InkWell(
      onTap: onTap,
      child: Row(children: [
        Padding(padding: const EdgeInsetsDirectional.only(start: 8, end: 18), child: Icon(icon, size: 26, color: fg)),
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 18),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0x1A000000)))),
            child: Row(children: [
              Expanded(child: Text(label, style: TextStyle(color: fg, fontSize: 19))),
              ?trailing,
              const SizedBox(width: 10),
              Icon(Directionality.of(context) == TextDirection.rtl ? Icons.chevron_left : Icons.chevron_right, color: Colors.black38),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Official logo of an AI provider (assets/brands, from @lobehub/icons-static-svg, MIT).
/// Trademarks belong to their owners; used only to identify each provider.
class KBrandLogo extends StatelessWidget {
  final String engine; // claude | chatgpt | meta | gemini
  final double size;
  final bool invert; // the black OpenAI mark on a black (selected) pill
  const KBrandLogo(this.engine, {super.key, this.size = 18, this.invert = false});

  static const _files = {'claude': 'claude-color', 'chatgpt': 'openai', 'meta': 'meta-color', 'gemini': 'gemini-color'};

  @override
  Widget build(BuildContext context) {
    final f = _files[engine];
    if (f == null) return const SizedBox.shrink();
    return SvgPicture.asset('assets/brands/$f.svg', width: size, height: size,
        colorFilter: engine == 'chatgpt' ? ColorFilter.mode(invert ? Colors.white : Colors.black, BlendMode.srcIn) : null);
  }
}
