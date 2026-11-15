/// Branding rules (do not change casing):
///  - Arabic UI  -> only "خعخعو", logo letter "خ"
///  - Any other UI -> only "KAkAo", logo letter "K"
///  - Never show both names together.
class Brand {
  static const String nameAr = 'خعخعو';
  static const String nameEn = 'KAkAo';
  static const String company = 'B.K.A Famy';
  static const String companyFull = 'K.A Familia Global Company';
  static const String owner = 'alansari';

  static bool _isAr(String lang) => lang == 'ar';

  static String name(String lang) => _isAr(lang) ? nameAr : nameEn;
  static String logoLetter(String lang) => _isAr(lang) ? 'خ' : 'K';
  static String footer(String lang) =>
      '${name(lang)} • © 2026 $companyFull';
}
