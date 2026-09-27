import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// Gris del borde del video; el splash nativo (estático, sin logo) usa el mismo para que no se note el cambio.
const introBackground = Color(0xFFE1E1E1);

// El archivo ya viene preparado: cuadrado de 720×720 centrado en el logo, sin los cuadros vacíos del
// inicio ni el desvanecido final, a 1,5× (4,6 s), sin audio y en H.264. Todo se hizo en el archivo y no con
// seekTo/setPlaybackSpeed porque saltar antes de reproducir hace fallar el decodificador en algunos Android.
const _video = 'assets/branding/intro.mp4';

/// Logo completo: respaldo si el video no carga o el teléfono tiene las animaciones desactivadas.
const _fallback = 'assets/branding/intro_fallback.jpg';

/// Se crea en main(), antes del primer cuadro, para que el video ya esté cargando cuando se muestre.
class IntroVideo {
  IntroVideo() : controller = VideoPlayerController.asset(_video) {
    ready = controller
        .initialize()
        .then((_) => true)
        .timeout(const Duration(seconds: 3), onTimeout: () => false)
        .catchError((_) => false);
  }

  final VideoPlayerController controller;

  /// Verdadero si el video quedó listo para reproducir; falso si falló o tardó demasiado.
  late final Future<bool> ready;
}

enum _Stage { loading, playing, fallback }

/// Intro de marca al abrir la app. Mientras corre, la sesión se restaura por detrás.
/// Termina sola al acabar el video; también se salta con un toque o con el botón "Saltar".
class IntroScreen extends StatefulWidget {
  const IntroScreen({super.key, required this.video, required this.onFinished});

  final IntroVideo video;
  final VoidCallback onFinished;

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen> {
  _Stage _stage = _Stage.loading;
  bool _finished = false;
  bool _started = false;

  VideoPlayerController get _controller => widget.video.controller;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    widget.video.ready.then((ok) {
      if (!mounted || _finished) return;
      if (ok && !reduceMotion) {
        _play();
      } else {
        _showFallback();
      }
    });
  }

  Future<void> _play() async {
    try {
      _controller.addListener(_onTick);
      await _controller.play();
      if (mounted) setState(() => _stage = _Stage.playing);
    } catch (_) {
      _showFallback();
    }
  }

  void _showFallback() {
    if (!mounted) return;
    setState(() => _stage = _Stage.fallback);
    Timer(const Duration(milliseconds: 1200), _finish);
  }

  void _onTick() {
    final v = _controller.value;
    if (v.hasError) {
      _controller.removeListener(_onTick);
      return _showFallback();
    }
    if (v.duration > Duration.zero && v.position >= v.duration) _finish();
  }

  void _finish() {
    if (_finished || !mounted) return;
    _finished = true;
    widget.onFinished();
  }

  @override
  void dispose() {
    _controller.removeListener(_onTick);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Widget picture = switch (_stage) {
      // Mientras carga solo se ve el fondo gris (igual al splash): el video arranca directo, sin imagen previa.
      _Stage.loading => const SizedBox.expand(),
      _Stage.playing => VideoPlayer(_controller),
      _Stage.fallback => Image.asset(_fallback, fit: BoxFit.cover),
    };

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _finish,
      child: ColoredBox(
        color: introBackground,
        child: Stack(
          children: [
            Center(
              child: LayoutBuilder(
                builder: (context, box) {
                  // Cuadrado a todo el ancho en teléfonos; en tablets u horizontal, lo que quepa en alto.
                  final side = box.maxWidth < box.maxHeight ? box.maxWidth : box.maxHeight * 0.9;
                  return SizedBox.square(
                    dimension: side,
                    // Difumina arriba y abajo para que el cuadro del video se funda con el fondo.
                    child: ShaderMask(
                      blendMode: BlendMode.dstIn,
                      shaderCallback: (rect) => const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black, Colors.black, Colors.transparent],
                        stops: [0, 0.15, 0.85, 1],
                      ).createShader(rect),
                      child: AnimatedSwitcher(duration: const Duration(milliseconds: 250), child: picture),
                    ),
                  );
                },
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: TextButton(
                    onPressed: _finish,
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFF3F4A45)),
                    child: const Text('Saltar', style: TextStyle(fontWeight: FontWeight.w600)),
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
