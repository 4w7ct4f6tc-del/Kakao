import 'app_design.dart';
import 'templates_data.dart';

class AppTemplate {
  final String type;
  final String emoji;
  final Map<String, String> title; // ar / en
  final List<String> keywords;
  final String primary;
  final String secondary;
  final String background;
  final List<String> sections;
  final Map<String, List<String>> categories;
  final List<Map<String, dynamic>> products; // name_ar, name_en, price, emoji, cat

  factory AppTemplate.fromMap(Map<String, Object> m) {
    final cats = m['categories'] as Map;
    return AppTemplate(
      type: m['type'] as String,
      emoji: m['emoji'] as String,
      title: Map<String, String>.from(m['title'] as Map),
      keywords: List<String>.from(m['keywords'] as List),
      primary: m['primary'] as String,
      secondary: m['secondary'] as String,
      background: m['background'] as String,
      sections: List<String>.from(m['sections'] as List),
      categories: {'ar': List<String>.from(cats['ar'] as List), 'en': List<String>.from(cats['en'] as List)},
      products: List<Map<String, dynamic>>.from(m['products'] as List),
    );
  }

  const AppTemplate({
    required this.type,
    required this.emoji,
    required this.title,
    required this.keywords,
    required this.primary,
    required this.secondary,
    required this.background,
    required this.sections,
    required this.categories,
    required this.products,
  });
}

/// Loaded from `templates/NAME/template.json` via `node templates/sync.js`.
final List<AppTemplate> templates = templatesData.map(AppTemplate.fromMap).toList();

AppTemplate templateFor(String type) =>
    templates.firstWhere((t) => t.type == type, orElse: () => templates.first);

/// Color words -> hex (ar + en). Used by local generation and the 3 questions.
const colorWords = <String, String>{
  'أسود': '#111111', 'اسود': '#111111', 'black': '#111111',
  'أبيض': '#FFFFFF', 'ابيض': '#FFFFFF', 'white': '#FFFFFF',
  'أحمر': '#DC2626', 'احمر': '#DC2626', 'red': '#DC2626',
  'أزرق': '#2563EB', 'ازرق': '#2563EB', 'blue': '#2563EB', 'كحلي': '#1E3A8A', 'navy': '#1E3A8A',
  'أخضر': '#16A34A', 'اخضر': '#16A34A', 'green': '#16A34A',
  'أصفر': '#EAB308', 'اصفر': '#EAB308', 'yellow': '#EAB308',
  'ذهبي': '#C9A227', 'gold': '#C9A227', 'golden': '#C9A227',
  'وردي': '#EC4899', 'زهري': '#EC4899', 'pink': '#EC4899',
  'بنفسجي': '#7C3AED', 'purple': '#7C3AED', 'violet': '#7C3AED',
  'برتقالي': '#EA580C', 'orange': '#EA580C',
  'بني': '#7C2D12', 'brown': '#7C2D12',
  'رمادي': '#6B7280', 'gray': '#6B7280', 'grey': '#6B7280',
  'بيج': '#E7D7C1', 'beige': '#E7D7C1',
  'فضي': '#C0C0C0', 'silver': '#C0C0C0',
  'تركوازي': '#14B8A6', 'turquoise': '#14B8A6', 'teal': '#14B8A6',
};

List<String> extractColors(String text) {
  final t = text.toLowerCase();
  final found = <String>[];
  for (final e in colorWords.entries) {
    if (t.contains(e.key) && !found.contains(e.value)) found.add(e.value);
  }
  final hex = RegExp(r'#[0-9a-fA-F]{6}').allMatches(text).map((m) => m.group(0)!.toUpperCase());
  for (final h in hex) {
    if (!found.contains(h)) found.add(h);
  }
  return found;
}

/// Local (offline, instant) intent detection. The server AI refines this when
/// available; this guarantees the builder always produces something.
String detectAppType(String text) {
  final t = text.toLowerCase();
  var best = templates.first;
  var bestScore = 0;
  for (final tpl in templates) {
    final score = tpl.keywords.where((k) => t.contains(k)).length;
    if (score > bestScore) {
      best = tpl;
      bestScore = score;
    }
  }
  return best.type;
}

bool looksLikeAppRequest(String text) {
  final t = text.toLowerCase();
  return RegExp(r'(تطبيق|ابلكيشن|أبلكيشن|موقع|متجر|app|application|website|site|store|shop)').hasMatch(t) &&
      RegExp(r'(أبي|ابي|أبغى|ابغى|أريد|اريد|ودي|سوي|سوّ|اعمل|انشئ|أنشئ|want|need|build|make|create|i\x27d like)').hasMatch(t);
}

bool _isDark(String hex) {
  final c = hexToColor(hex);
  final l = (0.299 * (c.r * 255) + 0.587 * (c.g * 255) + 0.114 * (c.b * 255));
  return l < 140;
}

AppDesign buildLocalDesign({
  required String prompt,
  required String lang,
  String? name,
  String? colorsText,
  String? sellText,
  String? typeOverride,
}) {
  final type = typeOverride ?? detectAppType('$prompt ${sellText ?? ''}');
  final tpl = templateFor(type);
  final l = lang == 'ar' ? 'ar' : 'en';
  final colors = extractColors('${colorsText ?? ''} $prompt');
  var primary = tpl.primary;
  var secondary = tpl.secondary;
  var background = tpl.background;
  if (colors.isNotEmpty) {
    primary = colors.first;
    if (colors.length > 1) secondary = colors[1];
    if (primary == '#FFFFFF') {
      background = '#FFFFFF';
      primary = colors.length > 1 ? colors[1] : '#111111';
      secondary = colors.length > 2 ? colors[2] : tpl.secondary;
    }
  }
  final cats = tpl.categories[l] ?? tpl.categories['en']!;
  var products = <Product>[];
  for (var i = 0; i < tpl.products.length; i++) {
    final p = tpl.products[i];
    products.add(Product(
      id: 'p$i',
      name: p[l] as String,
      price: (p['price'] as num).toDouble(),
      emoji: p['emoji'] as String,
      category: cats[(p['cat'] as int).clamp(0, cats.length - 1)],
    ));
  }
  // "What do you sell": comma / و separated list becomes the product list.
  final sell = (sellText ?? '').trim();
  if (sell.isNotEmpty) {
    final items = sell
        .split(RegExp(r'[,،\n]|\s+و\s*|\s+and\s+'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty && s.length < 40)
        .toList();
    if (items.length >= 2) {
      products = [
        for (var i = 0; i < items.length; i++)
          Product(id: 'u$i', name: items[i], price: 5.0 + i * 2, emoji: tpl.emoji, category: cats[i % cats.length]),
      ];
    }
  }
  final appName = (name ?? '').trim().isNotEmpty ? name!.trim() : tpl.title[l]!;
  return AppDesign(
    id: DateTime.now().millisecondsSinceEpoch.toString(),
    name: appName,
    type: type,
    tagline: l == 'ar' ? 'أهلاً بك في $appName' : 'Welcome to $appName',
    primary: primary,
    secondary: secondary,
    background: background,
    textColor: _isDark(background) ? '#FFFFFF' : '#111111',
    font: l == 'ar' ? 'Cairo' : 'Inter',
    logoEmoji: tpl.emoji,
    language: lang,
    currency: l == 'ar' ? 'BHD' : 'USD',
    sections: tpl.sections,
    categories: cats,
    products: products,
  );
}
