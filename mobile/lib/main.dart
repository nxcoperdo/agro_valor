import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'screens/home_shell.dart';
import 'screens/intro_screen.dart';
import 'screens/login_screen.dart';
import 'push.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets/keyboard_dismisser.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  // Nada de esperas antes de runApp: cada una alarga el splash gris.
  final session = Session()..restore();
  // El video de intro empieza a cargar ya, mientras Flutter dibuja su primer cuadro.
  final intro = IntroVideo();
  runApp(AgroValorApp(session: session, intro: intro));
  unawaited(session.startPush());
}

class AgroValorApp extends StatefulWidget {
  const AgroValorApp({super.key, required this.session, required this.intro});

  final Session session;
  final IntroVideo intro;

  @override
  State<AgroValorApp> createState() => _AgroValorAppState();
}

class _AgroValorAppState extends State<AgroValorApp> {
  bool _introDone = false;
  Brightness _applied = AvColors.palette.brightness;

  Session get session => widget.session;

  void _markDirty(Element element) {
    element.markNeedsBuild();
    element.visitChildren(_markDirty);
  }

  /// Los colores de AvColors no pasan por Theme.of, así que los widgets que no dependen del
  /// tema (los const, por ejemplo) no se enteran del cambio. Se fuerza su reconstrucción.
  void _applyBrightness(Brightness brightness) {
    if (brightness == _applied) return;
    _applied = brightness;
    AvColors.use(brightness);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) (context as Element).visitChildren(_markDirty);
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => _buildApp(),
    );
  }

  Widget _buildApp() {
    return MaterialApp(
      title: 'AgroValor',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: messengerKey,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: session.themeMode,
      builder: (context, child) {
        _applyBrightness(Theme.of(context).brightness);
        return KeyboardDismisser(child: child ?? const SizedBox.shrink());
      },
      home: ListenableBuilder(
        listenable: session,
        builder: (context, _) {
          final Widget page;
          if (!_introDone) {
            page = IntroScreen(
              key: const ValueKey('intro'),
              video: widget.intro,
              onFinished: () => setState(() => _introDone = true),
            );
          } else if (session.restoring) {
            // Solo se ve si el servidor tarda más que el video en responder.
            page = const Scaffold(
              key: ValueKey('loading'),
              body: Center(child: CircularProgressIndicator()),
            );
          } else {
            page = session.isLoggedIn
                ? HomeShell(key: const ValueKey('home'), session: session)
                : LoginScreen(key: const ValueKey('login'), session: session);
          }
          return AnimatedSwitcher(
            duration: const Duration(milliseconds: 600),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            transitionBuilder: (child, animation) {
              // La intro se acerca un poco mientras se desvanece; el login entra con su propia animación.
              final isIntro = child.key == const ValueKey('intro');
              return FadeTransition(
                opacity: animation,
                child: isIntro
                    ? ScaleTransition(scale: Tween(begin: 1.08, end: 1.0).animate(animation), child: child)
                    : child,
              );
            },
            child: page,
          );
        },
      ),
    );
  }
}
