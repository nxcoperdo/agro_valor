// Burbuja de vidrio arrastrable de la barra inferior en iPhone.
//
// Adaptado del ejemplo del paquete liquid_glass_renderer (MIT, Tim Lehmann / whynotmake.it):
// example/lib/widgets/bottom_bar.dart.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:liquid_glass_renderer/liquid_glass_renderer.dart';
import 'package:motor/motor.dart';

import '../theme.dart';

typedef AvNavItem = ({String label, IconData icon});

/// Barra inferior de vidrio con una burbuja que marca la pestaña activa.
/// Al mantenerla presionada se agranda, se puede arrastrar y al soltarla se acomoda en la pestaña más cercana.
class AvGlassNav extends StatelessWidget {
  const AvGlassNav({super.key, required this.items, required this.index, required this.onTap});

  final List<AvNavItem> items;
  final int index;
  final ValueChanged<int> onTap;

  static const double barHeight = 64;

  /// Alto total que ocupa la barra: margen superior, píldora, inset del sistema y margen inferior.
  static double heightOf(BuildContext context) => 8 + barHeight + MediaQuery.paddingOf(context).bottom + 6;

  @override
  Widget build(BuildContext context) {
    return LiquidGlassLayer(
      settings: const LiquidGlassSettings(
        glassColor: Color(0x29163020),
        thickness: 24,
        blur: 8,
        saturation: 1.4,
        lightIntensity: 0.7,
        ambientStrength: 0.2,
        refractiveIndex: 1.2,
        lightAngle: math.pi / 4,
      ),
      child: LiquidGlassBlendGroup(
        blend: 10,
        child: Padding(
          padding: EdgeInsets.only(left: 16, top: 8, right: 16, bottom: MediaQuery.paddingOf(context).bottom + 6),
          child: _Bubble(
            count: items.length,
            index: index,
            onChanged: onTap,
            child: LiquidGlass.grouped(
              clipBehavior: Clip.none,
              shape: const LiquidRoundedSuperellipse(borderRadius: 32),
              child: SizedBox(
                height: barHeight,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(
                    children: [
                      for (var i = 0; i < items.length; i++)
                        Expanded(
                          child: _Tab(item: items[i], selected: i == index, onTap: () => onTap(i)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.item, required this.selected, required this.onTap});

  final AvNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AvColors.accent : AvColors.fgMuted;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ExcludeSemantics(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(item.icon, size: 23, color: color),
              const SizedBox(height: 3),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.clip,
                style: TextStyle(fontSize: 10, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatefulWidget {
  const _Bubble({required this.child, required this.count, required this.index, required this.onChanged});

  final Widget child;
  final int count;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  State<_Bubble> createState() => _BubbleState();
}

class _BubbleState extends State<_Bubble> {
  bool _isDown = false;
  bool _isDragging = false;
  int _hoverIndex = -1;

  late double _x = _alignFor(widget.index);

  /// Posición de la burbuja de -1 (primera pestaña) a 1 (última).
  double _alignFor(int i) => (i / (widget.count - 1)).clamp(0.0, 1.0) * 2 - 1;

  @override
  void didUpdateWidget(covariant _Bubble old) {
    super.didUpdateWidget(old);
    if (old.index != widget.index || old.count != widget.count) _x = _alignFor(widget.index);
  }

  double _alignAt(Offset global) {
    final box = context.findRenderObject() as RenderBox;
    final local = box.globalToLocal(global);
    final w = 1.0 / widget.count;
    final range = 1.0 - w;
    final raw = (local.dx / box.size.width).clamp(0.0, 1.0);
    return (_rubber((raw - w / 2) / range)) * 2 - 1;
  }

  /// Resistencia elástica al pasarse de los bordes, como el rebote del scroll en iOS.
  double _rubber(double v) {
    const resistance = 0.4;
    const maxOver = 0.3;
    if (v < 0) return -(-v * resistance).clamp(0.0, maxOver);
    if (v > 1) return 1 + ((v - 1) * resistance).clamp(0.0, maxOver);
    return v;
  }

  int _tabAt(double x) => (((x + 1) / 2) * (widget.count - 1)).round().clamp(0, widget.count - 1);

  void _onDown(DragDownDetails d) => setState(() {
        _isDown = true;
        _hoverIndex = widget.index;
        _x = _alignAt(d.globalPosition);
      });

  void _onUpdate(DragUpdateDetails d) {
    final x = _alignAt(d.globalPosition);
    final tab = _tabAt(x);
    if (tab != _hoverIndex) {
      _hoverIndex = tab;
      HapticFeedback.selectionClick();
    }
    setState(() {
      _isDragging = true;
      _x = x;
    });
  }

  void _onEnd(DragEndDetails d) {
    final box = context.findRenderObject() as RenderBox;
    final w = 1.0 / widget.count;
    final rel = (_x + 1) / 2;
    final vx = (d.velocity.pixelsPerSecond.dx / box.size.width) / (1.0 - w);

    var target = _tabAt(_x);
    if (rel >= 0 && rel <= 1 && vx.abs() > 0.5) {
      // Con un lanzamiento rápido la burbuja sigue de largo, como si tuviera inercia.
      final projected = (rel + vx * 0.3).clamp(0.0, 1.0);
      target = (projected * (widget.count - 1)).round().clamp(0, widget.count - 1);
    }

    setState(() {
      _isDragging = false;
      _isDown = false;
      _hoverIndex = -1;
      _x = _alignFor(target);
    });
    if (target != widget.index) widget.onChanged(target);
  }

  void _onCancel() => setState(() {
        _isDragging = false;
        _isDown = false;
        _hoverIndex = -1;
        _x = _alignFor(widget.index);
      });

  @override
  Widget build(BuildContext context) {
    final restX = _alignFor(widget.index);
    return GestureDetector(
      onHorizontalDragDown: _onDown,
      onHorizontalDragUpdate: _onUpdate,
      onHorizontalDragEnd: _onEnd,
      onHorizontalDragCancel: _onCancel,
      child: VelocityMotionBuilder(
        converter: SingleMotionConverter(),
        value: _x,
        motion: _isDragging
            ? const Motion.interactiveSpring(snapToEnd: true)
            : const Motion.bouncySpring(snapToEnd: true),
        builder: (context, x, velocity, child) {
          final alignment = Alignment(x, 0);
          return SingleMotionBuilder(
            motion: const Motion.snappySpring(snapToEnd: true, duration: Duration(milliseconds: 300)),
            // La burbuja de vidrio aparece al presionar o cuando se aleja de su pestaña.
            value: _isDown || (alignment.x - restX).abs() > 0.30 ? 1.0 : 0.0,
            builder: (context, thickness, child) => Stack(
              clipBehavior: Clip.none,
              children: [
                if (thickness < 1)
                  _Placed(
                    count: widget.count,
                    alignment: alignment,
                    thickness: thickness,
                    velocity: velocity,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 120),
                      opacity: thickness <= .2 ? 1 : 0,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: AvColors.accent.withValues(alpha: .16),
                          borderRadius: BorderRadius.circular(64),
                        ),
                        child: const SizedBox.expand(),
                      ),
                    ),
                  ),
                child!,
                if (thickness > 0)
                  _Placed(
                    count: widget.count,
                    alignment: alignment,
                    thickness: thickness,
                    velocity: velocity,
                    child: LiquidGlass.withOwnLayer(
                      settings: LiquidGlassSettings(
                        visibility: thickness,
                        glassColor: const Color(0x1AFFFFFF),
                        saturation: 1.5,
                        refractiveIndex: 1.15,
                        thickness: 20,
                        lightIntensity: 2,
                        chromaticAberration: .5,
                        blur: 0,
                      ),
                      shape: const LiquidRoundedSuperellipse(borderRadius: 64),
                      child: const GlassGlow(child: SizedBox.expand()),
                    ),
                  ),
              ],
            ),
            child: widget.child,
          );
        },
        child: widget.child,
      ),
    );
  }
}

/// Coloca la burbuja sobre su pestaña, la agranda al presionar y la estira según la velocidad.
class _Placed extends StatelessWidget {
  const _Placed({
    required this.count,
    required this.alignment,
    required this.thickness,
    required this.velocity,
    required this.child,
  });

  final int count;
  final Alignment alignment;
  final double thickness;
  final double velocity;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final rect = RelativeRect.lerp(RelativeRect.fill, const RelativeRect.fromLTRB(-10, -10, -10, -10), thickness)!;
    return Positioned.fill(
      left: 4,
      right: 4,
      top: 4,
      bottom: 4,
      child: FractionallySizedBox(
        widthFactor: 1 / count,
        alignment: alignment,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fromRelativeRect(
              rect: rect,
              child: SingleMotionBuilder(
                motion: Motion.bouncySpring(duration: const Duration(milliseconds: 600)),
                value: velocity,
                builder: (context, v, child) => Transform(
                  alignment: Alignment.center,
                  transform: _jelly(Offset(v, 0)),
                  child: child,
                ),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Aplasta la burbuja en la dirección del movimiento y la estira de lado, como gelatina.
  static Matrix4 _jelly(Offset velocity) {
    const maxDistortion = .6;
    const velocityScale = 10.0;
    final speed = velocity.distance;
    final factor = (speed / velocityScale).clamp(0.0, 1.0) * maxDistortion;
    if (factor == 0) return Matrix4.identity();
    final dir = velocity / speed;
    final scaleX = (1.0 - dir.dx.abs() * factor * 0.5) * (1.0 + dir.dy.abs() * factor * 0.3);
    final scaleY = (1.0 - dir.dy.abs() * factor * 0.5) * (1.0 + dir.dx.abs() * factor * 0.3);
    return Matrix4.diagonal3Values(scaleX, scaleY, 1);
  }
}
