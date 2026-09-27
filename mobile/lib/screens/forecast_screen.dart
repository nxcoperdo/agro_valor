import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'pro_screen.dart';

class ForecastScreen extends StatelessWidget {
  const ForecastScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      load: session.api.forecast,
      builder: (context, data) => _ForecastTabs(data: data, session: session),
    );
  }
}

class _ForecastTabs extends StatelessWidget {
  const _ForecastTabs({required this.data, required this.session});

  final Json data;
  final Session session;

  static const _lockedKey = {'daily': 'dailyCount', 'weekly': 'weeklyCount', 'monthly': 'monthlyCount'};
  static const _lockedLabel = {'weekly': 'semanal', 'monthly': 'mensual'};

  @override
  Widget build(BuildContext context) {
    final locked = data['locked'] as Json?;

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
                    lockedCount: (locked?[_lockedKey[key]] as num?)?.toInt() ?? 0,
                    lockedLabel: _lockedLabel[key],
                    session: session,
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
  const _ForecastList({required this.items, required this.session, this.note, this.lockedCount = 0, this.lockedLabel});

  final List<Json> items;
  final Session session;
  final String? note;
  final int lockedCount;
  final String? lockedLabel;

  @override
  Widget build(BuildContext context) {
    // Semana y mes completos son Pro: en vez de la lista real se ve un anticipo borroso.
    if (lockedCount > 0 && lockedLabel != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: LockedTeaser(
          height: 320,
          preview: Column(
            children: [
              for (var i = 0; i < 4; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SectionCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        const Expanded(child: Text('••• •••', style: TextStyle(fontWeight: FontWeight.w600))),
                        Text('\$••,•••,•••', style: mono(size: 15, weight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          title: 'Proyección $lockedLabel',
          body: 'Activa Pro para ver los $lockedCount horizonte(s) completos.',
          onUpgrade: () =>
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProScreen(session: session))),
        ),
      );
    }

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
        if (lockedLabel == null && lockedCount > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Este es solo el pronóstico de mañana. Activa Pro para ver los próximos $lockedCount días.',
              style: const TextStyle(color: AvColors.accent, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        if (note != null) ...[const SizedBox(height: 8), Muted(note!, size: 12)],
      ],
    );
  }
}
