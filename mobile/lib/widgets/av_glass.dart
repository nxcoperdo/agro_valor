import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_renderer/liquid_glass_renderer.dart';

import '../theme.dart';

/// Apaga el Liquid Glass y vuelve al blur simple si en un iPhone real se ve lento.
const bool kLiquidGlass = true;

bool get isIOS => defaultTargetPlatform == TargetPlatform.iOS;

/// Vidrio con la identidad de AgroValor.
///
/// En iPhone usa Liquid Glass (refracción sobre lo que hay detrás). En Android, o con [kLiquidGlass]
/// apagado, queda el vidrio esmerilado de siempre, así Android se ve exactamente como antes.
class AvGlass extends StatelessWidget {
  const AvGlass({super.key, required this.child, this.radius = 28, this.padding = EdgeInsets.zero});

  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    if (!(isIOS && kLiquidGlass)) return _Frosted(radius: radius, padding: padding, child: child);

    return LiquidGlass.withOwnLayer(
      shape: LiquidRoundedSuperellipse(borderRadius: radius),
      settings: LiquidGlassSettings(
        glassColor: AvColors.glass,
        thickness: 14,
        blur: 8,
        lightIntensity: 0.6,
        saturation: 1.3,
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// El vidrio esmerilado que ya tenía la app (blur + verde translúcido + borde fino).
class _Frosted extends StatelessWidget {
  const _Frosted({required this.child, required this.radius, required this.padding});

  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: AvColors.glassBar,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: AvColors.border),
          ),
          child: child,
        ),
      ),
    );
  }
}
