import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import '../widgets/kakao_frame.dart';
import 'builder/builder_screen.dart';
import 'camera/camera_screen.dart';
import 'talk/discuss_screen.dart';

/// Home: the owner's exact design — round menu, KAkAo, black K, "What is your idea?", one box.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ar = ref.watch(languageProvider) == 'ar';
    void build(String p) => Navigator.push(context, MaterialPageRoute(builder: (_) => BuilderScreen(prompt: p)));
    return Scaffold(
      backgroundColor: KC.bg,
      drawer: const KMenu(),
      appBar: const KTopBar(),
      body: Column(children: [
        Expanded(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const KMark(size: 128, font: 82),
                const SizedBox(height: 22),
                Text(kName(ar), style: kSerif(ar, 64)),
                const SizedBox(height: 10),
                const Text('B.K.A Famy', style: TextStyle(color: KC.brand, fontSize: 19)),
                const SizedBox(height: 20),
                Text(
                  ar ? 'شنو فكرتك؟\nاكتبها، وأنا أبنيها لك.' : 'What is your idea?\nWrite it, I will build it for you.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: KC.text, fontSize: 14, height: 1.65),
                ),
              ]),
            ),
          ),
        ),
        KBottomBox(
          home: true,
          onSend: build,
          onVoice: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DiscussScreen())),
          plus: [
            (Icons.photo_camera_outlined, ar ? 'الكاميرا' : 'Camera', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CameraScreen()))),
            (Icons.dashboard_outlined, ar ? 'القوالب' : 'Templates', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BuilderScreen()))),
            (Icons.movie_outlined, ar ? 'قصة إلى فيديو' : 'Story to video', () => kGo(context, ref, 'video')),
          ],
        ),
      ]),
    );
  }
}
