import 'package:flutter/material.dart';

import '../session.dart';
import 'account_screen.dart';
import 'cooperatives_screen.dart';
import 'forecast_screen.dart';
import 'price_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.session});

  final Session session;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _titles = ['Precio del café', 'Cooperativas', 'Proyección', 'Mi cuenta'];

  @override
  Widget build(BuildContext context) {
    final pages = [
      PriceScreen(session: widget.session),
      CooperativesScreen(session: widget.session),
      ForecastScreen(session: widget.session),
      AccountScreen(session: widget.session),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(_titles[_index], style: const TextStyle(fontWeight: FontWeight.w700))),
      // IndexedStack conserva cada pestaña cargada al cambiar de una a otra.
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.show_chart_rounded), label: 'Precio'),
          NavigationDestination(icon: Icon(Icons.storefront_rounded), label: 'Cooperativas'),
          NavigationDestination(icon: Icon(Icons.calendar_month_rounded), label: 'Proyección'),
          NavigationDestination(icon: Icon(Icons.person_rounded), label: 'Cuenta'),
        ],
      ),
    );
  }
}
