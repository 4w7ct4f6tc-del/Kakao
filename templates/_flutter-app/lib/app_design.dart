import 'package:material_ui/material_ui.dart';

Color hexToColor(String hex) {
  var h = hex.replaceAll('#', '');
  if (h.length == 6) h = 'FF$h';
  return Color(int.tryParse(h, radix: 16) ?? 0xFF000000);
}

String colorToHex(Color c) {
  final v = c.toARGB32() & 0xFFFFFF;
  return '#${v.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

class Product {
  final String id;
  final String name;
  final double price;
  final String category;
  final String emoji;
  final String image; // http(s) URL or data: URL, empty -> emoji tile
  final String description;

  const Product({
    required this.id,
    required this.name,
    required this.price,
    this.category = '',
    this.emoji = '🛍️',
    this.image = '',
    this.description = '',
  });

  Product copyWith({String? name, double? price, String? category, String? emoji, String? image, String? description}) =>
      Product(
        id: id,
        name: name ?? this.name,
        price: price ?? this.price,
        category: category ?? this.category,
        emoji: emoji ?? this.emoji,
        image: image ?? this.image,
        description: description ?? this.description,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'price': price,
        'category': category,
        'emoji': emoji,
        'image': image,
        'description': description,
      };

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: (j['id'] ?? DateTime.now().microsecondsSinceEpoch).toString(),
        name: (j['name'] ?? '').toString(),
        price: (j['price'] is num) ? (j['price'] as num).toDouble() : double.tryParse('${j['price']}') ?? 0,
        category: (j['category'] ?? '').toString(),
        emoji: (j['emoji'] ?? '🛍️').toString(),
        image: (j['image'] ?? '').toString(),
        description: (j['description'] ?? '').toString(),
      );
}

class ContactInfo {
  final String whatsapp;
  final String instagram;
  final String phone;
  final String address;
  final String email;

  const ContactInfo({this.whatsapp = '', this.instagram = '', this.phone = '', this.address = '', this.email = ''});

  ContactInfo copyWith({String? whatsapp, String? instagram, String? phone, String? address, String? email}) => ContactInfo(
        whatsapp: whatsapp ?? this.whatsapp,
        instagram: instagram ?? this.instagram,
        phone: phone ?? this.phone,
        address: address ?? this.address,
        email: email ?? this.email,
      );

  Map<String, dynamic> toJson() =>
      {'whatsapp': whatsapp, 'instagram': instagram, 'phone': phone, 'address': address, 'email': email};

  factory ContactInfo.fromJson(Map<String, dynamic>? j) => ContactInfo(
        whatsapp: (j?['whatsapp'] ?? '').toString(),
        instagram: (j?['instagram'] ?? '').toString(),
        phone: (j?['phone'] ?? '').toString(),
        address: (j?['address'] ?? '').toString(),
        email: (j?['email'] ?? '').toString(),
      );
}

/// All sections a generated app can have. The order here is the render order.
const allSections = ['hero', 'categories', 'products', 'offers', 'booking', 'reviews', 'map', 'contact', 'about'];

/// The single source of truth for a generated app (JSON design).
/// Same schema is used by: Flutter preview, Next.js preview + published site,
/// Firebase Functions (AI generation), and the generated Flutter app template.
class AppDesign {
  final String id;
  final String name;
  final String type;
  final String tagline;
  final String primary;
  final String secondary;
  final String background;
  final String textColor;
  final String font;
  final String logoEmoji;
  final String heroImage;
  final String language;
  final String currency;
  final List<String> sections;
  final List<String> categories;
  final List<Product> products;
  final ContactInfo contact;
  final String domain;
  final String status; // draft | live

