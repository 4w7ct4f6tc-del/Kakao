import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/kakao_ui.dart';

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  String? busy;

  @override
  void initState() {
    super.initState();
    // Plan is authoritative on the server (Stripe/Tap/PayPal webhooks).
    AccountService.profile().then((p) {
      final plan = p['plan']?.toString();
      if (plan != null) ref.read(planProvider.notifier).set(plan);
    }).catchError((_) {});
  }

  Future<void> _pay(String plan, String method) async {
    setState(() => busy = '$plan-$method');
    try {
      await AccountService.checkout(plan, method);
    } catch (e) {
      if (mounted) toast(context, friendlyError(e, ref.read(languageProvider)));
    } finally {
      if (mounted) setState(() => busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    final current = ref.watch(planProvider);
    final ar = ref.watch(languageProvider) == 'ar';
    final plans = [
      ('free', t('free'), ar ? '0' : r'$0', ar
          ? ['دردشة بلا حدود (Meta AI + Claude أساسي)', '3 تطبيقات تجريبية', 'تصاميم أساسية', 'معاينة مباشرة', 'ربط موقع واحد']
          : ['Unlimited chat (Meta AI + basic Claude)', '3 trial apps', 'Basic designs', 'Live preview', '1 site connection']),
      ('pro', t('pro'), ar ? '3.9 د.ب / شهر' : r'$9.99 / mo', ar
          ? ['تطبيقات بلا حدود', 'صوت حقيقي', 'كاميرا ذكية', 'كل الربط', 'دومين خاص', 'نشر فوري', 'ChatGPT كامل']
          : ['Unlimited apps', 'Real voice', 'Smart camera', 'All integrations', 'Custom domain', 'Instant publish', 'Full ChatGPT']),
      ('ultra', t('ultra'), ar ? '9.9 د.ب / شهر' : r'$24.99 / mo', ar
          ? ['كل مزايا برو', 'كل الذكاءات: ChatGPT + Claude Ultra + Gemini Pro', 'أولوية قصوى', 'دومين مشمول', 'قصة إلى فيديو 1080p', 'استنساخ الصوت']
          : ['Everything in Pro', 'All AIs: ChatGPT + Claude Ultra + Gemini Pro', 'Ultra priority', 'Domain included', 'Story to 1080p video', 'Voice clone']),
    ];
    return KPage(children: [
      for (final p in plans)
        KCard(children: [
          Row(children: [
            Expanded(child: Text(p.$2, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900))),
            Text(p.$3, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 8),
          for (final f in p.$4)
            Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [const Icon(Icons.check, size: 16, color: K.green), const SizedBox(width: 6), Expanded(child: Text(f, style: const TextStyle(color: Colors.black87)))])),
          if (current == p.$1)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text('● ${t('currentPlan')}', style: const TextStyle(color: K.green, fontWeight: FontWeight.w800)),
            )
          else if (p.$1 != 'free') ...[
            KBtn('Card • Apple Pay • Google Pay', v: KVariant.green, busy: busy == '${p.$1}-stripe', onTap: () => _pay(p.$1, 'stripe')),
            Row(children: [
              Expanded(child: KBtn('BenefitPay', v: KVariant.grey, busy: busy == '${p.$1}-benefitpay', onTap: () => _pay(p.$1, 'benefitpay'))),
              const SizedBox(width: 10),
              Expanded(child: KBtn('PayPal', v: KVariant.grey, busy: busy == '${p.$1}-paypal', onTap: () => _pay(p.$1, 'paypal'))),
            ]),
          ],
        ]),
    ]);
  }
}
