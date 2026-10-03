import 'package:flutter/material.dart';

import '../../session.dart';
import '../../widgets/common.dart';
import '../pro_screen.dart';
import 'coffee_dashboard_tab.dart';
import 'coffee_inventory_tab.dart';
import 'coffee_purchases_tab.dart';
import 'coffee_quick_calc_tab.dart';

/// Módulo de café: panel, compras, calculadora rápida e inventario en pestañas.
class CoffeeHubScreen extends StatelessWidget {
  const CoffeeHubScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    if (!session.isPro) {
      return Scaffold(
        appBar: AppBar(title: const Text('Compras de café')),
        body: ProUpsell(
          title: 'Compras de café',
          body: 'Registra compras con varias pesadas, controla lotes e inventario y mide tu rentabilidad.',
          icon: Icons.coffee_rounded,
          onUpgrade: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProScreen(session: session))),
        ),
      );
    }
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Compras de café'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [Tab(text: 'Panel'), Tab(text: 'Compras'), Tab(text: 'Calculadora'), Tab(text: 'Inventario')],
          ),
        ),
        body: TabBarView(
          children: [
            CoffeeDashboardTab(session: session),
            CoffeePurchasesTab(session: session),
            CoffeeQuickCalcTab(session: session),
            CoffeeInventoryTab(session: session),
          ],
        ),
      ),
    );
  }
}
