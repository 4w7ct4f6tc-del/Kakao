import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import '../widgets/kakao_ui.dart';
import 'auth/login_screen.dart';
import 'builder/builder_screen.dart';
import 'settings/settings_screen.dart';
import 'video/video_screen.dart';

/// One screen = one task. Header, 4 tabs (دخول / مصنع / فيديو / إعدادات), the tab, footer.
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
      title: index == 3 ? (ar ? 'الإعدادات' : 'Settings') : null,
      children: [
        for (var i = 0; i < tabs.length; i++) Visibility(visible: i == index, maintainState: true, child: tabs[i]),
      ],
    );
  }
}
