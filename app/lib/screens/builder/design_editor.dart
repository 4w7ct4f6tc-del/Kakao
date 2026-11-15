import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../models/app_design.dart';
import '../../services/builder_service.dart';
import '../../services/vision_service.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'phone_preview.dart';

const _palette = [
  '#111111', '#FFFFFF', '#DC2626', '#E11D48', '#EC4899', '#7C3AED', '#2563EB', '#1E3A8A',
  '#0EA5E9', '#14B8A6', '#16A34A', '#84CC16', '#EAB308', '#C9A227', '#EA580C', '#7C2D12',
  '#6B7280', '#E7D7C1', '#FDF2F8', '#FFFBEB', '#F0FDF4', '#EFF6FF', '#0F172A', '#18181B',
];

const _fonts = ['Cairo', 'Tajawal', 'Almarai', 'Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Lato'];

/// Every change calls [onChanged] -> the phone preview updates instantly.
class DesignEditor extends ConsumerStatefulWidget {
  final AppDesign design;
  final ValueChanged<AppDesign> onChanged;
  const DesignEditor({super.key, required this.design, required this.onChanged});

  @override
  ConsumerState<DesignEditor> createState() => _DesignEditorState();
}

class _DesignEditorState extends ConsumerState<DesignEditor> {
  String? busyImage;

  AppDesign get d => widget.design;
  void set(AppDesign n) => widget.onChanged(n);

  bool get paid => ref.read(planProvider) != 'free';

  Future<void> _pickImage(void Function(String url) apply) async {
    final f = await VisionService.pick(camera: false);
    if (f == null) return;
    setState(() => busyImage = 'upload');
    final url = await BuilderService.uploadImage(await f.readAsBytes(), 'image/jpeg');
    setState(() => busyImage = null);
    if (url != null) apply(url);
  }

