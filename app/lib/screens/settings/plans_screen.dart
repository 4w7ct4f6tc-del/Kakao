import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../services/account_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

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
      (
        'free',
        t('free'),
        ar ? '0' : '\$0',
        ar
            ? ['دردشة بلا حدود (Meta AI + Claude أساسي)', '3 تطبيقات تجريبية', 'تصاميم أساسية', 'معاينة مباشرة', 'ربط موقع واحد']
            : ['Unlimited chat (Meta AI + basic Claude)', '3 trial apps', 'Basic designs', 'Live preview', '1 site connection'],
      ),
      (
        'pro',
        t('pro'),
        ar ? '3.9 د.ب / شهر' : '\$9.99 / mo',
        ar
            ? ['تطبيقات بلا حدود', 'صوت حقيقي', 'كاميرا ذكية', 'كل الربط', 'دومين خاص', 'نشر فوري', 'ChatGPT كامل']
            : ['Unlimited apps', 'Real voice', 'Smart camera', 'All integrations', 'Custom domain', 'Instant publish', 'Full ChatGPT'],
      ),
      (
        'ultra',
        t('ultra'),
        ar ? '9.9 د.ب / شهر' : '\$24.99 / mo',
        ar
            ? ['كل مزايا برو', 'كل الذكاءات: ChatGPT + Claude Ultra + Gemini Pro', 'أولوية قصوى', 'دومين مشمول', 'قصة إلى فيديو 1080p', 'استنساخ الصوت']
            : ['Everything in Pro', 'All AIs: ChatGPT + Claude Ultra + Gemini Pro', 'Ultra priority', 'Domain included', 'Story to 1080p video', 'Voice clone'],
      ),
    ];
    return Scaffold(
      appBar: AppBar(title: Text(t('plans'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final p in plans)
            Card(
              color: p.$1 == 'ultra' ? Colors.white : KColors.surface,
              margin: const EdgeInsets.symmetric(vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: current == p.$1 ? KColors.accent : Colors.transparent, width: 2),
              ),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(p.$2,
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: p.$1 == 'ultra' ? Colors.black : Colors.white)),
                    const Spacer(),
                    Text(p.$3, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.$1 == 'ultra' ? Colors.black : Colors.white)),
                  ]),
                  const SizedBox(height: 10),
                  for (final f in p.$4)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text('✓ $f', style: TextStyle(color: p.$1 == 'ultra' ? Colors.black87 : Colors.white70)),
                    ),
                  const SizedBox(height: 12),
                  if (current == p.$1)
                    Text('● ${t('currentPlan')}', style: const TextStyle(color: KColors.accent, fontWeight: FontWeight.w800))
                  else if (p.$1 != 'free') ...[
                    BigButton(
                      label: 'Card • Apple Pay • Google Pay',
                      icon: Icons.credit_card,
                      accent: true,
                      loading: busy == '${p.$1}-stripe',
                      onPressed: () => _pay(p.$1, 'stripe'),
                    ),
                    BigButton(label: 'BenefitPay 🇧🇭', loading: busy == '${p.$1}-benefitpay', onPressed: () => _pay(p.$1, 'benefitpay')),
                    BigButton(label: 'PayPal', loading: busy == '${p.$1}-paypal', onPressed: () => _pay(p.$1, 'paypal')),
                  ],
                ]),
              ),
            ),
        ],
      ),
    );
  }
}
