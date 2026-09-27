import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/forms.dart';

/// Cuánto le queda realmente al caficultor por carga según su café, y en qué cooperativa le conviene vender.
class CalculatorScreen extends StatelessWidget {
  const CalculatorScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      load: session.api.profile,
      builder: (context, profile) => _Calculator(session: session, profile: profile),
    );
  }
}

class _Calculator extends StatefulWidget {
  const _Calculator({required this.session, required this.profile});

  final Session session;
  final Json profile;

  @override
  State<_Calculator> createState() => _CalculatorState();
}

class _CalculatorState extends State<_Calculator> {
  final _form = GlobalKey<FormState>();
  late final _cargas = TextEditingController(text: '1');
  late final _factor = TextEditingController(text: decimalInputText(widget.profile['defaultFactor'] as num?));
  late final _humidity = TextEditingController(text: decimalInputText(widget.profile['defaultHumidity'] as num?));
  final _pasilla = TextEditingController();
  late final _transport = TextEditingController(text: copInputText(widget.profile['transportCostCopCarga'] as num?));

  Json? _result;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_cargas, _factor, _humidity, _pasilla, _transport]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _calculate() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      final result = await widget.session.api.calculate({
        'cargas': parseDecimal(_cargas.text) ?? 1,
        'factor': parseDecimal(_factor.text),
        'humidity': parseDecimal(_humidity.text),
        'pasillaPct': parseDecimal(_pasilla.text) ?? 0,
        'transportCostCopCarga': parseCop(_transport.text),
      });
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SectionCard(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Muted('La base de la FNC es café pergamino seco de factor 94 y 12% de humedad.'),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: NumberField(controller: _cargas, label: 'Cargas', required: true, min: 0.1, max: 10000),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: NumberField(controller: _factor, label: 'Factor', hint: '94', min: 60, max: 140)),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: NumberField(controller: _humidity, label: 'Humedad', hint: '12', suffix: '%', min: 0, max: 30),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: NumberField(controller: _pasilla, label: 'Pasilla', hint: '0', suffix: '%', min: 0, max: 40),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                NumberField(
                  controller: _transport,
                  label: 'Transporte por carga',
                  kind: NumberKind.cop,
                  hint: '0',
                  max: 1000000,
                ),
                const SizedBox(height: 16),
                BusyButton(label: 'Calcular', icon: Icons.calculate_rounded, busy: _busy, onPressed: _calculate),
              ],
            ),
          ),
        ),
        if (result != null) ..._results(result),
      ],
    );
  }

  List<Widget> _results(Json result) {
    final ref = result['againstReference'] as Json;
    final coops = (result['byCooperative'] as List<dynamic>? ?? const []).cast<Json>();
    final locked = result['locked'] == true;
    final cargas = (ref['inputs'] as Json)['cargas'] as num;
    final diffPct = ref['differenceVsBasePct'] as num;

    return [
      const SectionLabel('Con el precio de referencia FNC'),
      SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Muted('Te quedan por carga'),
            const SizedBox(height: 4),
            Text(formatCop(ref['netPerCarga'] as num), style: mono(size: 30, weight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              '${formatPct(diffPct)} frente a la base',
              style: mono(size: 13, color: diffPct >= 0 ? AvColors.positive : AvColors.danger),
            ),
            if (cargas != 1) ...[
              const SizedBox(height: 12),
              Muted('Total por ${decimalInputText(cargas)} cargas'),
              Text(formatCop(ref['total'] as num), style: mono(size: 20, weight: FontWeight.w600)),
            ],
            const Divider(height: 28),
            for (final step in (ref['breakdown'] as List<dynamic>).cast<Json>()) _BreakdownRow(step: step),
          ],
        ),
      ),
      if (locked) ...[
        const SectionLabel('¿Dónde te queda más plata?'),
        LockedTeaser(
          height: 220,
          preview: Column(
            children: [
              for (var i = 0; i < ((result['cooperativesCount'] as num?)?.toInt() ?? 3); i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _CoopResult(
                    coop: const {
                      'rank': 1,
                      'name': 'Cooperativa •••••••',
                      'isBest': false,
                      'lostVsBest': 999999,
                      'netPerCarga': 9999999,
                      'total': 9999999,
                    },
                    showTotal: false,
                  ),
                ),
            ],
          ),
          title: '¿Dónde te queda más plata?',
          body: result['maxDifferenceCop'] != null
              ? 'Hay ${formatCop(result['maxDifferenceCop'] as num)} de diferencia entre la mejor y la peor '
                  'de las ${result['cooperativesCount']} cooperativas para tu café.'
              : 'Activa Pro para ver en qué cooperativa te conviene vender.',
        ),
      ] else if (coops.isNotEmpty) ...[
        const SectionLabel('¿Dónde te queda más plata?'),
        for (final c in coops) ...[_CoopResult(coop: c, showTotal: cargas != 1), const SizedBox(height: 8)],
      ],
      const SizedBox(height: 8),
      Muted(ref['disclaimer'] as String? ?? '', size: 12),
    ];
  }
}

class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({required this.step});

  final Json step;

  @override
  Widget build(BuildContext context) {
    final delta = step['delta'] as num;
    final isBase = step['key'] == 'base';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(step['label'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Muted(step['detail'] as String, size: 12),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            isBase ? formatCop(step['amount'] as num) : '${delta >= 0 ? '+' : '−'}${formatCop(delta.abs())}',
            style: mono(
              size: 13,
              color: isBase || delta.round() == 0
                  ? AvColors.fg
                  : delta > 0
                      ? AvColors.positive
                      : AvColors.danger,
            ),
          ),
        ],
      ),
    );
  }
}

class _CoopResult extends StatelessWidget {
  const _CoopResult({required this.coop, required this.showTotal});

  final Json coop;
  final bool showTotal;

  @override
  Widget build(BuildContext context) {
    final best = coop['isBest'] == true;
    final lost = coop['lostVsBest'] as num;
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: best ? AvColors.accent : AvColors.border, width: best ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: best ? AvColors.accent : AvColors.surfaceAlt,
              child: Text(
                '${coop['rank']}',
                style: TextStyle(color: best ? AvColors.onAccent : AvColors.fg, fontWeight: FontWeight.w700, fontSize: 12),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(coop['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (best)
                    const Muted('La mejor opción para tu café', size: 12)
                  else
                    Text('Dejas de ganar ${formatCop(lost)}', style: const TextStyle(fontSize: 12, color: AvColors.danger)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(formatCop(coop['netPerCarga'] as num), style: mono(size: 14, weight: FontWeight.w600)),
                if (showTotal) Text(formatCop(coop['total'] as num), style: mono(size: 12, color: AvColors.fgMuted)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
