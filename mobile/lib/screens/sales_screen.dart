import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/cooperative_picker.dart';
import '../widgets/forms.dart';

/// Historial de ventas comparado contra el precio de referencia de cada día.
class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key, required this.session});

  final Session session;

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  Key _viewKey = UniqueKey();

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  Future<void> _newSale() async {
    final created = await showFormSheet<bool>(context, title: 'Registrar venta', child: _NewSaleForm(api: _api));
    if (created == true) {
      if (mounted) showMessage(context, 'Venta registrada');
      _reload();
    }
  }

  Future<void> _delete(Json sale) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Eliminar esta venta?'),
        content: Text('${decimalInputText(sale['cargas'] as num)} cargas del ${formatDate(sale['soldOn'] as String?)}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Eliminar')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.deleteSale(sale['id'] as int);
      _reload();
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pro = widget.session.isPro;
    return Scaffold(
      appBar: AppBar(title: const Text('Mis ventas')),
      floatingActionButton: pro
          ? FloatingActionButton.extended(
              onPressed: _newSale,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Registrar venta'),
            )
          : null,
      body: !pro
          ? const ProUpsell(
              title: 'Historial de ventas',
              body: 'Anota cada venta y mira si vendiste por encima o por debajo del precio de referencia de ese día.',
              icon: Icons.receipt_long_rounded,
            )
          : AsyncView<Json>(
              key: _viewKey,
              load: _api.sales,
              builder: (context, data) => _body(data),
            ),
    );
  }

  Widget _body(Json data) {
    final sales = (data['sales'] as List<dynamic>? ?? const []).cast<Json>();
    final summary = data['summary'] as Json? ?? const {};
    final vsRef = summary['totalVsReference'] as num? ?? 0;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        if (sales.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 24),
            child: Muted('Todavía no has registrado ventas. Anota la próxima para ver cómo te fue frente a la referencia.'),
          )
        else ...[
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Muted('Ingresos registrados'),
                Text(formatCop(summary['totalIncome'] as num?), style: mono(size: 26, weight: FontWeight.w600)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _Stat(label: 'Cargas', value: decimalInputText(summary['totalCargas'] as num?)),
                    _Stat(label: 'Promedio por carga', value: formatCop(summary['avgPrice'] as num?)),
                  ],
                ),
                if ((summary['comparableCount'] as num? ?? 0) > 0) ...[
                  const Divider(height: 24),
                  Text(
                    vsRef >= 0
                        ? 'Vendiste ${formatCop(vsRef)} por encima de la referencia'
                        : 'Vendiste ${formatCop(vsRef.abs())} por debajo de la referencia',
                    style: TextStyle(color: vsRef >= 0 ? AvColors.positive : AvColors.danger, fontWeight: FontWeight.w600),
                  ),
                ],
              ],
            ),
          ),
          const SectionLabel('Ventas'),
          for (final s in sales) ...[_SaleTile(sale: s, onDelete: () => _delete(s)), const SizedBox(height: 8)],
        ],
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [Muted(label, size: 12), Text(value, style: mono(size: 15))],
        ),
      );
}

class _SaleTile extends StatelessWidget {
  const _SaleTile({required this.sale, required this.onDelete});

  final Json sale;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final pct = sale['vsReferencePct'] as num?;
    final details = [
      '${decimalInputText(sale['cargas'] as num)} cargas',
      if (sale['factor'] != null) 'factor ${decimalInputText(sale['factor'] as num)}',
      if (sale['humidity'] != null) '${decimalInputText(sale['humidity'] as num)}% hum.',
    ].join(' · ');

    return SectionCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sale['cooperativeName'] as String? ?? 'Sin cooperativa',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Muted('${formatDate(sale['soldOn'] as String?)} · $details', size: 12),
                if (sale['notes'] != null) Muted(sale['notes'] as String, size: 12),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatCop(sale['priceCopCarga'] as num), style: mono(size: 14, weight: FontWeight.w600)),
              if (pct != null)
                Text(
                  '${formatPct(pct)} vs ref.',
                  style: mono(size: 12, color: pct >= 0 ? AvColors.positive : AvColors.danger),
                ),
            ],
          ),
          IconButton(
            tooltip: 'Eliminar',
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded, color: AvColors.fgMuted),
          ),
        ],
      ),
    );
  }
}

class _NewSaleForm extends StatefulWidget {
  const _NewSaleForm({required this.api});

  final ApiClient api;

  @override
  State<_NewSaleForm> createState() => _NewSaleFormState();
}

class _NewSaleFormState extends State<_NewSaleForm> {
  final _form = GlobalKey<FormState>();
  final _cargas = TextEditingController();
  final _price = TextEditingController();
  final _factor = TextEditingController();
  final _humidity = TextEditingController();
  final _notes = TextEditingController();
  late final Future<Json> _coops = widget.api.cooperatives();
  int? _coopId;
  DateTime _soldOn = DateTime.now();
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_cargas, _price, _factor, _humidity, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _soldOn,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _soldOn = picked);
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await widget.api.createSale({
        'cooperativeId': _coopId,
        'cargas': parseDecimal(_cargas.text),
        'priceCopCarga': parseCop(_price.text),
        'factor': parseDecimal(_factor.text),
        'humidity': parseDecimal(_humidity.text),
        'soldOn': isoDay(_soldOn),
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CooperativePicker(future: _coops, value: _coopId, onChanged: (id) => setState(() => _coopId = id)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: NumberField(controller: _cargas, label: 'Cargas', required: true, min: 0.01)),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.event_rounded, size: 18),
                  label: Text(formatDate(isoDay(_soldOn))),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(56),
                    foregroundColor: AvColors.fg,
                    side: const BorderSide(color: AvColors.border),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          NumberField(controller: _price, label: 'Precio que te pagaron por carga', kind: NumberKind.cop, required: true, min: 1),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: NumberField(controller: _factor, label: 'Factor (opcional)', min: 60, max: 140)),
              const SizedBox(width: 12),
              Expanded(child: NumberField(controller: _humidity, label: 'Humedad', suffix: '%', min: 0, max: 30)),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(controller: _notes, decoration: const InputDecoration(labelText: 'Notas (opcional)')),
          const SizedBox(height: 20),
          BusyButton(label: 'Guardar venta', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}
