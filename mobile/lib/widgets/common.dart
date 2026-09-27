import 'dart:ui';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../theme.dart';

/// Carga datos con pull-to-refresh y maneja los estados de carga y error de forma uniforme.
class AsyncView<T> extends StatefulWidget {
  const AsyncView({super.key, required this.load, required this.builder, this.onUpgradeRequired});

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data) builder;
  final WidgetBuilder? onUpgradeRequired;

  @override
  State<AsyncView<T>> createState() => _AsyncViewState<T>();
}

class _AsyncViewState<T> extends State<AsyncView<T>> {
  late Future<T> _future = widget.load();

  Future<void> _reload() async {
    final next = widget.load();
    setState(() => _future = next);
    try {
      await next;
    } catch (_) {
      // El error lo pinta el FutureBuilder; aquí solo se espera para cerrar el indicador.
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _reload,
      color: AvColors.accent,
      child: FutureBuilder<T>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            final err = snap.error;
            if (err is ApiError && err.upgradeRequired && widget.onUpgradeRequired != null) {
              return widget.onUpgradeRequired!(context);
            }
            return _Scrollable(child: ErrorMessage(message: '$err', onRetry: _reload));
          }
          return widget.builder(context, snap.data as T);
        },
      ),
    );
  }
}

class _Scrollable extends StatelessWidget {
  const _Scrollable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    // Debe ser desplazable para que el gesto de refrescar funcione también en el error.
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class ErrorMessage extends StatelessWidget {
  const ErrorMessage({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, size: 40, color: AvColors.fgMuted),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AvColors.fgMuted)),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.child, this.padding = const EdgeInsets.all(20)});

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: padding, child: child));
}

class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, this.color = AvColors.positive});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class Muted extends StatelessWidget {
  const Muted(this.text, {super.key, this.size = 13});

  final String text;
  final double size;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: TextStyle(color: AvColors.fgMuted, fontSize: size, height: 1.4));
}

const tabular = [FontFeature.tabularFigures()];

/// Pantalla para funciones Pro cuando el usuario tiene el plan gratis.
class ProUpsell extends StatelessWidget {
  const ProUpsell({super.key, required this.title, required this.body, this.icon = Icons.lock_rounded});

  final String title;
  final String body;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 32),
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AvColors.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, size: 36, color: AvColors.accent),
          ),
        ),
        const SizedBox(height: 20),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(body, textAlign: TextAlign.center, style: const TextStyle(color: AvColors.fgMuted, fontSize: 15, height: 1.4)),
        const SizedBox(height: 20),
        const Center(child: Pill(label: 'Función de AgroValor Pro', color: AvColors.accent)),
      ],
    );
  }
}

/// Anticipo de una función Pro: se ve la forma del dato real desenfocada, con la venta
/// encima. A diferencia de [ProUpsell] no ocupa toda la pantalla, va incrustado junto a
/// contenido gratis que sí funciona (ej. el cálculo del día de hoy, sin el resto del mes).
class LockedTeaser extends StatelessWidget {
  const LockedTeaser({super.key, required this.preview, required this.title, required this.body, this.height});

  /// El contenido real que se muestra borroso detrás de la venta (no datos falsos).
  final Widget preview;
  final String title;
  final String body;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            IgnorePointer(
              child: ImageFiltered(
                imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                child: Opacity(opacity: 0.55, child: preview),
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.black.withValues(alpha: 0.15), Colors.black.withValues(alpha: 0.78)],
                  ),
                ),
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Pill(label: 'AgroValor Pro', color: AvColors.accent),
                        const SizedBox(height: 10),
                        Text(
                          title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Colors.white),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          body,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Encabezado pequeño en mayúsculas para separar bloques dentro de una pantalla.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(fontSize: 11, color: AvColors.fgMuted, letterSpacing: 1.1, fontWeight: FontWeight.w600),
        ),
      );
}
