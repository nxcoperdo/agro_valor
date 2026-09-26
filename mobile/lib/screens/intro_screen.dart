import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// Gris del borde del video; el splash nativo usa el mismo para que no se note el cambio.
const introBackground = Color(0xFFE1E1E1);

/// El video es horizontal y el logo ocupa hasta ~45% de su ancho: se amplía para que el logo
/// llene casi todo el ancho de un teléfono vertical, recortando los lados vacíos.
const _zoom = 1.9;
const _aspect = 16 / 9;

/// Primer cuadro del video como imagen: se ve apenas arranca Flutter, mientras el reproductor
/// se prepara (lo más lento del arranque). El video empieza en ese mismo cuadro, así que el cambio no se nota.
const _poster = 'assets/branding/intro_poster.jpg';

// El archivo ya viene recortado (sin los 0,4 s vacíos del inicio), a 1,5× y sin audio.
// Se hizo en el archivo y no con seekTo/setPlaybackSpeed porque saltar antes de reproducir
// hace fallar el decodificador en algunos Android (visto en el emulador: "index 0 is not owned by client").

/// Video de marca al abrir la app. Mientras corre, la sesión se restaura por detrás.
/// Se salta con un toque, y si el video no carga sigue de largo sin bloquear la entrada.
class IntroScreen extends StatefulWidget {
  const IntroScreen({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen> {
  final _controller = VideoPlayerController.asset('assets/branding/intro.mp4');
  bool _finished = false;
  bool _ready = false;
  Timer? _failsafe;

  @override
  void initState() {
    super.initState();
    // Por si el códec del teléfono se atasca: nunca dejar al usuario esperando más de esto.
    _failsafe = Timer(const Duration(seconds: 9), _finish);
    _start();
  }

  Future<void> _start() async {
    try {
      await _controller.initialize();
      if (!mounted) return;
      _controller.addListener(_onTick);
      await _controller.play();
      if (mounted) setState(() => _ready = true);
    } catch (_) {
      _finish();
    }
  }

  void _onTick() {
    final v = _controller.value;
    if (v.hasError) return _finish();
    if (v.isInitialized && v.duration > Duration.zero && v.position >= v.duration) _finish();
  }

  void _finish() {
    if (_finished) return;
    _finished = true;
    _failsafe?.cancel();
    widget.onFinished();
  }

  @override
  void dispose() {
    _failsafe?.cancel();
    _controller.removeListener(_onTick);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _finish,
      child: ColoredBox(
        color: introBackground,
        child: LayoutBuilder(
          builder: (context, box) {
            // En tablets o en horizontal no se amplía más de lo que cabe en alto.
            final width = (box.maxWidth * _zoom).clamp(box.maxWidth, box.maxHeight * _aspect);
            return ClipRect(
              child: OverflowBox(
                maxWidth: double.infinity,
                maxHeight: double.infinity,
                child: SizedBox(
                  width: width,
                  height: width / _aspect,
                  // Difumina arriba y abajo para que el video se funda con el fondo.
                  child: ShaderMask(
                    blendMode: BlendMode.dstIn,
                    shaderCallback: (rect) => const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black, Colors.black, Colors.transparent],
                      stops: [0, 0.18, 0.82, 1],
                    ).createShader(rect),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.asset(_poster, fit: BoxFit.fill, gaplessPlayback: true),
                        if (_ready) VideoPlayer(_controller),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
