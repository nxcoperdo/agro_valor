import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ForecastScreen extends StatelessWidget {
  const ForecastScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        if (!session.isPro) {
          return const ProUpsell(
            title: 'Proyección de precio',
            body: 'Ve hacia dónde podría moverse el precio: día a día, semana a semana y mes a mes, en pesos por carga.',
            icon: Icons.calendar_month_rounded,
          );
        }
        return AsyncView<Json>(
          load: session.api.forecast,
          onUpgradeRequired: (_) => const ProUpsell(
            title: 'Proyección de precio',
            body: 'Tu plan Pro venció. Renuévalo para seguir viendo la proyección.',
            icon: Icons.calendar_month_rounded,
          ),
          builder: (context, data) => _ForecastTabs(data: data),
        );
      },
    );
  }
}

class _ForecastTabs extends StatelessWidget {
  const _ForecastTabs({required this.data});

  final Json data;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          const TabBar(
            tabs: [Tab(text: 'Días'), Tab(text: 'Semanas'), Tab(text: 'Meses')],
            indicatorColor: AvColors.accent,
            labelColor: AvColors.accent,
            unselectedLabelColor: AvColors.fgMuted,
          ),
          Expanded(
            child: TabBarView(
              children: [
                for (final key in ['daily', 'weekly', 'monthly'])
                  _ForecastList(
                    items: (data[key] as List<dynamic>? ?? const []).cast<Json>(),
                    note: data['note'] as String?,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ForecastList extends StatelessWidget {
  const _ForecastList({required this.items, this.note});

  final List<Json> items;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        if (items.isEmpty) const Muted('Todavía no hay proyección calculada.'),
        for (final f in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: SectionCard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      formatDate(f['predictedForDate'] as String?),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        f['impliedInternalCopPerCarga'] != null
                            ? formatCop(f['impliedInternalCopPerCarga'] as num)
                            : formatUsd(usdPerLbToCarga(f['usdPerLb'] as num)),
                        style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: tabular),
                      ),
                      if (f['changePct'] != null)
                        Text(
                          formatPct(f['changePct'] as num),
                          style: TextStyle(
                            fontSize: 12,
                            color: (f['changePct'] as num) >= 0 ? AvColors.positive : AvColors.danger,
                            fontFeatures: tabular,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        if (note != null) ...[const SizedBox(height: 8), Muted(note!, size: 12)],
      ],
    );
  }
}