  Future<void> _aiImage(String prompt, void Function(String url) apply, String key) async {
    setState(() => busyImage = key);
    final url = await BuilderService.aiImage(prompt);
    setState(() => busyImage = null);
    if (url != null) {
      apply(url);
    } else if (mounted) {
      toast(context, friendlyError('not_configured', ref.read(languageProvider)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tProvider);
    return DefaultTabController(
      length: 5,
      child: Column(
        children: [
          TabBar(
            isScrollable: true,
            indicatorColor: KColors.accent,
            tabs: [
              Tab(text: t('colors')),
              Tab(text: t('font')),
              Tab(text: t('images')),
              Tab(text: t('sections')),
              Tab(text: t('products')),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [_colors(t), _fontTab(), _images(t), _sections(t), _products(t)],
            ),
          ),
        ],
      ),
    );
  }

  Widget _swatches(String label, String current, ValueChanged<String> onPick) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in _palette)
                GestureDetector(
                  onTap: () => onPick(c),
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: hexToColor(c),
                      shape: BoxShape.circle,
                      border: Border.all(color: current.toUpperCase() == c ? KColors.accent : Colors.white24, width: current.toUpperCase() == c ? 3 : 1),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      );

  Widget _colors(String Function(String) t) {
    final ar = ref.watch(languageProvider) == 'ar';
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextFormField(
          key: ValueKey('name-${d.id}'),
          initialValue: d.name,
          decoration: InputDecoration(labelText: t('name')),
          onChanged: (v) => set(d.copyWith(name: v)),
        ),
        const SizedBox(height: 12),
        TextFormField(
          key: ValueKey('tag-${d.id}'),
          initialValue: d.tagline,
          decoration: const InputDecoration(labelText: 'Tagline'),
          onChanged: (v) => set(d.copyWith(tagline: v)),
        ),
        const SizedBox(height: 16),
        _swatches(ar ? 'اللون الأساسي' : 'Main color', d.primary, (c) => set(d.copyWith(primary: c))),
        _swatches(ar ? 'اللون الثانوي' : 'Accent color', d.secondary, (c) => set(d.copyWith(secondary: c))),
        _swatches(ar ? 'الخلفية' : 'Background', d.background, (c) {
          final dark = ThemeData.estimateBrightnessForColor(hexToColor(c)) == Brightness.dark;
          set(d.copyWith(background: c, textColor: dark ? '#FFFFFF' : '#111111'));
        }),
      ],
    );
  }

  Widget _fontTab() => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final f in _fonts)
            ListTile(
              onTap: () => set(d.copyWith(font: f)),
              leading: Icon(d.font == f ? Icons.radio_button_checked : Icons.radio_button_off, color: KColors.accent),
              title: Text('$f — Aa', style: designFont(f, const TextStyle(color: Colors.white))),
            ),
        ],
      );

  Widget _images(String Function(String) t) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Hero', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: BigButton(
                label: t('upload'),
                icon: Icons.upload,
                loading: busyImage == 'upload',
                onPressed: () => _pickImage((u) => set(d.copyWith(heroImage: u))),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: BigButton(
                label: t('aiImage'),
                icon: Icons.auto_awesome,
                loading: busyImage == 'hero',
                onPressed: () => _aiImage('Professional banner photo for a ${d.type} called ${d.name}, colors ${d.primary} ${d.secondary}, no text',
                    (u) => set(d.copyWith(heroImage: u)), 'hero'),
              ),
            ),
          ]),
          const SizedBox(height: 16),
          Text(t('products'), style: const TextStyle(fontWeight: FontWeight.w700)),
          for (final p in d.products)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Text(p.emoji, style: const TextStyle(fontSize: 26)),
              title: Text(p.name),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(
                  icon: const Icon(Icons.upload),
                  onPressed: () => _pickImage((u) => set(d.copyWith(products: [for (final x in d.products) x.id == p.id ? x.copyWith(image: u) : x]))),
                ),
                busyImage == p.id
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                    : IconButton(
                        icon: const Icon(Icons.auto_awesome),
                        onPressed: () => _aiImage('Product photo of ${p.name}, studio lighting, white background',
                            (u) => set(d.copyWith(products: [for (final x in d.products) x.id == p.id ? x.copyWith(image: u) : x])), p.id),
                      ),
              ]),
            ),
        ],
      );

  Widget _sections(String Function(String) t) {
    final ar = ref.watch(languageProvider) == 'ar';
    final names = {
      'hero': ar ? 'الواجهة' : 'Hero banner',
      'categories': ar ? 'الأقسام' : 'Categories',
      'products': ar ? 'المنتجات' : 'Products',
      'offers': ar ? 'العروض' : 'Offers',
      'booking': ar ? 'الحجز' : 'Booking',
      'reviews': ar ? 'التقييمات' : 'Reviews',
      'map': ar ? 'الخريطة' : 'Map',
      'contact': ar ? 'التواصل' : 'Contact',
      'about': ar ? 'من نحن' : 'About',
    };
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final s in allSections)
          SwitchListTile(
            value: d.sections.contains(s),
            activeThumbColor: KColors.accent,
            title: Text(names[s] ?? s),
            onChanged: (on) {
              final list = allSections.where((x) => x == s ? on : d.sections.contains(x)).toList();
              set(d.copyWith(sections: list));
            },
          ),
      ],
    );
  }

  Widget _products(String Function(String) t) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final p in d.products)
            Card(
              color: KColors.surface,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(children: [
                  Text(p.emoji, style: const TextStyle(fontSize: 26)),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      key: ValueKey('pn-${p.id}'),
                      initialValue: p.name,
                      decoration: InputDecoration(labelText: t('name'), isDense: true),
                      onChanged: (v) => set(d.copyWith(products: [for (final x in d.products) x.id == p.id ? x.copyWith(name: v) : x])),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      key: ValueKey('pp-${p.id}'),
                      initialValue: p.price.toString(),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(labelText: t('price'), isDense: true),
                      onChanged: (v) => set(d.copyWith(
                          products: [for (final x in d.products) x.id == p.id ? x.copyWith(price: double.tryParse(v) ?? x.price) : x])),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => set(d.copyWith(products: d.products.where((x) => x.id != p.id).toList())),
                  ),
                ]),
              ),
            ),
          BigButton(
            label: t('addProduct'),
            icon: Icons.add,
            onPressed: () => set(d.copyWith(products: [
              ...d.products,
              Product(
                id: 'n${DateTime.now().millisecondsSinceEpoch}',
                name: t('addProduct'),
                price: 1,
                emoji: d.logoEmoji,
                category: d.categories.isEmpty ? '' : d.categories.first,
              ),
            ])),
          ),
        ],
      );
}
