import 'app_design.dart';

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

const templates = <AppTemplate>[
  AppTemplate(
    type: 'clothes',
    emoji: '👗',
    title: {'ar': 'محل ملابس', 'en': 'Clothes Shop'},
    keywords: ['ملابس', 'أزياء', 'ازياء', 'فساتين', 'عبايات', 'clothes', 'fashion', 'boutique', 'dress', 'abaya', 'shirt', 'بوتيك', 'كندورة', 'ثياب'],
    primary: '#111111', secondary: '#E11D48', background: '#FFFFFF',
    sections: ['hero', 'categories', 'products', 'offers', 'reviews', 'map', 'contact'],
    categories: {'ar': ['نسائي', 'رجالي', 'أطفال', 'عبايات'], 'en': ['Women', 'Men', 'Kids', 'Abayas']},
    products: [
      {'ar': 'فستان سهرة', 'en': 'Evening Dress', 'price': 35, 'emoji': '👗', 'cat': 0},
      {'ar': 'عباية سوداء', 'en': 'Black Abaya', 'price': 28, 'emoji': '🧥', 'cat': 3},
      {'ar': 'قميص رجالي', 'en': "Men's Shirt", 'price': 12, 'emoji': '👔', 'cat': 1},
      {'ar': 'تيشيرت أطفال', 'en': 'Kids T-Shirt', 'price': 6, 'emoji': '👕', 'cat': 2},
      {'ar': 'حذاء رياضي', 'en': 'Sneakers', 'price': 22, 'emoji': '👟', 'cat': 1},
      {'ar': 'شنطة يد', 'en': 'Handbag', 'price': 18, 'emoji': '👜', 'cat': 0},
    ],
  ),
  AppTemplate(
    type: 'restaurant',
    emoji: '🍔',
    title: {'ar': 'مطعم', 'en': 'Restaurant'},
    keywords: ['مطعم', 'منيو', 'قائمة طعام', 'أكل', 'اكل', 'كافيه', 'مقهى', 'قهوة', 'restaurant', 'menu', 'food', 'cafe', 'coffee', 'burger', 'pizza', 'مشويات'],
    primary: '#7C2D12', secondary: '#F59E0B', background: '#FFFBEB',
    sections: ['hero', 'categories', 'products', 'offers', 'booking', 'reviews', 'map', 'contact'],
    categories: {'ar': ['مقبلات', 'رئيسي', 'حلويات', 'مشروبات'], 'en': ['Starters', 'Mains', 'Desserts', 'Drinks']},
    products: [
      {'ar': 'برجر لحم', 'en': 'Beef Burger', 'price': 3.5, 'emoji': '🍔', 'cat': 1},
      {'ar': 'بيتزا', 'en': 'Pizza', 'price': 4.2, 'emoji': '🍕', 'cat': 1},
      {'ar': 'سلطة', 'en': 'Salad', 'price': 1.8, 'emoji': '🥗', 'cat': 0},
      {'ar': 'كنافة', 'en': 'Kunafa', 'price': 2.0, 'emoji': '🍰', 'cat': 2},
      {'ar': 'كرك', 'en': 'Karak Tea', 'price': 0.3, 'emoji': '☕', 'cat': 3},
      {'ar': 'عصير طازج', 'en': 'Fresh Juice', 'price': 1.2, 'emoji': '🥤', 'cat': 3},
    ],
  ),
  AppTemplate(
    type: 'grocery',
    emoji: '🛒',
    title: {'ar': 'بقالة', 'en': 'Grocery'},
    keywords: ['بقالة', 'سوبرماركت', 'خضار', 'فواكه', 'grocery', 'supermarket', 'market', 'vegetables', 'fruits'],
    primary: '#166534', secondary: '#84CC16', background: '#F7FEE7',
    sections: ['hero', 'categories', 'products', 'offers', 'map', 'contact'],
    categories: {'ar': ['خضار', 'فواكه', 'ألبان', 'مخبوزات'], 'en': ['Vegetables', 'Fruits', 'Dairy', 'Bakery']},
    products: [
      {'ar': 'طماط', 'en': 'Tomatoes', 'price': 0.6, 'emoji': '🍅', 'cat': 0},
      {'ar': 'تفاح', 'en': 'Apples', 'price': 0.9, 'emoji': '🍎', 'cat': 1},
      {'ar': 'حليب', 'en': 'Milk', 'price': 0.5, 'emoji': '🥛', 'cat': 2},
      {'ar': 'خبز', 'en': 'Bread', 'price': 0.2, 'emoji': '🍞', 'cat': 3},
    ],
  ),
  AppTemplate(
    type: 'salon',
    emoji: '💇',
    title: {'ar': 'صالون', 'en': 'Salon'},
    keywords: ['صالون', 'حلاق', 'تجميل', 'سبا', 'مكياج', 'salon', 'barber', 'beauty', 'spa', 'makeup', 'nails'],
    primary: '#831843', secondary: '#F472B6', background: '#FDF2F8',
    sections: ['hero', 'products', 'booking', 'reviews', 'map', 'contact'],
    categories: {'ar': ['شعر', 'أظافر', 'مكياج'], 'en': ['Hair', 'Nails', 'Makeup']},
    products: [
      {'ar': 'قص شعر', 'en': 'Haircut', 'price': 5, 'emoji': '💇', 'cat': 0},
      {'ar': 'صبغة', 'en': 'Hair Color', 'price': 20, 'emoji': '🎨', 'cat': 0},
      {'ar': 'مناكير', 'en': 'Manicure', 'price': 8, 'emoji': '💅', 'cat': 1},
      {'ar': 'مكياج سهرة', 'en': 'Evening Makeup', 'price': 25, 'emoji': '💄', 'cat': 2},
    ],
  ),
  AppTemplate(
    type: 'school',
    emoji: '🏫',
    title: {'ar': 'مدرسة / معهد', 'en': 'School'},
    keywords: ['مدرسة', 'معهد', 'دورات', 'تعليم', 'دروس', 'school', 'academy', 'courses', 'education', 'tutor', 'training'],
    primary: '#1E3A8A', secondary: '#FBBF24', background: '#EFF6FF',
    sections: ['hero', 'categories', 'products', 'booking', 'reviews', 'contact', 'about'],
    categories: {'ar': ['لغات', 'برمجة', 'رياضيات'], 'en': ['Languages', 'Coding', 'Math']},
    products: [
      {'ar': 'دورة إنجليزي', 'en': 'English Course', 'price': 45, 'emoji': '📘', 'cat': 0},
      {'ar': 'دورة برمجة', 'en': 'Coding Course', 'price': 60, 'emoji': '💻', 'cat': 1},
      {'ar': 'تقوية رياضيات', 'en': 'Math Tutoring', 'price': 30, 'emoji': '📐', 'cat': 2},
    ],
  ),
  AppTemplate(
    type: 'gym',
    emoji: '🏋️',
    title: {'ar': 'نادي رياضي', 'en': 'Gym'},
    keywords: ['جيم', 'نادي', 'رياضة', 'لياقة', 'gym', 'fitness', 'workout', 'crossfit', 'yoga'],
    primary: '#0F172A', secondary: '#22C55E', background: '#F8FAFC',
    sections: ['hero', 'products', 'booking', 'reviews', 'map', 'contact'],
    categories: {'ar': ['اشتراكات', 'تدريب شخصي', 'مكملات'], 'en': ['Memberships', 'Personal training', 'Supplements']},
    products: [
      {'ar': 'اشتراك شهري', 'en': 'Monthly Pass', 'price': 25, 'emoji': '🎟️', 'cat': 0},
      {'ar': 'مدرب شخصي', 'en': 'Personal Trainer', 'price': 15, 'emoji': '🏋️', 'cat': 1},
      {'ar': 'بروتين', 'en': 'Protein', 'price': 18, 'emoji': '🥤', 'cat': 2},
    ],
  ),
  AppTemplate(
    type: 'realestate',
    emoji: '🏠',
    title: {'ar': 'عقارات', 'en': 'Real Estate'},
    keywords: ['عقار', 'عقارات', 'شقق', 'فلل', 'ايجار', 'real estate', 'apartment', 'villa', 'property', 'rent'],
    primary: '#1F2937', secondary: '#0EA5E9', background: '#F9FAFB',
    sections: ['hero', 'categories', 'products', 'booking', 'map', 'contact'],
    categories: {'ar': ['للبيع', 'للإيجار', 'تجاري'], 'en': ['For sale', 'For rent', 'Commercial']},
    products: [
      {'ar': 'شقة غرفتين', 'en': '2BR Apartment', 'price': 350, 'emoji': '🏢', 'cat': 1},
      {'ar': 'فيلا', 'en': 'Villa', 'price': 180000, 'emoji': '🏡', 'cat': 0},
      {'ar': 'محل تجاري', 'en': 'Shop Space', 'price': 600, 'emoji': '🏬', 'cat': 2},
    ],
  ),
  AppTemplate(
    type: 'booking',
    emoji: '📅',
    title: {'ar': 'حجوزات / عيادة', 'en': 'Booking / Clinic'},
    keywords: ['حجز', 'حجوزات', 'عيادة', 'موعد', 'مواعيد', 'دكتور', 'booking', 'clinic', 'appointment', 'doctor', 'dentist'],
    primary: '#0E7490', secondary: '#06B6D4', background: '#ECFEFF',
    sections: ['hero', 'products', 'booking', 'reviews', 'map', 'contact'],
    categories: {'ar': ['استشارة', 'فحص', 'متابعة'], 'en': ['Consultation', 'Checkup', 'Follow-up']},
    products: [
      {'ar': 'استشارة', 'en': 'Consultation', 'price': 15, 'emoji': '🩺', 'cat': 0},
      {'ar': 'فحص شامل', 'en': 'Full Checkup', 'price': 40, 'emoji': '🧪', 'cat': 1},
      {'ar': 'تنظيف أسنان', 'en': 'Teeth Cleaning', 'price': 20, 'emoji': '🦷', 'cat': 1},
    ],
  ),
  AppTemplate(
    type: 'portfolio',
    emoji: '🎨',
    title: {'ar': 'معرض أعمال', 'en': 'Portfolio'},
    keywords: ['معرض', 'أعمالي', 'اعمالي', 'بورتفوليو', 'مصور', 'مصمم', 'portfolio', 'photographer', 'designer', 'freelancer', 'cv'],
    primary: '#18181B', secondary: '#A855F7', background: '#FAFAFA',
    sections: ['hero', 'products', 'reviews', 'contact', 'about'],
    categories: {'ar': ['تصوير', 'تصميم', 'فيديو'], 'en': ['Photography', 'Design', 'Video']},
    products: [
      {'ar': 'جلسة تصوير', 'en': 'Photo Session', 'price': 50, 'emoji': '📸', 'cat': 0},
      {'ar': 'تصميم شعار', 'en': 'Logo Design', 'price': 40, 'emoji': '✏️', 'cat': 1},
      {'ar': 'مونتاج فيديو', 'en': 'Video Editing', 'price': 70, 'emoji': '🎬', 'cat': 2},
    ],
  ),
  AppTemplate(
    type: 'chat',
    emoji: '💬',
    title: {'ar': 'تطبيق دردشة', 'en': 'Chat App'},
    keywords: ['دردشة', 'شات', 'محادثة', 'مجتمع', 'chat', 'messenger', 'community', 'social'],
    primary: '#111827', secondary: '#16A34A', background: '#F3F4F6',
    sections: ['hero', 'products', 'contact', 'about'],
    categories: {'ar': ['عام', 'مجموعات'], 'en': ['General', 'Groups']},
    products: [
      {'ar': 'غرفة عامة', 'en': 'Public Room', 'price': 0, 'emoji': '💬', 'cat': 0},
      {'ar': 'مجموعة خاصة', 'en': 'Private Group', 'price': 1, 'emoji': '🔒', 'cat': 1},
    ],
  ),
];

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
