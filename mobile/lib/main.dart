import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'session.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  final session = Session()..restore();
  runApp(AgroValorApp(session: session));
}

class AgroValorApp extends StatelessWidget {
  const AgroValorApp({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AgroValor',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: ListenableBuilder(
        listenable: session,
        builder: (context, _) {
          if (session.restoring) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          return AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: session.isLoggedIn
                ? HomeShell(key: const ValueKey('home'), session: session)
                : LoginScreen(key: const ValueKey('login'), session: session),
          );
        },
      ),
    );
  }
}
