import 'package:flutter/material.dart';

import '../markets.dart';
import '../session.dart';
import '../theme.dart';

/// Desplegable de mercado (café primero y por defecto). Al cambiarlo, toda la app se vuelve a
/// pintar con ese mercado porque HomeShell escucha a la sesión.
class MarketSelector extends StatelessWidget {
  const MarketSelector({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          const Text('Mercado', style: TextStyle(fontSize: 13, color: AvColors.fgMuted)),
          const SizedBox(width: 10),
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AvColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AvColors.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: session.market,
                dropdownColor: AvColors.surface,
                borderRadius: BorderRadius.circular(12),
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                items: [
                  for (final m in kMarkets) DropdownMenuItem(value: m.id, child: Text('${m.emoji} ${m.name}')),
                ],
                onChanged: (id) {
                  if (id != null) session.setMarket(id);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
