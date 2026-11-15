import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_design.dart';

TextStyle designFont(String font, TextStyle base) {
  try {
    return GoogleFonts.getFont(font, textStyle: base);
  } catch (_) {
    return base;
  }
}

/// Renders any image source used by designs: data URL, http(s), or emoji tile.
class DesignImage extends StatelessWidget {
  final String src;
  final String emoji;
  final Color tint;
  final double? height;
  final double radius;
  const DesignImage({super.key, required this.src, required this.emoji, required this.tint, this.height, this.radius = 14});

  @override
  Widget build(BuildContext context) {
    Widget fallback() => Container(
          height: height,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(colors: [tint.withValues(alpha: 0.18), tint.withValues(alpha: 0.38)]),
          ),
          child: Text(emoji, style: TextStyle(fontSize: (height ?? 90) * 0.42)),
        );
    if (src.startsWith('data:')) {
      final b64 = src.substring(src.indexOf(',') + 1);
      return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Image.memory(base64Decode(b64), height: height, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallback()),
      );
    }
    if (src.startsWith('http')) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Image.network(src, height: height, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallback()),
      );
    }
    return fallback();
  }
}

/// Phone frame wrapper.
class PhoneFrame extends StatelessWidget {
  final Widget child;
  final double width;
  const PhoneFrame({super.key, required this.child, this.width = 320});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: width * 2.05,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(46),
        border: Border.all(color: const Color(0xFF3A3A3A), width: 2),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 30, offset: Offset(0, 12))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(36),
        child: Stack(
          children: [
            Positioned.fill(child: child),
            Align(
              alignment: Alignment.topCenter,
              child: Container(
                margin: const EdgeInsets.only(top: 8),
                width: width * 0.32,
                height: 24,
                decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A real, clickable mini app rendered from the JSON design:
/// Home, Products (+search, categories), Cart, Booking, Contact,
/// WhatsApp order, Instagram link, Map, Reviews and an Admin panel.
class LivePreviewApp extends StatefulWidget {
  final AppDesign design;
  final ValueChanged<AppDesign>? onChanged;
  const LivePreviewApp({super.key, required this.design, this.onChanged});

  @override
  State<LivePreviewApp> createState() => _LivePreviewAppState();
}

class _LivePreviewAppState extends State<LivePreviewApp> {
  int tab = 0;
  final Map<String, int> cart = {};
  String query = '';
  String? category;
  DateTime? bookingDate;
  String? bookingSlot;

  AppDesign get d => widget.design;
  bool get ar => d.language == 'ar' || d.language == 'fa' || d.language == 'ur';
  String tr(String arText, String enText) => ar ? arText : enText;

  String money(double v) => '${v % 1 == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(v < 10 ? 3 : 2)} ${d.currency}';

  double get total => cart.entries.fold(0, (s, e) {
        final p = d.products.where((p) => p.id == e.key);
        return p.isEmpty ? s : s + p.first.price * e.value;
      });

  void _add(Product p) => setState(() => cart[p.id] = (cart[p.id] ?? 0) + 1);

  Future<void> _open(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  String get _waNumber => d.contact.whatsapp.replaceAll(RegExp(r'[^0-9]'), '');

  void _orderWhatsApp() {
    final lines = cart.entries.map((e) {
      final p = d.products.firstWhere((p) => p.id == e.key);
      return '• ${p.name} x${e.value} = ${money(p.price * e.value)}';
    }).join('\n');
    final msg = '${tr('طلب جديد من', 'New order from')} ${d.name}\n$lines\n${tr('المجموع', 'Total')}: ${money(total)}';
    _open('https://wa.me/$_waNumber?text=${Uri.encodeComponent(msg)}');
  }

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(color: d.textColorValue);
    return Theme(
      data: ThemeData(
        brightness: ThemeData.estimateBrightnessForColor(d.backgroundColor),
        colorScheme: ColorScheme.fromSeed(
          seedColor: d.primaryColor,
          primary: d.primaryColor,
          secondary: d.secondaryColor,
          brightness: ThemeData.estimateBrightnessForColor(d.backgroundColor),
        ),
        scaffoldBackgroundColor: d.backgroundColor,
        textTheme: TextTheme(bodyMedium: designFont(d.font, base)),
      ),
      child: Directionality(
        textDirection: ar ? TextDirection.rtl : TextDirection.ltr,
        child: DefaultTextStyle(
          style: designFont(d.font, base.copyWith(fontSize: 13)),
          child: Scaffold(
            backgroundColor: d.backgroundColor,
            body: Column(
              children: [
                _topBar(),
                Expanded(child: _page()),
              ],
            ),
            bottomNavigationBar: _bottomNav(),
          ),
        ),
      ),
    );
  }

  Widget _topBar() => Container(
        padding: const EdgeInsets.fromLTRB(14, 38, 14, 10),
        color: d.primaryColor,
        child: Row(
          children: [
            Text(d.logoEmoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(d.name,
                  overflow: TextOverflow.ellipsis,
                  style: designFont(d.font, const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
            ),
            if (widget.onChanged != null)
              InkWell(onTap: _admin, child: const Icon(Icons.admin_panel_settings_outlined, color: Colors.white, size: 20)),
            const SizedBox(width: 10),
            InkWell(
              onTap: () => setState(() => tab = 2),
              child: Badge(
                isLabelVisible: cart.isNotEmpty,
                label: Text('${cart.values.fold(0, (a, b) => a + b)}'),
                child: const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      );

  Widget _bottomNav() {
    final items = [
      (Icons.home_outlined, tr('الرئيسية', 'Home')),
      (Icons.grid_view, tr('المنتجات', 'Products')),
      (Icons.shopping_cart_outlined, tr('السلة', 'Cart')),
      (Icons.event_available, tr('حجز', 'Booking')),
      (Icons.call_outlined, tr('تواصل', 'Contact')),
    ];
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(top: 6, bottom: 10),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++)
            Expanded(
              child: InkWell(
                onTap: () => setState(() => tab = i),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(items[i].$1, size: 20, color: tab == i ? d.primaryColor : Colors.black45),
                    Text(items[i].$2, style: TextStyle(fontSize: 9, color: tab == i ? d.primaryColor : Colors.black45)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _page() {
    switch (tab) {
      case 1:
        return _productsPage();
      case 2:
        return _cartPage();
      case 3:
        return _bookingPage();
      case 4:
        return _contactPage();
      default:
        return _homePage();
    }
  }

  Widget _sectionTitle(String s) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 8),
        child: Text(s, style: designFont(d.font, TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: d.textColorValue))),
      );

  Widget _homePage() {
    final children = <Widget>[];
    for (final s in d.sections) {
      switch (s) {
        case 'hero':
          children.add(Padding(
            padding: const EdgeInsets.all(14),
            child: Stack(
              children: [
                DesignImage(src: d.heroImage, emoji: d.logoEmoji, tint: d.secondaryColor, height: 140, radius: 18),
                Positioned.fill(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    alignment: AlignmentDirectional.bottomStart,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.55)]),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(d.tagline, style: designFont(d.font, const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
                        const SizedBox(height: 6),
                        InkWell(
                          onTap: () => setState(() => tab = 1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(color: d.secondaryColor, borderRadius: BorderRadius.circular(20)),
                            child: Text(tr('تسوق الآن', 'Shop now'), style: const TextStyle(color: Colors.white, fontSize: 11)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ));
        case 'categories':
          if (d.categories.isEmpty) break;
          children.add(SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              children: [
                for (final c in d.categories)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: InkWell(
                      onTap: () => setState(() {
                        category = c;
                        tab = 1;
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(color: d.primaryColor.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(20)),
                        child: Text(c, style: TextStyle(color: d.primaryColor, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ),
              ],
            ),
          ));
        case 'products':
          children.add(_sectionTitle(tr('الأكثر طلباً', 'Popular')));
          children.add(_grid(d.products.take(4).toList()));
        case 'offers':
          children.add(Container(
            margin: const EdgeInsets.all(14),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: d.secondaryColor, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              const Text('🔥', style: TextStyle(fontSize: 24)),
              const SizedBox(width: 10),
              Expanded(child: Text(tr('خصم 20% على أول طلب', '20% off your first order'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
            ]),
          ));
        case 'booking':
          children.add(Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: _cta(Icons.event_available, tr('احجز موعدك', 'Book an appointment'), () => setState(() => tab = 3)),
          ));
        case 'reviews':
          children.add(_sectionTitle(tr('آراء العملاء', 'Reviews')));
          children.add(_reviews());
        case 'map':
          children.add(_sectionTitle(tr('موقعنا', 'Find us')));
          children.add(_map());
        case 'contact':
          children.add(Padding(padding: const EdgeInsets.all(14), child: _contactButtons()));
        case 'about':
          children.add(_sectionTitle(tr('من نحن', 'About us')));
          children.add(Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Text(tr('${d.name} — جودة وخدمة سريعة.', '${d.name} — quality and fast service.')),
          ));
      }
    }
    children.add(const SizedBox(height: 20));
    return ListView(padding: EdgeInsets.zero, children: children);
  }

  Widget _cta(IconData icon, String label, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: d.primaryColor.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            Icon(icon, color: d.primaryColor, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
            Icon(ar ? Icons.chevron_left : Icons.chevron_right, color: d.primaryColor),
          ]),
        ),
      );

  Widget _grid(List<Product> list) {
    if (list.isEmpty) return Padding(padding: const EdgeInsets.all(20), child: Center(child: Text(tr('لا يوجد منتجات', 'No products'))));
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.72),
      itemCount: list.length,
      itemBuilder: (_, i) {
        final p = list[i];
        return Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6)]),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: DesignImage(src: p.image, emoji: p.emoji, tint: d.primaryColor)),
              const SizedBox(height: 6),
              Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.w700, fontSize: 12)),
              Row(
                children: [
                  Expanded(child: Text(money(p.price), style: TextStyle(color: d.primaryColor, fontWeight: FontWeight.w800, fontSize: 11))),
                  InkWell(
                    onTap: () => _add(p),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: d.primaryColor, borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.add, color: Colors.white, size: 16),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _productsPage() {
    final list = d.products.where((p) {
      final okCat = category == null || p.category == category;
      final okQ = query.isEmpty || p.name.toLowerCase().contains(query.toLowerCase());
      return okCat && okQ;
    }).toList();
    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        Padding(
          padding: const EdgeInsets.all(14),
          child: TextField(
            onChanged: (v) => setState(() => query = v),
            style: const TextStyle(color: Colors.black87, fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: Colors.black.withValues(alpha: 0.05),
              prefixIcon: const Icon(Icons.search, size: 18, color: Colors.black45),
              hintText: tr('ابحث…', 'Search…'),
              hintStyle: const TextStyle(color: Colors.black38),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            ),
          ),
        ),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            children: [
              for (final c in [null, ...d.categories])
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 6),
                  child: ChoiceChip(
                    visualDensity: VisualDensity.compact,
                    label: Text(c ?? tr('الكل', 'All'), style: const TextStyle(fontSize: 11)),
                    selected: category == c,
                    onSelected: (_) => setState(() => category = c),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _grid(list),
      ],
    );
  }

  Widget _cartPage() {
    if (cart.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('🛒', style: TextStyle(fontSize: 48)),
        Text(tr('السلة فاضية', 'Your cart is empty')),
      ]));
    }
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(14),
            children: [
              for (final e in cart.entries)
                Builder(builder: (_) {
                  final p = d.products.firstWhere((p) => p.id == e.key, orElse: () => const Product(id: '-', name: '-', price: 0));
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: SizedBox(width: 44, height: 44, child: DesignImage(src: p.image, emoji: p.emoji, tint: d.primaryColor, radius: 10)),
                    title: Text(p.name, style: const TextStyle(fontSize: 13)),
                    subtitle: Text(money(p.price * e.value), style: TextStyle(color: d.primaryColor, fontSize: 12)),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.remove_circle_outline, size: 18),
                        onPressed: () => setState(() {
                          if (e.value <= 1) {
                            cart.remove(e.key);
                          } else {
                            cart[e.key] = e.value - 1;
                          }
                        }),
                      ),
                      Text('${e.value}'),
                      IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.add_circle_outline, size: 18), onPressed: () => _add(p)),
                    ]),
                  );
                }),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            Row(children: [
              Text(tr('المجموع', 'Total'), style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(money(total), style: TextStyle(fontWeight: FontWeight.w800, color: d.primaryColor)),
            ]),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                onPressed: _orderWhatsApp,
                icon: const Icon(Icons.chat, size: 16),
                label: Text(tr('اطلب عبر واتساب', 'Order on WhatsApp')),
              ),
            ),
          ]),
        ),
      ],
    );
  }

  Widget _bookingPage() {
    final slots = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    final days = List.generate(7, (i) => DateTime.now().add(Duration(days: i)));
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Text(tr('اختر اليوم', 'Pick a day'), style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        SizedBox(
          height: 60,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final day in days)
                InkWell(
                  onTap: () => setState(() => bookingDate = day),
                  child: Container(
                    width: 48,
                    margin: const EdgeInsetsDirectional.only(end: 6),
                    decoration: BoxDecoration(
                      color: bookingDate?.day == day.day ? d.primaryColor : d.primaryColor.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: Text('${day.day}/${day.month}',
                        style: TextStyle(color: bookingDate?.day == day.day ? Colors.white : d.primaryColor, fontWeight: FontWeight.w700, fontSize: 11)),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Text(tr('اختر الوقت', 'Pick a time'), style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final s in slots)
            ChoiceChip(label: Text(s, style: const TextStyle(fontSize: 11)), selected: bookingSlot == s, onSelected: (_) => setState(() => bookingSlot = s)),
        ]),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: d.primaryColor),
          onPressed: bookingDate == null || bookingSlot == null
              ? null
              : () => _open('https://wa.me/$_waNumber?text=${Uri.encodeComponent('${tr('حجز موعد', 'Booking')}: ${bookingDate!.day}/${bookingDate!.month} $bookingSlot — ${d.name}')}'),
          child: Text(tr('أكّد الحجز', 'Confirm booking')),
        ),
      ],
    );
  }

  Widget _contactPage() => ListView(
        padding: const EdgeInsets.all(14),
        children: [
          _contactButtons(),
          const SizedBox(height: 14),
          _map(),
          const SizedBox(height: 14),
          _reviews(),
        ],
      );

  Widget _contactButtons() {
    final c = d.contact;
    return Column(children: [
      _cta(Icons.chat, '${tr('واتساب', 'WhatsApp')} ${c.whatsapp}', () => _open('https://wa.me/$_waNumber')),
      const SizedBox(height: 8),
      _cta(Icons.camera_alt_outlined, '${tr('انستغرام', 'Instagram')} @${c.instagram.replaceAll('@', '')}',
          () => _open('https://instagram.com/${c.instagram.replaceAll('@', '')}')),
      if (c.phone.isNotEmpty) ...[
        const SizedBox(height: 8),
        _cta(Icons.call, c.phone, () => _open('tel:${c.phone}')),
      ],
    ]);
  }

  Widget _map() => InkWell(
        onTap: () => _open('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(d.contact.address.isEmpty ? d.name : d.contact.address)}'),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 14),
          height: 90,
          decoration: BoxDecoration(color: d.primaryColor.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14)),
          child: Center(child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.location_on, color: d.primaryColor),
            const SizedBox(width: 6),
            Text(d.contact.address.isEmpty ? tr('افتح الخريطة', 'Open map') : d.contact.address),
          ])),
        ),
      );

  Widget _reviews() {
    final reviews = ar
        ? [('سارة', 'خدمة ممتازة وتوصيل سريع'), ('محمد', 'الجودة رهيبة'), ('فاطمة', 'أنصح فيه بقوة')]
        : [('Sara', 'Great service and fast delivery'), ('Ali', 'Amazing quality'), ('Mona', 'Highly recommended')];
    return SizedBox(
      height: 84,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        children: [
          for (final r in reviews)
            Container(
              width: 170,
              margin: const EdgeInsetsDirectional.only(end: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)]),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('⭐⭐⭐⭐⭐ ${r.$1}', style: const TextStyle(color: Colors.black87, fontSize: 11, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(r.$2, style: const TextStyle(color: Colors.black54, fontSize: 11)),
              ]),
            ),
        ],
      ),
    );
  }

  /// Admin panel inside the generated app: add products.
  void _admin() {
    final name = TextEditingController();
    final price = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr('لوحة الإدارة — منتج جديد', 'Admin — new product')),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: InputDecoration(labelText: tr('الاسم', 'Name'))),
          TextField(controller: price, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr('السعر', 'Price'))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(tr('إلغاء', 'Cancel'))),
          FilledButton(
            onPressed: () {
              if (name.text.trim().isEmpty) return;
              final p = Product(
                id: 'a${DateTime.now().millisecondsSinceEpoch}',
                name: name.text.trim(),
                price: double.tryParse(price.text) ?? 0,
                emoji: d.logoEmoji,
                category: d.categories.isEmpty ? '' : d.categories.first,
              );
              widget.onChanged?.call(d.copyWith(products: [...d.products, p]));
              Navigator.pop(ctx);
            },
            child: Text(tr('إضافة', 'Add')),
          ),
        ],
      ),
    );
  }
}
