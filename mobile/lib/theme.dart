import 'package:flutter/material.dart';

/// Juego completo de colores de un tema. [dark] es la paleta del diseño de la sección de
/// precio, compartida con la web (clase .pv en css/style.css); [light] es su versión clara.
class AvPalette {
  const AvPalette({
    required this.brightness,
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.border,
    required this.fg,
    required this.fgMuted,
    required this.fgFaint,
    required this.accent,
    required this.onAccent,
    required this.positive,
    required this.danger,
    required this.ma,
    required this.tooltip,
    required this.glass,
    required this.glassBar,
    required this.glassHighlight,
  });

  final Brightness brightness;
  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color border;
  final Color fg;
  final Color fgMuted;
  final Color fgFaint;
  final Color accent;
  final Color onAccent;
  final Color positive;
  final Color danger;
  final Color ma;
  final Color tooltip;
  final Color glass;
  final Color glassBar;
  final Color glassHighlight;

  static const dark = AvPalette(
    brightness: Brightness.dark,
    bg: Color(0xFF0A1F10),
    surface: Color(0xFF112718),
    surfaceAlt: Color(0xFF163020),
    border: Color(0x14FFFFFF),
    fg: Color(0xFFE8F5E9),
    fgMuted: Color(0x8CE8F5E9),
    fgFaint: Color(0x61E8F5E9),
    accent: Color(0xFFF0B429),
    onAccent: Color(0xFF0A1F10),
    positive: Color(0xFF4ADE80),
    danger: Color(0xFFF87171),
    ma: Color(0xFFFACC15),
    tooltip: Color(0xFF0D2016),
    glass: Color(0x29163020),
    glassBar: Color(0xEB0A1F10),
    glassHighlight: Color(0x1AFFFFFF),
  );

  static const light = AvPalette(
    brightness: Brightness.light,
    bg: Color(0xFFF4F7F2),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFE9F0E7),
    border: Color(0x1F0A1F10),
    fg: Color(0xFF0F2417),
    fgMuted: Color(0x990F2417),
    fgFaint: Color(0x660F2417),
    // El dorado del tema oscuro no contrasta sobre fondo claro; este es su equivalente más oscuro.
    accent: Color(0xFFA16207),
    onAccent: Color(0xFFFFFFFF),
    positive: Color(0xFF15803D),
    danger: Color(0xFFB91C1C),
    ma: Color(0xFFCA8A04),
    tooltip: Color(0xFFFFFFFF),
    glass: Color(0x29FFFFFF),
    glassBar: Color(0xEBFFFFFF),
    glassHighlight: Color(0x1A0A1F10),
  );
}

/// Acceso a los colores del tema activo. [use] cambia la paleta (lo llama MaterialApp.builder
/// antes de construir las pantallas) para que los ~250 usos de `AvColors.x` sigan igual.
class AvColors {
  static AvPalette _p = AvPalette.dark;

  static AvPalette get palette => _p;

  static void use(Brightness brightness) {
    _p = brightness == Brightness.dark ? AvPalette.dark : AvPalette.light;
  }

  static Color get bg => _p.bg;
  static Color get surface => _p.surface;
  static Color get surfaceAlt => _p.surfaceAlt;
  static Color get border => _p.border;
  static Color get fg => _p.fg;
  static Color get fgMuted => _p.fgMuted;
  static Color get fgFaint => _p.fgFaint;
  static Color get accent => _p.accent;
  static Color get onAccent => _p.onAccent;
  static Color get positive => _p.positive;
  static Color get danger => _p.danger;
  static Color get ma => _p.ma;
  static Color get tooltip => _p.tooltip;
  static Color get glass => _p.glass;
  static Color get glassBar => _p.glassBar;
  static Color get glassHighlight => _p.glassHighlight;
}

/// Cifras en DM Mono con dígitos de ancho fijo, como en el diseño.
TextStyle mono({double size = 14, FontWeight weight = FontWeight.w500, Color? color, double? spacing}) => TextStyle(
      fontFamily: 'DMMono',
      fontSize: size,
      fontWeight: weight,
      color: color ?? AvColors.fg,
      letterSpacing: spacing,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

ThemeData buildTheme([Brightness brightness = Brightness.dark]) {
  final p = brightness == Brightness.dark ? AvPalette.dark : AvPalette.light;
  final scheme = ColorScheme.fromSeed(
    seedColor: p.accent,
    brightness: brightness,
  ).copyWith(
    primary: p.accent,
    onPrimary: p.onAccent,
    surface: p.bg,
    onSurface: p.fg,
    surfaceContainer: p.surface,
    surfaceContainerHigh: p.surfaceAlt,
    outline: p.border,
    error: p.danger,
  );

  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(color: p.border),
  );

  final base = ThemeData(useMaterial3: true, brightness: brightness);

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.bg,
    textTheme: base.textTheme.apply(fontFamily: 'Inter', bodyColor: p.fg, displayColor: p.fg),
    appBarTheme: AppBarTheme(
      backgroundColor: p.bg,
      foregroundColor: p.fg,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: p.border),
      ),
    ),
    dividerColor: p.border,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surfaceAlt,
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
