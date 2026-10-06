import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Indicadores del negocio. Costos, utilidad y margen solo llegan si el rol del negocio puede verlos.
class CoffeeDashboardTab extends StatelessWidget {
  const CoffeeDashboardTab({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      load: session.api.coffeeDashboard,
      builder: (context, d) {
        Widget stat(String label, String value, {bool highlight = false}) => SectionCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Muted(label, size: 12),
                  const SizedBox(height: 4),
                  Text(value, style: mono(size: 18, weight: FontWeight.w600, color: highlight ? AvColors.accent : AvColors.fg)),
                ],
              ),
            );
        final stats = <Widget>[
          stat('Compras hoy', '${d['comprasHoy']}'),
          stat('Kg comprados hoy', formatKg(d['kgCompradosHoy'] as num?)),
          stat('Total invertido', formatCop(d['totalInvertido'] as num?)),
          stat('Lotes activos', '${d['lotesActivos']}'),
          stat('Kg en inventario', formatKg(d['kgInventario'] as num?), highlight: true),
          stat('Ventas', formatCop(d['ventas'] as num?)),
          if (d.containsKey('costoPromedioKg')) stat('Costo promedio por kg', formatCop(d['costoPromedioKg'] as num?)),
          if (d.containsKey('costoPromedioCarga')) stat('Costo promedio por carga', formatCop(d['costoPromedioCarga'] as num?)),
          if (d.containsKey('utilidad')) stat('Utilidad', formatCop(d['utilidad'] as num?), highlight: true),
          if (d.containsKey('margen'))
            stat('Margen', d['margen'] == null ? '—' : '${(d['margen'] as num).toStringAsFixed(2)}%', highlight: true),
        ];
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.paddingOf(context).bottom + 16),
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.7,
              children: stats,
            ),
          ],
        );
      },
    );
  }
}
