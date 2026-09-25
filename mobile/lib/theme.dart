import 'package:flutter/material.dart';

/// Los mismos colores de la web (css/style.css), para que la app se sienta del mismo producto.
class AvColors {
  static const bg = Color(0xFF081D16);
  static const surface = Color(0xFF0B3D2E);
  static const surfaceAlt = Color(0xFF123526);
  static const border = Color(0xFF2F5C47);
  static const fg = Color(0xFFF2E9DB);
  static const fgMuted = Color(0xFFA9C2B3);
  static const accent = Color(0xFFD4A017);
  static const onAccent = Color(0xFF052E16);
  static const positive = Color(0xFF9CCC65);
  static const danger = Color(0xFFFCA5A5);
}

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

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AvColors.bg,
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
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AvColors.surface,
      indicatorColor: AvColors.accent.withValues(alpha: 0.2),
      labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12, color: AvColors.fg)),
    ),
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
