import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../screens/builder/builder_screen.dart';
import '../screens/shell.dart';
import '../screens/talk/discuss_screen.dart';
import '../services/voice_service.dart';
import '../state/providers.dart';
import 'kakao_ui.dart';

/// The owner's design: soft #F5F5F4, round menu · KAkAo · black K, one rounded bottom box.
class KC {
  // Page-level colors follow Settings → Appearance (light default / dark); inside cards and boxes they stay fixed.
  static Color get bg => KT.bg;
  static Color get page => KT.text;
  static Color get top =>
      KT.dark ? const Color(0xFF161616) : const Color(0xFFEDE7E1);
  static Color get brand =>
      KT.dark ? const Color(0xFFC9A89A) : const Color(0xFF8C6A5A);
  static Color get text => KT.muted;
  static Color get menu =>
      KT.dark ? const Color(0xFF262626) : const Color(0xFFEADFD6);
  static Color get menuLine =>
      KT.dark ? const Color(0xFF3A3A3A) : const Color(0xFFD9CBBF);
  static Color get markBg => KT.dark ? Colors.white : ink;
  static Color get markFg =>
      KT.dark ? const Color(0xFF0F0F0F) : const Color(0xFFF5F5F4);
  static const ink = Color(0xFF141210);
  static const hint = Color(0xFF8E8680);
  static const box = Color(0xFFFBFAF9);
  static const grey = Color(0xFFEBEAE8);
  static const card = Color(0xFFFCFCFB);
}

TextStyle kSerif(bool ar, double size, {Color? color}) => ar
    ? GoogleFonts.amiri(fontSize: size, color: color ?? KC.page, height: 1.1)
    : GoogleFonts.cormorantGaramond(
        fontSize: size,
        color: color ?? KC.page,
        fontWeight: FontWeight.w500,
        height: 1.05,
      );

String kName(bool ar) => ar ? 'خعخعو' : 'KAkAo';

/// Black circle with K (خ in Arabic).
class KMark extends ConsumerWidget {
  final double size;
  final double font;
  const KMark({super.key, required this.size, required this.font});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: KC.markBg, shape: BoxShape.circle),
      child: Transform.translate(
        offset: Offset(0, ar ? -font * 0.12 : 0),
        child: Text(
          ar ? 'خ' : 'K',
          style: kSerif(ar, ar ? font * 0.86 : font, color: KC.markFg),
        ),
      ),
    );
  }
}

/// Opens one of the app's places from the round menu.
void kGo(BuildContext context, WidgetRef ref, String to) {
  Navigator.of(context).popUntil((r) => r.isFirst);
  switch (to) {
    case 'home':
      return;
    case 'builder':
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const BuilderScreen()),
      );
    case 'talk':
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const DiscussScreen()),
      );
    default:
      ref
          .read(tabProvider.notifier)
          .set(const {'login': 0, 'video': 2, 'settings': 3}[to] ?? 1);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const MainShell()),
      );
  }
}

class KTopBar extends ConsumerWidget implements PreferredSizeWidget {
  final bool band;
  final bool bare; // no menu / account (lock screen)
  const KTopBar({super.key, this.band = true, this.bare = false});
  @override
  Size get preferredSize => const Size.fromHeight(88);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    return Container(
      color: band ? KC.top : KC.bg,
      padding: EdgeInsets.fromLTRB(
        18,
        MediaQuery.paddingOf(context).top + 18,
        18,
        18,
      ),
      child: Row(
        children: [
          if (bare)
            const SizedBox(width: 52)
          else
            Semantics(
              button: true,
              label: ar ? 'القائمة' : 'Menu',
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => Scaffold.of(context).openDrawer(),
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: KC.menu,
                    shape: BoxShape.circle,
                    border: Border.all(color: KC.menuLine),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1F503C28),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(Icons.menu, color: KC.page, size: 24),
                ),
              ),
            ),
          Expanded(
            child: Text(
              kName(ar),
              textAlign: TextAlign.center,
              style: kSerif(ar, 34),
            ),
          ),
          if (bare)
            const KMark(size: 52, font: 30)
          else
            Semantics(
              button: true,
              label: ar ? 'الحساب' : 'Account',
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => kGo(context, ref, 'settings'),
                child: const KMark(size: 52, font: 30),
              ),
            ),
        ],
      ),
    );
  }
}

