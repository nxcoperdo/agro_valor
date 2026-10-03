import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';

/// Calculadora rápida por factor. No crea compras ni guarda nada: usa /coffee/calculator.
class CoffeeQuickCalcTab extends StatefulWidget {
  const CoffeeQuickCalcTab({super.key, required this.session});

  final Session session;

  @override
  State<CoffeeQuickCalcTab> createState() => _CoffeeQuickCalcTabState();
}

class _CoffeeQuickCalcTabState extends State<CoffeeQuickCalcTab> {
  final _form = GlobalKey<FormState>();
  final _kilos = TextEditingController();
  final _factor = TextEditingController();
  final _price = TextEditingController();
  Json? _result;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_kilos, _factor, _price]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _calc() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final r = await widget.session.api.coffeeQuickCalc({
        'kilos': parseDecimal(_kilos.text),
        'factor': parseDecimal(_factor.text),
        'precioCarga': parseCop(_price.text),
      });
      if (mounted) setState(() => _result = r);
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _result;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                NumberField(controller: _kilos, label: 'Cantidad (kg)', suffix: 'kg', required: true, min: 0.01),
                const SizedBox(height: 12),
                NumberField(controller: _factor, label: 'Factor de rendimiento', hint: 'Ej. 88', min: 1),
                const SizedBox(height: 12),
                NumberField(
                  controller: _price,
                  label: 'Precio por carga (125 kg)',
                  kind: NumberKind.cop,
                  required: true,
                  min: 1,
                ),
                const SizedBox(height: 16),
                BusyButton(label: 'Calcular', busy: _busy, onPressed: _calc, icon: Icons.calculate_rounded),
              ],
            ),
          ),
        ),
        if (r != null) ...[
          const SizedBox(height: 12),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (r['factorRendimientoTrilla'] != null) Muted(formatFactor(r['factorRendimientoTrilla'] as num)),
                Muted('Cargas: ${decimalInputText(r['numeroCargas'] as num)}'),
                Muted('Precio por kg: ${formatCop(r['precioKg'] as num)}'),
                const SizedBox(height: 8),
                const Muted('Valor total'),
                Text(formatCop(r['valorTotal'] as num), style: mono(size: 26, weight: FontWeight.w600, color: AvColors.accent)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
