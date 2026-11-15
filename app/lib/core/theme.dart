import 'package:material_ui/material_ui.dart';
import 'package:google_fonts/google_fonts.dart';

class KColors {
  static const background = Color(0xFF0F0F0F);
  static const card = Colors.white;
  static const button = Colors.black;
  static const accent = Color(0xFF16A34A);
  static const surface = Color(0xFF1A1A1A);
  static const muted = Color(0xFF9CA3AF);
  static const danger = Color(0xFFDC2626);
}

ThemeData buildTheme(String lang) {
  final rtlFamily = lang == 'ar' || lang == 'fa' || lang == 'ur';
  final base = ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    scaffoldBackgroundColor: KColors.background,
    colorScheme: const ColorScheme.dark(
      primary: KColors.accent,
      secondary: KColors.accent,
      surface: KColors.surface,
      onPrimary: Colors.white,
    ),
  );
  final textTheme = rtlFamily
      ? GoogleFonts.cairoTextTheme(base.textTheme)
      : GoogleFonts.interTextTheme(base.textTheme);
  return base.copyWith(
    textTheme: textTheme.apply(bodyColor: Colors.white, displayColor: Colors.white),
    appBarTheme: const AppBarTheme(
      backgroundColor: KColors.background,
      elevation: 0,
      centerTitle: true,
    ),
    cardTheme: CardThemeData(
      color: KColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: KColors.button,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(56),
        side: const BorderSide(color: Color(0xFF2A2A2A)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: KColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.black,
      indicatorColor: KColors.accent.withValues(alpha: 0.25),
    ),
  );
}
