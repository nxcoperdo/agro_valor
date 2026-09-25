import 'dart:ui';

import 'package:flutter/material.dart';

import '../session.dart';
import '../theme.dart';
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

  static const _tabs = [
    (title: 'Precio del café', label: 'Precio', icon: Icons.show_chart_rounded),
    (title: 'Cooperativas', label: 'Cooperativas', icon: Icons.storefront_rounded),
    (title: 'Proyección', label: 'Proyección', icon: Icons.calendar_month_rounded),
    (title: 'Mi cuenta', label: 'Cuenta', icon: Icons.person_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final pages = [
      PriceScreen(session: widget.session),
      CooperativesScreen(session: widget.session),
      ForecastScreen(session: widget.session),
      AccountScreen(session: widget.session),
    ];

    return Scaffold(
      extendBody: false,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(title: _tabs[_index].title),
            // IndexedStack conserva cada pestaña cargada al cambiar de una a otra.
            Expanded(child: IndexedStack(index: _index, children: pages)),
          ],
        ),
      ),
      bottomNavigationBar: _BottomNav(
        index: _index,
        onTap: (i) => setState(() => _index = i),
        items: [for (final t in _tabs) (label: t.label, icon: t.icon)],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'AGRO VALOR',
                  style: TextStyle(fontSize: 11, color: AvColors.fgMuted, letterSpacing: 1.2, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
              ],
            ),
          ),
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AvColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AvColors.border),
            ),
            child: const Icon(Icons.coffee_rounded, size: 20, color: AvColors.accent),
          ),
        ],
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.index, required this.onTap, required this.items});

  final int index;
  final ValueChanged<int> onTap;
  final List<({String label, IconData icon})> items;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xEB0A1F10),
            border: Border(top: BorderSide(color: AvColors.border)),
          ),
          padding: EdgeInsets.only(top: 8, bottom: MediaQuery.paddingOf(context).bottom + 8),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: InkResponse(
                    onTap: () => onTap(i),
                    radius: 36,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(items[i].icon, size: 22, color: i == index ? AvColors.accent : AvColors.fgMuted),
                          const SizedBox(height: 3),
                          Text(
                            items[i].label,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: i == index ? FontWeight.w700 : FontWeight.w400,
                              color: i == index ? AvColors.accent : AvColors.fgMuted,
                            ),
                          ),
                          const SizedBox(height: 3),
                          AnimatedOpacity(
                            opacity: i == index ? 1 : 0,
                            duration: const Duration(milliseconds: 150),
                            child: Container(
                              width: 4,
                              height: 4,
                              decoration: const BoxDecoration(color: AvColors.accent, shape: BoxShape.circle),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
