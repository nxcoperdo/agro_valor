import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../theme.dart';

/// Permite cerrar el teclado en toda la app, también en diálogos y hojas modales (cuelgan del mismo Navigator):
/// al tocar fuera de un campo, al arrastrar una lista y, en iPhone, con un botón "Listo" sobre el teclado
/// (el teclado numérico de iOS no trae tecla para cerrarse).
class KeyboardDismisser extends StatelessWidget {
  const KeyboardDismisser({super.key, required this.child});

  final Widget child;

  static void dismiss() => FocusManager.instance.primaryFocus?.unfocus();

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    return Stack(
      textDirection: TextDirection.ltr,
      children: [
        Positioned.fill(
          child: GestureDetector(
            // translucent: el toque llega también a lo que hay debajo; botones y otros campos ganan la disputa.
            behavior: HitTestBehavior.translucent,
            onTap: dismiss,
            child: NotificationListener<ScrollUpdateNotification>(
              onNotification: (n) {
                // dragDetails solo existe cuando el dedo arrastra: el auto-scroll que mueve el campo enfocado no cierra el teclado.
                if (n.dragDetails != null) dismiss();
                return false;
              },
              child: child,
            ),
          ),
        ),
        if (defaultTargetPlatform == TargetPlatform.iOS && keyboard > 0)
          Positioned(left: 0, right: 0, bottom: keyboard, child: const _DoneBar()),
      ],
    );
  }
}

class _DoneBar extends StatelessWidget {
  const _DoneBar();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AvColors.surfaceAlt,
      child: SizedBox(
        height: 40,
        child: Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: KeyboardDismisser.dismiss,
            child: const Text('Listo', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}