class KMenu extends ConsumerWidget {
  const KMenu({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final ar = lang == 'ar';
    final items = [
      (Icons.home_outlined, ar ? 'الرئيسية' : 'Home', 'home'),
      (Icons.auto_awesome_outlined, ar ? 'المصنع' : 'Builder', 'builder'),
      (Icons.movie_outlined, ar ? 'الفيديو' : 'Video', 'video'),
      (Icons.chat_bubble_outline, ar ? 'المحادثة' : 'Talk', 'talk'),
      (Icons.settings_outlined, ar ? 'الإعدادات' : 'Settings', 'settings'),
      (Icons.person_outline, ar ? 'تسجيل الدخول' : 'Log in', 'login'),
    ];
    return Drawer(
      backgroundColor: KC.bg,
      width: 300,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 22, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 14),
                child: Text(kName(ar), style: kSerif(ar, 30)),
              ),
              for (final (icon, label, to) in items)
                ListTile(
                  leading: Icon(icon, color: KC.page),
                  title: Text(
                    label,
                    style: TextStyle(color: KC.page, fontSize: 16),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    kGo(context, ref, to);
                  },
                ),
              const Spacer(),
              Row(
                children: [
                  for (final (code, label) in [
                    ('ar', 'عربي'),
                    ('en', 'English'),
                  ]) ...[
                    if (code == 'en') const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(999),
                        onTap: () =>
                            ref.read(languageProvider.notifier).set(code),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: lang == code
                                ? KC.markBg
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: KC.menuLine),
                          ),
                          child: Text(
                            label,
                            style: TextStyle(
                              color: lang == code ? KC.markFg : KC.page,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The one rounded box: + · "Type or hold to talk" · mic, and a black round button.
/// home: waveform button inside a soft box. build: speaker button outside a grey box.
class KBottomBox extends ConsumerStatefulWidget {
  final bool home;
  final void Function(String text) onSend;
  final VoidCallback onVoice;
  final List<(IconData, String, VoidCallback)> plus;
  const KBottomBox({
    super.key,
    required this.home,
    required this.onSend,
    required this.onVoice,
    required this.plus,
  });

  @override
  ConsumerState<KBottomBox> createState() => _KBottomBoxState();
}

class _KBottomBoxState extends ConsumerState<KBottomBox> {
  final text = TextEditingController();
  bool open = false;
  bool listening = false;

  void _send([String? v]) {
    final p = (v ?? text.text).trim();
    if (p.isEmpty) return;
    widget.onSend(p);
    text.clear();
    setState(() {});
  }

  // Hold the mic to talk: record while held, the words land in the box and are sent.
  Future<void> _holdStart() async {
    if (await VoiceService.startRecording()) setState(() => listening = true);
  }

  Future<void> _holdEnd() async {
    if (!listening) return;
    setState(() => listening = false);
    final audio = await VoiceService.stopRecording();
    if (audio == null) return;
    try {
      final said = (await VoiceService.transcribe(audio))['text'] ?? '';
      if (said.trim().isNotEmpty) {
        text.text = said;
        _send(said);
      }
    } catch (_) {
      /* no speech service yet: typing still works */
    }
  }

  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ar = ref.watch(languageProvider) == 'ar';
    final home = widget.home;
    final typed = text.text.trim().isNotEmpty;
    final ph = listening
        ? (ar ? 'أسمعك…' : 'Listening…')
        : (ar ? 'اكتب أو اضغط مطولاً للكلام' : 'Type or hold to talk');

    final black = Semantics(
      button: true,
      label: home
          ? (ar ? 'محادثة صوتية' : 'Voice chat')
          : (ar ? 'صوت' : 'Voice'),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => home && typed ? _send() : widget.onVoice(),
        child: Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: home ? KC.ink : KC.markBg,
            shape: BoxShape.circle,
            boxShadow: home
                ? null
                : const [
                    BoxShadow(
                      color: Color(0x2E000000),
                      blurRadius: 16,
                      offset: Offset(0, 6),
                    ),
                  ],
          ),
          child: Icon(
            home ? Icons.graphic_eq : Icons.volume_up,
            color: home ? Colors.white : KC.markFg,
            size: home ? 28 : 26,
          ),
        ),
      ),
    );

    final box = Container(
      padding: EdgeInsetsDirectional.fromSTEB(
        home ? 10 : 6,
        home ? 8 : 6,
        home ? 8 : 6,
        home ? 8 : 6,
      ),
      decoration: BoxDecoration(
        color: home ? KC.box : KC.grey,
        borderRadius: BorderRadius.circular(999),
        boxShadow: home
            ? const [
                BoxShadow(
                  color: Color(0x1F3C2814),
                  blurRadius: 30,
                  offset: Offset(0, 10),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: ar ? 'إضافة' : 'Add',
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => setState(() => open = !open),
              child: Container(
                width: home ? 40 : 38,
                height: home ? 40 : 38,
                decoration: home
                    ? null
                    : BoxDecoration(
                        color: const Color(0xFFE2E1DF),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFF9A9894),
                          width: 1.5,
                        ),
                      ),
                child: AnimatedRotation(
                  turns: open ? 0.125 : 0,
                  duration: const Duration(milliseconds: 150),
                  child: Icon(
                    Icons.add,
                    color: home ? KC.hint : KC.ink,
                    size: 24,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: text,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _send(),
              textInputAction: TextInputAction.send,
              style: const TextStyle(color: KC.ink, fontSize: 16),
              decoration: InputDecoration(
                isDense: true,
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                hintText: ph,
                hintStyle: const TextStyle(color: KC.hint, fontSize: 16),
              ),
            ),
          ),
          Semantics(
            button: true,
            label: ar ? 'اضغط مطولاً للكلام' : 'Hold to talk',
            child: GestureDetector(
              onLongPressStart: (_) => _holdStart(),
              onLongPressEnd: (_) => _holdEnd(),
              child: SizedBox(
                width: 40,
                height: 40,
                child: Icon(
                  Icons.mic_none,
                  size: 24,
                  color: listening
                      ? const Color(0xFFB4513A)
                      : (home
                            ? const Color(0xFF5E5650)
                            : const Color(0xFF8E8C88)),
                ),
              ),
            ),
          ),
          if (home) ...[const SizedBox(width: 4), black],
        ],
      ),
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        10,
        16,
        MediaQuery.paddingOf(context).bottom + 20,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (open)
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: KC.box,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1F3C2814),
                        blurRadius: 24,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      for (final (icon, label, fn) in widget.plus)
                        ListTile(
                          leading: Icon(icon, color: KC.ink),
                          title: Text(
                            label,
                            style: const TextStyle(color: KC.ink, fontSize: 15),
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          onTap: () {
                            setState(() => open = false);
                            fn();
                          },
                        ),
                    ],
                  ),
                ),
              Row(
                children: [
                  Expanded(child: box),
                  if (!home) ...[const SizedBox(width: 10), black],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
