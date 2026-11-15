import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

/// Smart recovery questions — answers are normalized and bcrypt-hashed on the server.
class QuestionsScreen extends ConsumerStatefulWidget {
  const QuestionsScreen({super.key});

  @override
  ConsumerState<QuestionsScreen> createState() => _QuestionsScreenState();
}

class _QuestionsScreenState extends ConsumerState<QuestionsScreen> {
  late final List<TextEditingController> qs;
  final as = List.generate(3, (_) => TextEditingController());
  bool busy = false;

  @override
  void initState() {
    super.initState();
    final ar = ref.read(languageProvider) == 'ar';
    final defaults = ar
        ? ['شنو اسم أول مدرسة درست فيها؟', 'شنو أكلتك المفضلة وأنت صغير؟', 'شنو اسم أقرب صديق لك؟']
        : ['What was the name of your first school?', 'What was your favourite food as a kid?', 'What is the name of your closest friend?'];
    qs = defaults.map((q) => TextEditingController(text: q)).toList();
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      await AccountService.setQuestions(qs.map((c) => c.text).toList(), as.map((c) => c.text).toList());
      if (mounted) {
        toast(context, ref.read(tProvider)('saved'));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return KPage(children: [
      KCard(children: [
        Text(t('smartQuestions'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(t('questionsSetup'), style: const TextStyle(color: Colors.black54)),
        for (var i = 0; i < 3; i++) ...[
          const SizedBox(height: 8),
          KInput(qs[i], '${i + 1}'),
          KInput(as[i], t('answer'), obscure: true),
        ],
        KBtn(t('save'), v: KVariant.green, busy: busy, onTap: _save),
      ]),
    ]);
  }
}