  const AppDesign({
    required this.id,
    required this.name,
    required this.type,
    this.tagline = '',
    this.primary = '#111111',
    this.secondary = '#16A34A',
    this.background = '#FFFFFF',
    this.textColor = '#111111',
    this.font = 'Cairo',
    this.logoEmoji = '🛍️',
    this.heroImage = '',
    this.language = 'ar',
    this.currency = 'BHD',
    this.sections = const ['hero', 'categories', 'products', 'reviews', 'contact'],
    this.categories = const [],
    this.products = const [],
    this.contact = const ContactInfo(),
    this.domain = '',
    this.status = 'draft',
  });

  Color get primaryColor => hexToColor(primary);
  Color get secondaryColor => hexToColor(secondary);
  Color get backgroundColor => hexToColor(background);
  Color get textColorValue => hexToColor(textColor);

  AppDesign copyWith({
    String? id,
    String? name,
    String? type,
    String? tagline,
    String? primary,
    String? secondary,
    String? background,
    String? textColor,
    String? font,
    String? logoEmoji,
    String? heroImage,
    String? language,
    String? currency,
    List<String>? sections,
    List<String>? categories,
    List<Product>? products,
    ContactInfo? contact,
    String? domain,
    String? status,
  }) =>
      AppDesign(
        id: id ?? this.id,
        name: name ?? this.name,
        type: type ?? this.type,
        tagline: tagline ?? this.tagline,
        primary: primary ?? this.primary,
        secondary: secondary ?? this.secondary,
        background: background ?? this.background,
        textColor: textColor ?? this.textColor,
        font: font ?? this.font,
        logoEmoji: logoEmoji ?? this.logoEmoji,
        heroImage: heroImage ?? this.heroImage,
        language: language ?? this.language,
        currency: currency ?? this.currency,
        sections: sections ?? this.sections,
        categories: categories ?? this.categories,
        products: products ?? this.products,
        contact: contact ?? this.contact,
        domain: domain ?? this.domain,
        status: status ?? this.status,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'type': type,
        'tagline': tagline,
        'colors': {'primary': primary, 'secondary': secondary, 'background': background, 'text': textColor},
        'font': font,
        'logoEmoji': logoEmoji,
        'heroImage': heroImage,
        'language': language,
        'currency': currency,
        'sections': sections,
        'categories': categories,
        'products': products.map((p) => p.toJson()).toList(),
        'contact': contact.toJson(),
        'domain': domain,
        'status': status,
        'pages': ['home', 'products', 'cart', 'booking', 'contact'],
      };

  factory AppDesign.fromJson(Map<String, dynamic> j) {
    final colors = Map<String, dynamic>.from(j['colors'] ?? {});
    return AppDesign(
      id: (j['id'] ?? DateTime.now().millisecondsSinceEpoch.toString()).toString(),
      name: (j['name'] ?? 'My App').toString(),
      type: (j['type'] ?? 'shop').toString(),
      tagline: (j['tagline'] ?? '').toString(),
      primary: (colors['primary'] ?? '#111111').toString(),
      secondary: (colors['secondary'] ?? '#16A34A').toString(),
      background: (colors['background'] ?? '#FFFFFF').toString(),
      textColor: (colors['text'] ?? '#111111').toString(),
      font: (j['font'] ?? 'Cairo').toString(),
      logoEmoji: (j['logoEmoji'] ?? '🛍️').toString(),
      heroImage: (j['heroImage'] ?? '').toString(),
      language: (j['language'] ?? 'ar').toString(),
      currency: (j['currency'] ?? 'BHD').toString(),
      sections: List<String>.from(j['sections'] ?? const ['hero', 'products', 'contact']),
      categories: List<String>.from(j['categories'] ?? const []),
      products: (j['products'] as List? ?? []).map((e) => Product.fromJson(Map<String, dynamic>.from(e))).toList(),
      contact: ContactInfo.fromJson(j['contact'] == null ? null : Map<String, dynamic>.from(j['contact'])),
      domain: (j['domain'] ?? '').toString(),
      status: (j['status'] ?? 'draft').toString(),
    );
  }
}
