import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Inventario por lote: kg iniciales, vendidos y disponibles (y costo si el rol lo puede ver).
class CoffeeInventoryTab extends StatelessWidget {
  const CoffeeInventoryTab({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      load: session.api.coffeeInventory,
      builder: (context, data) {
        final items = (data['items'] as List<dynamic>? ?? const []).cast<Json>();
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.paddingOf(context).bottom + 16),
          children: [
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Muted('Kg disponibles'),
                  Text(formatKg(data['totalKgDisponibles'] as num?), style: mono(size: 26, weight: FontWeight.w600)),
                ],
              ),
            ),
            if (items.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Muted('Aún no hay lotes en inventario. En la pestaña Lotes, termina el secado de un lote (o envíalo directo si no se seca) y pásalo a inventario.'),
              ),
            for (final i in items) ...[
              const SizedBox(height: 8),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((i['lot'] as Json)['code'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Muted(
                      'Iniciales ${formatKg(i['kgIniciales'] as num?)} · Vendidos ${formatKg(i['kgVendidos'] as num?)}',
                      size: 12,
                    ),
                    Text('Disponibles ${formatKg(i['kgDisponibles'] as num?)}', style: mono(size: 15, weight: FontWeight.w600)),
                    if (i['costoKg'] != null)
                      Muted('Costo ${formatCop(i['costoKg'] as num?)}/kg · ${formatCop(i['costoCarga'] as num?)}/carga', size: 12),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
