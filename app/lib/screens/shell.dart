import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import '../widgets/kakao_ui.dart';
import 'auth/login_screen.dart';
import 'builder/builder_screen.dart';
import 'settings/settings_screen.dart';
import 'video/video_screen.dart';

/// Login / Builder / Video / Settings in the owner's design: top bar with the round menu, a title, the page.
/// Every tab keeps its state while you switch.
class MainShell extends ConsumerWidget {
  const MainShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(tabProvider);
    const tabs = [LoginTab(), BuilderTab(), VideoTab(), SettingsTab()];
    final ar = ref.watch(languageProvider) == 'ar';
    return KPage(
      tabs: true,
      title: [ar ? 'تسجيل الدخول' : 'Log in', ar ? 'المصنع' : 'Builder', ar ? 'الفيديو' : 'Video', ar ? 'الإعدادات' : 'Settings'][index],
      children: [
        for (var i = 0; i < tabs.length; i++) Visibility(visible: i == index, maintainState: true, child: tabs[i]),
      ],
    );
  }
}
