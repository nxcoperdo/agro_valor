import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/forms.dart';

/// Cuánto le queda al cacaotero por kilo. Referencia: cotización ICE convertida a COP/kg con la
/// TRM del día, ajustada por humedad, grano defectuoso, fermentación, descuento y transporte.
class CocoaCalcTab extends StatefulWidget {
  const CocoaCalcTab({super.key, required this.session});

  final Session session;

  @override
  State<CocoaCalcTab> createState() => _CocoaCalcTabState();
}

class _CocoaCalcTabState extends State<CocoaCalcTab> with AutomaticKeepAliveClientMixin {
  final _form = GlobalKey<FormState>();
  final _kg = TextEditingController(text: '100');
  final _humidity = TextEditingController(text: '7');
  final _defect = TextEditingController(text: '0');
  final _discount = TextEditingController(text: '0');
  final _transport = TextEditingController();
  bool _fermented = true;

  Json? _result;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_kg, _humidity, _defect, _discount, _transport]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _calculate() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      final result = await widget.session.api.calculateCocoa({
        'kg': parseDecimal(_kg.text) ?? 0,
        'humidity': parseDecimal(_humidity.text),
        'defectPct': parseDecimal(_defect.text) ?? 0,
        'fermented': _fermented,
        'buyerDiscountPct': parseDecimal(_discount.text) ?? 0,
        'transportCostCopKg': parseCop(_transport.text) ?? 0,
      });
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final r = _result;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 32),
      children: [
        SectionCard(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Muted('Partimos del precio semanal de referencia de la industria (Agronet) y lo ajustamos por tu grano.'),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: NumberField(controller: _kg, label: 'Kilos', suffix: 'kg', required: true, min: 1, max: 1000000),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NumberField(controller: _humidity, label: 'Humedad', hint: '7', suffix: '%', min: 0, max: 30),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: NumberField(controller: _defect, label: 'Defectuoso', hint: '0', suffix: '%', min: 0, max: 40),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NumberField(controller: _discount, label: 'Descuento', hint: '0', suffix: '%', min: 0, max: 50),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: _transport,
                  label: 'Transporte por kilo',
                  kind: NumberKind.cop,
                  hint: '0',
                  max: 100000,
                ),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Cacao fermentado'),
                  value: _fermented,
                  onChanged: (v) => setState(() => _fermented = v),
                ),
                const SizedBox(height: 8),
                BusyButton(label: 'Calcular', icon: Icons.calculate_rounded, busy: _busy, onPressed: _calculate),
              ],
            ),
          ),
        ),
        if (r != null) ..._results(r),
      ],
    );
  }

  List<Widget> _results(Json r) {
    final a = r['adjustments'] as Json;
    final humidityDelta = (a['humidityBonusCopPerKg'] as num) > 0
        ? (a['humidityBonusCopPerKg'] as num)
        : -(a['humidityLossCopPerKg'] as num);
    final rows = <(String, num)>[
      ('Humedad', humidityDelta),
      ('Grano defectuoso', -(a['defectLossCopPerKg'] as num)),
      ('Sin fermentar', -(a['fermentationLossCopPerKg'] as num)),
      ('Descuento del comprador', -(a['buyerDiscountCopPerKg'] as num)),
      ('Transporte', -(a['transportCopPerKg'] as num)),
    ].where((row) => row.$2.abs() >= 0.5).toList();

    return [
      const SectionLabel('Tu precio neto'),
      SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Muted('Te quedan por kilo'),
            const SizedBox(height: 4),
            Text(formatCop(r['netCopPerKg'] as num), style: mono(size: 30, weight: FontWeight.w600)),
            const SizedBox(height: 12),
            Muted('Total por ${decimalInputText(r['kg'] as num)} kg'),
            Text(formatCop(r['totalCop'] as num), style: mono(size: 20, weight: FontWeight.w600)),
            const Divider(height: 28),
            _row(
              'Precio de referencia',
              formatCop(r['referenceCopPerKg'] as num),
              r['referenceSource'] == 'agronet'
                  ? 'Lo que paga la industria (Agronet), semana del ${r['referenceWeekLabel']}'
                  : 'ICE ${formatCop(r['iceCopPerKg'] as num)}/kg × ${((r['farmgateFactor'] as num) * 100).round()}% (aún sin dato de Agronet)',
            ),
            for (final row in rows)
              _row(
                row.$1,
                '${row.$2 > 0 ? '+' : '−'}${formatCop(row.$2.abs())}',
                null,
                color: row.$2 > 0 ? AvColors.positive : AvColors.danger,
              ),
          ],
        ),
      ),
      const SizedBox(height: 8),
      const Muted(
        'Estimación orientativa: la referencia es el promedio semanal de la industria y los exportadores; '
        'cada comprador aplica sus propios descuentos.',
        size: 12,
      ),
    ];
  }

  Widget _row(String label, String value, String? detail, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (detail != null) Muted(detail, size: 12),
              ],
            ),
          ),
          Text(value, style: mono(size: 14, color: color ?? AvColors.fg)),
        ],
      ),
    );
  }
}
