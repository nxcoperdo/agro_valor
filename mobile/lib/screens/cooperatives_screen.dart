import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class CooperativesScreen extends StatelessWidget {
  const CooperativesScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      load: session.api.cooperatives,
      builder: (context, data) {
        final coops = (data['cooperatives'] as List<dynamic>? ?? []).cast<Json>();
        final fnc = data['fncReference'] as Json?;

        if (coops.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            children: [Muted(data['error'] as String? ?? 'Todavía no hay cooperativas para comparar.')],
          );
        }

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (fnc != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12, left: 4),
                child: Muted(
                  'Base FNC: ${formatCop(fnc['priceCopCarga'] as num)} por carga'
                  '${fnc['isStale'] == true ? ' · desactualizado' : ''}',
                ),
              ),
            for (final c in coops) ...[_CoopTile(coop: c), const SizedBox(height: 8)],
            const SizedBox(height: 8),
            Muted(data['disclaimer'] as String? ?? '', size: 12),
          ],
        );
      },
    );
  }
}

class _CoopTile extends StatelessWidget {
  const _CoopTile({required this.coop});

  final Json coop;

  @override
  Widget build(BuildContext context) {
    final reported = coop['priceSource'] == 'reported';
    final diff = (coop['differentialPct'] as num) * 100;
    final best = coop['isHighestBuyer'] == true;
    final place = [coop['municipality'], coop['region']].where((e) => e != null && '$e'.isNotEmpty).join(', ');

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: best ? AvColors.accent : AvColors.border, width: best ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: best ? AvColors.accent : AvColors.surfaceAlt,
              child: Text(
                '${coop['rank']}',
                style: TextStyle(
                  color: best ? AvColors.onAccent : AvColors.fg,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(coop['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (place.isNotEmpty) Muted(place, size: 12),
                  const SizedBox(height: 6),
                  Pill(
                    label: reported ? 'Reportado' : 'Estimado',
                    color: reported ? AvColors.positive : AvColors.fgMuted,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatCop(coop['estimatedPriceCopCarga'] as num),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: tabular),
                ),
                Text(
                  formatPct(diff),
                  style: TextStyle(
                    fontSize: 12,
                    color: diff >= 0 ? AvColors.positive : AvColors.danger,
                    fontFeatures: tabular,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
