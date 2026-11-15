import 'package:firebase_core/firebase_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/branding.dart';
import 'core/config.dart';
import 'core/i18n.dart';
import 'core/theme.dart';
import 'firebase_options.dart';
import 'screens/lock_screen.dart';
import 'screens/home_screen.dart';
import 'state/providers.dart';
import 'widgets/kakao_ui.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  prefs = await SharedPreferences.getInstance();
  if (!DefaultFirebaseOptions.isPlaceholder) {
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      AppConfig.firebaseReady = true;
    } catch (e) {
      debugPrint('Firebase init failed, running offline: $e');
    }
  }
  final lang = prefs.getString('lang') ?? I18n.deviceLanguage();
  await I18n.ensureLoaded(lang);
  runApp(const ProviderScope(child: KakaoApp()));
}

class KakaoApp extends ConsumerWidget {
  const KakaoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final dark = ref.watch(appearanceProvider) == 'dark';
    KT.dark = dark;
    return MaterialApp(
      key: ValueKey('appearance-$dark'),
      title: Brand.name(lang),
      debugShowCheckedModeBanner: false,
      theme: buildTheme(lang, dark: dark),
      builder: (context, child) => Directionality(
        textDirection: I18n.isRtl(lang) ? TextDirection.rtl : TextDirection.ltr,
        child: child!,
      ),
      home: const RootGate(),
    );
  }
}

/// Decides: login -> (biometric lock) -> main shell.
class RootGate extends ConsumerStatefulWidget {
  const RootGate({super.key});

  @override
  ConsumerState<RootGate> createState() => _RootGateState();
}

class _RootGateState extends ConsumerState<RootGate> {
  bool unlocked = false;
  bool tabChosen = false;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final bioLock = ref.watch(bioLockProvider);
    return auth.when(
      loading: () => Scaffold(backgroundColor: KT.bg, body: const Center(child: CircularProgressIndicator())),
      error: (_, _) => const HomeScreen(),
      data: (user) {
        // Open on دخول when signed out, on مصنع when signed in.
        if (!tabChosen) {
          tabChosen = true;
          WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(tabProvider.notifier).set(user == null ? 0 : 1));
        }
        if (user != null && bioLock && !unlocked) {
          return LockScreen(onUnlocked: () => setState(() => unlocked = true));
        }
        return const HomeScreen();
      },
    );
  }
}
