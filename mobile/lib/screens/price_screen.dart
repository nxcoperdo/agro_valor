import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class PriceScreen extends StatelessWidget {
  const PriceScreen({super.key, required this.session});

  final Session session;

  Future<(Json, List<dynamic>)> _load() async {
    final results = await Future.wait([session.api.currentPrice(), session.api.priceHistory(30)]);
    return (results[0] as Json, results[1] as List<dynamic>);
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<(Json, List<dynamic>)>(
      load: _load,
      builder: (context, data) {
        final (market, history) = data;
        final internal = market['internal'] as Json?;
        final international = market['international'] as Json?;
        final parity = market['exportParity'] as Json?;
        final exchange = market['exchangeRate'] as Json?;

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (internal != null) _InternalCard(internal: internal),
            const SizedBox(height: 12),
            if (international != null) _InternationalCard(international: international, exchange: exchange),
            const SizedBox(height: 12),
            if (history.length > 1) _HistoryChart(history: history),
            const SizedBox(height: 12),
            if (parity != null) _ParityCard(parity: parity),
          ],
        );
      },
    );
  }
}

class _InternalCard extends StatelessWidget {
  const _InternalCard({required this.internal});

  final Json internal;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Muted('Lo que le pagan al caficultor'),
          const SizedBox(height: 8),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: (internal['copPerCarga'] as num).toDouble()),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutCubic,
            builder: (context, value, _) => Text(
              formatCop(value),
              style: const TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.w800,
                color: AvColors.fg,
                fontFeatures: tabular,
              ),
            ),
          ),
          Muted('por carga de ${internal['cargaKg']} kg de pergamino seco', size: 14),
          const SizedBox(height: 12),
          Muted('${internal['label']} · ${formatDate(internal['scrapedAt'] as String?)}', size: 12),
        ],
      ),
    );
  }
}

class _InternationalCard extends StatelessWidget {
  const _InternationalCard({required this.international, required this.exchange});

  final Json international;
  final Json? exchange;

  @override
  Widget build(BuildContext context) {
    final usdCarga = usdPerLbToCarga(international['usdPerLb'] as num);
    final rate = exchange?['rate'] as num?;
    final changePct = international['changePct'] as num?;
    final monthly = international['granularity'] == 'mensual';
    final real = international['source'] == 'real';

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Muted(
                  'Mercado internacional${international['contract'] != null ? ' · ${international['contract']}' : ''}',
                ),
              ),
              Pill(
                label: !real ? 'Simulado' : (monthly ? 'Dato mensual' : 'En vivo'),
                color: real && !monthly ? AvColors.positive : AvColors.accent,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                formatUsd(usdCarga),
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, fontFeatures: tabular),
              ),
              const SizedBox(width: 8),
              if (changePct != null)
                Text(
                  formatPct(changePct),
                  style: TextStyle(
                    color: changePct >= 0 ? AvColors.positive : AvColors.danger,
                    fontWeight: FontWeight.w600,
                    fontFeatures: tabular,
                  ),
                ),
            ],
          ),
          if (rate != null) Muted('≈ ${formatCop(usdCarga * rate)} por carga', size: 14),
          const SizedBox(height: 12),
          Muted(
            [
              international['exchange'] ?? 'Bolsa',
              if (international['quotedAt'] != null) 'cotización ${timeAgo(international['quotedAt'] as String)}',
              if (rate != null) '1 USD ≈ ${formatCop(rate)}',
            ].join(' · '),
            size: 12,
          ),
        ],
      ),
    );
  }
}

class _HistoryChart extends StatelessWidget {
  const _HistoryChart({required this.history});

  final List<dynamic> history;

  @override
  Widget build(BuildContext context) {
    final points = <FlSpot>[];
    final dates = <String>[];
    for (var i = 0; i < history.length; i++) {
      final row = history[i] as Json;
      points.add(FlSpot(i.toDouble(), usdPerLbToCarga(row['usdPerLb'] as num)));
      dates.add(formatDate((row['quotedAt'] ?? row['fetchedAt']) as String?));
    }

    return SectionCard(
      padding: const EdgeInsets.fromLTRB(12, 20, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 8, bottom: 16),
            child: Text('Últimos 30 días · US\$ por carga', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => const FlLine(color: AvColors.border, strokeWidth: 0.5),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(),
                  rightTitles: const AxisTitles(),
                  bottomTitles: const AxisTitles(),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 44,
                      getTitlesWidget: (v, meta) => Text(
                        v.toStringAsFixed(0),
                        style: const TextStyle(color: AvColors.fgMuted, fontSize: 11),
                      ),
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => AvColors.surfaceAlt,
                    getTooltipItems: (spots) => spots
                        .map((s) => LineTooltipItem(
                              '${dates[s.x.toInt()]}\n${formatUsd(s.y)}',
                              const TextStyle(color: AvColors.fg, fontSize: 12),
                            ))
                        .toList(),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: points,
                    isCurved: true,
                    preventCurveOverShooting: true,
                    color: AvColors.accent,
                    barWidth: 2.5,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(show: true, color: AvColors.accent.withValues(alpha: 0.14)),
                  ),
                ],
              ),
              duration: const Duration(milliseconds: 400),
            ),
          ),
        ],
      ),
    );
  }
}

class _ParityCard extends StatelessWidget {
  const _ParityCard({required this.parity});

  final Json parity;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: const Text('Paridad de exportación', style: TextStyle(fontSize: 15)),
          subtitle: Text(
            '${formatCop(parity['copPerCarga'] as num)} por carga',
            style: const TextStyle(color: AvColors.accent, fontWeight: FontWeight.w600, fontFeatures: tabular),
          ),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [Muted(parity['note'] as String? ?? '')],
        ),
      ),
    );
  }
}
