import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Intro nativo de Agro Valor, sin video, imágenes ni paquetes externos.
///
/// Uso:
/// ```dart
/// AgroValorAnimatedIntro(
///   onFinished: () => Navigator.of(context).pushReplacementNamed('/home'),
/// )
/// ```
class AgroValorAnimatedIntro extends StatefulWidget {
  const AgroValorAnimatedIntro({
    super.key,
    this.onFinished,
    this.duration = const Duration(milliseconds: 3600),
    this.holdDuration = const Duration(milliseconds: 500),
    this.backgroundColor = const Color(0xFFF8F9F7),
  });

  final VoidCallback? onFinished;
  final Duration duration;
  final Duration holdDuration;
  final Color backgroundColor;

  @override
  State<AgroValorAnimatedIntro> createState() =>
      _AgroValorAnimatedIntroState();
}

class _AgroValorAnimatedIntroState extends State<AgroValorAnimatedIntro>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _finishTimer;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration)
      ..addStatusListener(_onAnimationStatus);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) {
      _controller.value = 1;
      _scheduleFinish();
    } else {
      _controller.forward();
    }
  }

  void _onAnimationStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) _scheduleFinish();
  }

  void _scheduleFinish() {
    _finishTimer?.cancel();
    _finishTimer = Timer(widget.holdDuration, () {
      if (mounted) widget.onFinished?.call();
    });
  }

  @override
  void dispose() {
    _finishTimer?.cancel();
    _controller
      ..removeStatusListener(_onAnimationStatus)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: widget.backgroundColor,
      child: SafeArea(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return CustomPaint(
                painter: _AgroValorIntroPainter(
                  progress: _controller.value,
                  backgroundColor: widget.backgroundColor,
                ),
                child: const SizedBox.expand(),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AgroValorIntroPainter extends CustomPainter {
  const _AgroValorIntroPainter({
    required this.progress,
    required this.backgroundColor,
  });

  final double progress;
  final Color backgroundColor;

  static const _darkGreen = Color(0xFF0B4539);
  static const _leafGreen = Color(0xFF72A83D);
  static const _gold = Color(0xFFD39A27);

  double _phase(double begin, double end) {
    return Curves.easeInOutCubic.transform(
      ((progress - begin) / (end - begin)).clamp(0.0, 1.0),
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    final shortSide = math.min(size.width, size.height);
    final logoWidth = math.min(size.width * 0.7, shortSide * 0.82);
    final logoHeight = logoWidth * 0.72;
    final logoTop = (size.height - logoHeight) * 0.43;
    final bounds = Rect.fromLTWH(
      (size.width - logoWidth) / 2,
      logoTop,
      logoWidth,
      logoHeight,
    );

    final settle = _phase(0.0, 0.38);
    final floatOffset = (1 - settle) * 18.0;
    final scale = 0.9 + settle * 0.1;

    canvas.save();
    canvas.translate(bounds.center.dx, bounds.center.dy + floatOffset);
    canvas.scale(scale);
    canvas.translate(-bounds.center.dx, -bounds.center.dy);

    _paintShadow(canvas, bounds);
    _paintLogo(canvas, bounds);
    canvas.restore();

    _paintName(canvas, bounds, size);
    _paintAmbientLight(canvas, bounds, size);
  }

  void _paintShadow(Canvas canvas, Rect bounds) {
    final visibility = _phase(0.05, 0.42);
    final shadowRect = Rect.fromCenter(
      center: Offset(bounds.center.dx, bounds.bottom + bounds.height * 0.12),
      width: bounds.width * (0.34 + visibility * 0.12),
      height: bounds.height * 0.045,
    );
    canvas.drawOval(
      shadowRect,
      Paint()
        ..color = const Color(0xFF18352E).withValues(
          alpha: 0.11 * visibility,
        )
        ..maskFilter = MaskFilter.blur(
          BlurStyle.normal,
          bounds.width * 0.035,
        ),
    );
  }

  void _paintLogo(Canvas canvas, Rect bounds) {
    Offset p(double x, double y) =>
        Offset(bounds.left + x * bounds.width, bounds.top + y * bounds.height);

    final mountain = Path()
      ..moveTo(p(0.26, 0.57).dx, p(0.26, 0.57).dy)
      ..lineTo(p(0.49, 0.12).dx, p(0.49, 0.12).dy)
      ..quadraticBezierTo(
        p(0.51, 0.08).dx,
        p(0.51, 0.08).dy,
        p(0.54, 0.13).dx,
        p(0.54, 0.13).dy,
      )
      ..lineTo(p(0.73, 0.50).dx, p(0.73, 0.50).dy)
      ..lineTo(p(0.66, 0.62).dx, p(0.66, 0.62).dy)
      ..lineTo(p(0.515, 0.34).dx, p(0.515, 0.34).dy)
      ..lineTo(p(0.34, 0.68).dx, p(0.34, 0.68).dy)
      ..close();

    final innerStem = Path()
      ..moveTo(p(0.43, 0.70).dx, p(0.43, 0.70).dy)
      ..lineTo(p(0.52, 0.53).dx, p(0.52, 0.53).dy)
      ..quadraticBezierTo(
        p(0.55, 0.48).dx,
        p(0.55, 0.48).dy,
        p(0.58, 0.55).dx,
        p(0.58, 0.55).dy,
      )
      ..lineTo(p(0.62, 0.63).dx, p(0.62, 0.63).dy)
      ..lineTo(p(0.53, 0.79).dx, p(0.53, 0.79).dy)
      ..close();

    final lowerTick = Path()
      ..moveTo(p(0.30, 0.73).dx, p(0.30, 0.73).dy)
      ..lineTo(p(0.36, 0.78).dx, p(0.36, 0.78).dy)
      ..lineTo(p(0.39, 0.91).dx, p(0.39, 0.91).dy)
      ..lineTo(p(0.35, 0.88).dx, p(0.35, 0.88).dy)
      ..close();

    final rightAccent = Path()
      ..moveTo(p(0.80, 0.63).dx, p(0.80, 0.63).dy)
      ..lineTo(p(0.89, 0.49).dx, p(0.89, 0.49).dy)
      ..lineTo(p(0.75, 0.90).dx, p(0.75, 0.90).dy)
      ..lineTo(p(0.70, 0.82).dx, p(0.70, 0.82).dy)
      ..close();

    final arrow = Path()
      ..moveTo(p(0.54, 0.54).dx, p(0.54, 0.54).dy)
      ..lineTo(p(0.70, 0.77).dx, p(0.70, 0.77).dy)
      ..quadraticBezierTo(
        p(0.72, 0.80).dx,
        p(0.72, 0.80).dy,
        p(0.75, 0.75).dx,
        p(0.75, 0.75).dy,
      )
      ..lineTo(p(0.92, 0.30).dx, p(0.92, 0.30).dy)
      ..lineTo(p(0.97, 0.36).dx, p(0.97, 0.36).dy)
      ..lineTo(p(0.99, 0.16).dx, p(0.99, 0.16).dy)
      ..lineTo(p(0.82, 0.24).dx, p(0.82, 0.24).dy)
      ..lineTo(p(0.88, 0.29).dx, p(0.88, 0.29).dy)
      ..lineTo(p(0.72, 0.66).dx, p(0.72, 0.66).dy)
      ..lineTo(p(0.60, 0.48).dx, p(0.60, 0.48).dy)
      ..close();

    final leaf = Path()
      ..moveTo(p(0.08, 0.40).dx, p(0.08, 0.40).dy)
      ..cubicTo(
        p(0.27, 0.39).dx,
        p(0.27, 0.39).dy,
        p(0.39, 0.49).dx,
        p(0.39, 0.49).dy,
        p(0.40, 0.68).dx,
        p(0.40, 0.68).dy,
      )
      ..cubicTo(
        p(0.21, 0.72).dx,
        p(0.21, 0.72).dy,
        p(0.09, 0.59).dx,
        p(0.09, 0.59).dy,
        p(0.08, 0.40).dx,
        p(0.08, 0.40).dy,
      )
      ..close();

    final leafCut = Path()
      ..moveTo(p(0.18, 0.50).dx, p(0.18, 0.50).dy)
      ..quadraticBezierTo(
        p(0.34, 0.61).dx,
        p(0.34, 0.61).dy,
        p(0.41, 0.84).dx,
        p(0.41, 0.84).dy,
      );

    final traceProgress = _phase(0.0, 0.44);
    final fillProgress = _phase(0.16, 0.50);
    final leafProgress = _phase(0.06, 0.36);
    final arrowProgress = _phase(0.18, 0.53);

    final outlinePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = bounds.width * 0.006
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = _darkGreen.withValues(alpha: 0.26);

    _drawAnimatedPath(canvas, mountain, traceProgress, outlinePaint);
    _drawAnimatedPath(canvas, innerStem, traceProgress, outlinePaint);
    _drawAnimatedPath(canvas, arrow, arrowProgress, outlinePaint);

    canvas.drawPath(
      mountain,
      Paint()..color = _darkGreen.withValues(alpha: fillProgress),
    );
    canvas.drawPath(
      innerStem,
      Paint()..color = _darkGreen.withValues(alpha: fillProgress),
    );
    canvas.drawPath(
      lowerTick,
      Paint()..color = _darkGreen.withValues(alpha: fillProgress),
    );
    canvas.drawPath(
      rightAccent,
      Paint()..color = _darkGreen.withValues(alpha: fillProgress),
    );

    canvas.save();
    final leafCenter = p(0.27, 0.59);
    canvas.translate(leafCenter.dx, leafCenter.dy);
    canvas.scale(leafProgress);
    canvas.rotate((1 - leafProgress) * -0.22);
    canvas.translate(-leafCenter.dx, -leafCenter.dy);
    canvas.drawPath(leaf, Paint()..color = _leafGreen);
    canvas.drawPath(
      leafCut,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = bounds.width * 0.026
        ..color = backgroundColor,
    );
    canvas.restore();

    canvas.drawPath(
      arrow,
      Paint()..color = _gold.withValues(alpha: arrowProgress),
    );

    _paintSpark(canvas, p(0.94, 0.27), bounds.width, _phase(0.28, 0.52));
    _paintSpark(canvas, p(0.13, 0.46), bounds.width, _phase(0.43, 0.66));
  }

  void _drawAnimatedPath(
    Canvas canvas,
    Path path,
    double progress,
    Paint paint,
  ) {
    if (progress <= 0) return;
    for (final metric in path.computeMetrics()) {
      canvas.drawPath(
        metric.extractPath(0, metric.length * progress),
        paint,
      );
    }
  }

  void _paintSpark(Canvas canvas, Offset center, double width, double amount) {
    final pulse = math.sin(amount * math.pi).clamp(0.0, 1.0);
    if (pulse <= 0) return;

    canvas.drawCircle(
      center,
      width * 0.035 * pulse,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.75 * pulse)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, width * 0.018),
    );
    final ray = width * 0.055 * pulse;
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.95 * pulse)
      ..strokeWidth = width * 0.004
      ..strokeCap = StrokeCap.round;
    canvas
      ..drawLine(center.translate(-ray, 0), center.translate(ray, 0), paint)
      ..drawLine(center.translate(0, -ray), center.translate(0, ray), paint);
  }

  void _paintName(Canvas canvas, Rect bounds, Size size) {
    final reveal = _phase(0.56, 0.80);
    if (reveal <= 0) return;

    final fontSize = math.min(bounds.width * 0.115, 48.0);
    final textPainter = TextPainter(
      text: TextSpan(
        style: TextStyle(
          color: _darkGreen.withValues(alpha: reveal),
          fontSize: fontSize,
          letterSpacing: fontSize * 0.11,
          height: 1,
        ),
        children: const [
          TextSpan(
            text: 'AGRO',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          TextSpan(
            text: ' VALOR',
            style: TextStyle(fontWeight: FontWeight.w400),
          ),
        ],
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(maxWidth: size.width * 0.9);

    final position = Offset(
      (size.width - textPainter.width) / 2,
      bounds.bottom + bounds.height * 0.16 + (1 - reveal) * 12,
    );
    canvas.save();
    canvas.clipRect(
      Rect.fromLTWH(
        position.dx,
        position.dy - 2,
        textPainter.width * reveal,
        textPainter.height + 4,
      ),
    );
    textPainter.paint(canvas, position);
    canvas.restore();
  }

  void _paintAmbientLight(Canvas canvas, Rect bounds, Size size) {
    final amount = _phase(0.33, 0.72);
    if (amount <= 0 || amount >= 1) return;

    final x = size.width * (-0.15 + amount * 1.3);
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0),
          Colors.white.withValues(alpha: 0.34),
          Colors.white.withValues(alpha: 0),
        ],
        stops: const [0, 0.5, 1],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(
        Rect.fromLTWH(x, bounds.top, bounds.width * 0.18, bounds.height * 1.7),
      );

    canvas.save();
    canvas.translate(x, bounds.center.dy);
    canvas.rotate(-0.28);
    canvas.translate(-x, -bounds.center.dy);
    canvas.drawRect(
      Rect.fromLTWH(x, bounds.top, bounds.width * 0.18, bounds.height * 1.7),
      paint,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _AgroValorIntroPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.backgroundColor != backgroundColor;
  }
}
