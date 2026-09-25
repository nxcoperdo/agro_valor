import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Paleta del diseño de la sección de precio, compartida con la web (clase .pv en css/style.css).
class AvColors {
  static const bg = Color(0xFF0A1F10);
  static const surface = Color(0xFF112718);
  static const surfaceAlt = Color(0xFF163020);
  static const border = Color(0x14FFFFFF);
  static const fg = Color(0xFFE8F5E9);
  static const fgMuted = Color(0x8CE8F5E9);
  static const fgFaint = Color(0x61E8F5E9);
  static const accent = Color(0xFFF0B429);
  static const onAccent = Color(0xFF0A1F10);
  static const positive = Color(0xFF4ADE80);
  static const danger = Color(0xFFF87171);
  static const ma = Color(0xFFFACC15);
  static const tooltip = Color(0xFF0D2016);
}

/// Cifras en DM Mono con dígitos de ancho fijo, como en el diseño.
TextStyle mono({double size = 14, FontWeight weight = FontWeight.w500, Color color = AvColors.fg, double? spacing}) =>
    GoogleFonts.dmMono(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: spacing,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AvColors.accent,
    brightness: Brightness.dark,
  ).copyWith(
    primary: AvColors.accent,
    onPrimary: AvColors.onAccent,
    surface: AvColors.bg,
    onSurface: AvColors.fg,
    surfaceContainer: AvColors.surface,
    surfaceContainerHigh: AvColors.surfaceAlt,
    outline: AvColors.border,
    error: AvColors.danger,
  );

  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: const BorderSide(color: AvColors.border),
  );

  final base = ThemeData(useMaterial3: true, brightness: Brightness.dark);

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AvColors.bg,
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(bodyColor: AvColors.fg, displayColor: AvColors.fg),
    appBarTheme: const AppBarTheme(
      backgroundColor: AvColors.bg,
      foregroundColor: AvColors.fg,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: AvColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AvColors.border),
      ),
    ),
    dividerColor: AvColors.border,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AvColors.surfaceAlt,
      border: inputBorder,
      enabledBorder: inputBorder,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
  );
}
