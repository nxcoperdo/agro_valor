import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/market_selector.dart';
import 'report_screen.dart';

class CooperativesScreen extends StatelessWidget {
  const CooperativesScreen({super.key, required this.session});

  final Session session;

  /// Una cooperativa es "de mi región" cuando su departamento es el que el usuario guardó en su perfil.
  bool _isMine(Json c) {
    final department = session.user?['department'];
    return department != null && c['region'] == department;
  }

  @override
  Widget build(BuildContext context) {
    final isCocoa = session.market == 'cocoa';

    return Column(
      children: [
        MarketSelector(session: session),
        Expanded(
          child: AsyncView<Json>(
            load: () => session.api.cooperatives(session.market),
            builder: (context, data) {
              final coops = (data['cooperatives'] as List<dynamic>? ?? []).cast<Json>();
              final fnc = data['fncReference'] as Json?;
              final reference = data['reference'] as Json?;

              if (coops.isEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(24),
                  children: [
                    Muted(data['error'] as String? ?? 'Todavía no hay ${isCocoa ? 'compradores' : 'cooperativas'} para comparar.'),
                  ],
                );
              }

              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 24),
                children: [
                  _ReportPrompt(session: session),
                  const SizedBox(height: 12),
                  if (fnc != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12, left: 4),
                      child: Muted(
                        'Base FNC: ${formatCop(fnc['priceCopCarga'] as num)} por carga'
                        '${fnc['isStale'] == true ? ' · desactualizado' : ''}',
                      ),
                    ),
                  if (reference != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12, left: 4),
                      child: Muted(
                        'Referencia de la industria (Agronet, semana del ${reference['weekLabel']}): '
                        '${formatCop(reference['priceCopKg'] as num)} por kilo'
                        '${reference['isStale'] == true ? ' · desactualizado' : ''}',
                      ),
                    ),
                  for (final c in coops) ...[
                    isCocoa
                        ? _BuyerTile(buyer: c, mine: _isMine(c))
                        : _CoopTile(coop: c, mine: _isMine(c)),
                    const SizedBox(height: 8),
                  ],
                  const SizedBox(height: 8),
                  Muted(data['disclaimer'] as String? ?? '', size: 12),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Comprador de cacao: sin estimación. Muestra el precio solo si varios productores lo reportaron.
class _BuyerTile extends StatelessWidget {
  const _BuyerTile({required this.buyer, this.mine = false});

  final Json buyer;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final price = buyer['priceCopKg'] as num?;
    final best = buyer['isHighestBuyer'] == true;
    final place = [buyer['municipality'], buyer['region']].where((e) => e != null && '$e'.isNotEmpty).join(', ');

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
                buyer['rank'] != null ? '${buyer['rank']}' : '—',
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
                  Text(buyer['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (place.isNotEmpty) Muted(place, size: 12),
                  if (mine) ...[
                    const SizedBox(height: 6),
                    Pill(label: 'Tu región', color: AvColors.accent),
                  ],
                ],
              ),
            ),
            if (price != null)
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${formatCop(price)}/kg',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: tabular),
                  ),
                  Pill(label: 'Reportado', color: AvColors.positive),
                ],
              )
            else
              const Muted('Sin reportes aún', size: 12),
          ],
        ),
      ),
    );
  }
}

class _CoopTile extends StatelessWidget {
  const _CoopTile({required this.coop, this.mine = false});

  final Json coop;
  final bool mine;

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
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      Pill(
                        label: reported ? 'Reportado' : 'Estimado',
                        color: reported ? AvColors.positive : AvColors.fgMuted,
                      ),
                      if (mine) Pill(label: 'Tu región', color: AvColors.accent),
                    ],
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

/// Invitación a reportar: los reportes son lo que vuelve "Reportado" un precio estimado.
class _ReportPrompt extends StatelessWidget {
  const _ReportPrompt({required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportScreen(session: session))),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(Icons.campaign_rounded, color: AvColors.accent),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('¿Vendiste hoy?', style: TextStyle(fontWeight: FontWeight.w700)),
                    Muted('Reporta cuánto te pagaron y ayuda a que los precios sean reales', size: 12),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AvColors.fgMuted),
            ],
          ),
        ),
      ),
    );
  }
}
