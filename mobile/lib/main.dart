import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'screens/home_shell.dart';
import 'screens/intro_screen.dart';
import 'screens/login_screen.dart';
import 'push.dart';
import 'session.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  final pushAvailable = await PushNotifications.init();
  final session = Session(pushAvailable: pushAvailable)..restore();
  runApp(AgroValorApp(session: session));
}

class AgroValorApp extends StatefulWidget {
  const AgroValorApp({super.key, required this.session});

  final Session session;

  @override
  State<AgroValorApp> createState() => _AgroValorAppState();
}

class _AgroValorAppState extends State<AgroValorApp> {
  bool _introDone = false;

  Session get session => widget.session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AgroValor',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: messengerKey,
      theme: buildTheme(),
      home: ListenableBuilder(
        listenable: session,
        builder: (context, _) {
          final Widget page;
          if (!_introDone) {
            page = IntroScreen(key: const ValueKey('intro'), onFinished: () => setState(() => _introDone = true));
          } else if (session.restoring) {
            // Solo se ve si el servidor tarda más que el video en responder.
            page = const Scaffold(key: ValueKey('loading'), body: Center(child: CircularProgressIndicator()));
          } else {
            page = session.isLoggedIn
                ? HomeShell(key: const ValueKey('home'), session: session)
                : LoginScreen(key: const ValueKey('login'), session: session);
          }
          return AnimatedSwitcher(duration: const Duration(milliseconds: 400), child: page);
        },
      ),
    );
  }
}
