import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_math.dart';

/// Compras de café: jornada actual, historial y nueva compra con varias pesadas.
class CoffeePurchasesTab extends StatefulWidget {
  const CoffeePurchasesTab({super.key, required this.session});

  final Session session;

  @override
  State<CoffeePurchasesTab> createState() => _CoffeePurchasesTabState();
}

class _CoffeePurchasesTabState extends State<CoffeePurchasesTab> {
  Key _viewKey = UniqueKey();

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  Future<List<Json>> _load() async {
    final results = await Future.wait([_api.coffeePurchases(), _api.coffeeCurrentWorkday()]);
    return [results[0], results[1]];
  }

  Future<void> _newPurchase() async {
    final created = await showFormSheet<bool>(context, title: 'Nueva compra', child: _NewPurchaseForm(api: _api));
    if (created == true) {
      if (mounted) showMessage(context, 'Compra registrada');
      _reload();
    }
  }

  Future<void> _void(Json p) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Anular ${p['code']}'),
        content: TextField(controller: controller, decoration: const InputDecoration(labelText: 'Motivo (obligatorio)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Anular')),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) return;
    try {
      await _api.coffeeVoidPurchase(p['id'] as int, reason);
      _reload();
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newPurchase,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva compra'),
      ),
      body: AsyncView<List<Json>>(
        key: _viewKey,
        load: _load,
        builder: (context, data) {
          final purchases = (data[0]['purchases'] as List<dynamic>? ?? const []).cast<Json>();
          final workday = data[1];
          final summary = workday['summary'] as Json? ?? const {};
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(child: Text('Jornada ${workday['code']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                      Pill(label: '${workday['status']}'),
                    ]),
                    const SizedBox(height: 8),
                    Muted('${summary['compras']} compras · ${summary['proveedores']} proveedores · ${summary['pesadas']} pesadas', size: 12),
                    Text(formatCop(summary['totalPagado'] as num?), style: mono(size: 22, weight: FontWeight.w600)),
                    Muted('${formatKg(summary['kgRecibidos'] as num?)} recibidos · ${formatKg(summary['kgPagables'] as num?)} pagables', size: 12),
                  ],
                ),
              ),
              const SectionLabel('Historial'),
              if (purchases.isEmpty) const Muted('Aún no hay compras registradas.'),
              for (final p in purchases) ...[_PurchaseTile(purchase: p, onVoid: () => _void(p)), const SizedBox(height: 8)],
            ],
          );
        },
      ),
    );
  }
}

class _PurchaseTile extends StatelessWidget {
  const _PurchaseTile({required this.purchase, required this.onVoid});

  final Json purchase;
  final VoidCallback onVoid;

  @override
  Widget build(BuildContext context) {
    final voided = purchase['status'] == 'ANULADA';
    final supplier = purchase['supplier'] as Json;
    final lot = purchase['lot'] as Json?;
    return Opacity(
      opacity: voided ? 0.55 : 1,
      child: SectionCard(
        padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${purchase['code']} · ${supplier['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  Muted(
                    '${formatKg(purchase['pesoTotalCompra'] as num?)} → ${formatKg(purchase['pesoPagable'] as num?)} pagables'
                    '${lot != null ? ' · ${lot['code']}' : ''}${voided ? ' · ANULADA' : ''}',
                    size: 12,
                  ),
                ],
              ),
            ),
            Text(formatCop(purchase['totalCompra'] as num?), style: mono(size: 14, weight: FontWeight.w600)),
            if (!voided)
              IconButton(
                tooltip: 'Anular',
                onPressed: onVoid,
                icon: const Icon(Icons.block_rounded, color: AvColors.fgMuted),
              ),
          ],
        ),
      ),
    );
  }
}

class _NewPurchaseForm extends StatefulWidget {
  const _NewPurchaseForm({required this.api});

  final ApiClient api;

  @override
  State<_NewPurchaseForm> createState() => _NewPurchaseFormState();
}

class _NewPurchaseFormState extends State<_NewPurchaseForm> {
  final _form = GlobalKey<FormState>();
  final _idNumber = TextEditingController();
  final _name = TextEditingController();
  final _merma = TextEditingController(text: '8');
  final _price = TextEditingController();
  final List<TextEditingController> _weighings = [TextEditingController()];
  String _type = 'cafe_verde';
  String _payment = 'efectivo';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_merma, _price]) {
      c.addListener(_refresh);
    }
    _weighings.first.addListener(_refresh);
  }

  @override
  void dispose() {
    for (final c in [_idNumber, _name, _merma, _price, ..._weighings]) {
      c.dispose();
    }
    super.dispose();
  }

  void _refresh() => setState(() {});

  void _addWeighing() {
    final c = TextEditingController()..addListener(_refresh);
    setState(() => _weighings.add(c));
  }

  void _removeWeighing(int i) {
    final c = _weighings.removeAt(i);
    c.dispose();
    setState(() {});
  }

  PurchasePreview get _preview => previewPurchase(
        pesadasKg: [for (final c in _weighings) parseDecimal(c.text) ?? 0],
        mermaPct: parseDecimal(_merma.text) ?? 0,
        precioCarga: parseCop(_price.text) ?? 0,
      );

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await widget.api.coffeeCreatePurchase({
        'supplier': {'idNumber': _idNumber.text.trim(), 'name': _name.text.trim()},
        'coffeeType': _type,
        'porcentajeMermaInicial': parseDecimal(_merma.text),
        'weighings': [for (final c in _weighings) {'pesoKg': parseDecimal(c.text)}],
        'precioCarga': parseCop(_price.text),
        'paymentMethod': _payment,
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
    final p = _preview;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _idNumber,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Identificación del proveedor'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Nombre del proveedor'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _type,
            decoration: const InputDecoration(labelText: 'Tipo de café'),
            items: [
              for (final e in nombreTipoCafe.entries) DropdownMenuItem(value: e.key, child: Text(e.value)),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() {
                _type = v;
                _merma.text = decimalInputText(mermaPorTipo[v]);
              });
            },
          ),
          const SizedBox(height: 12),
          NumberField(controller: _merma, label: 'Merma inicial (%)', suffix: '%', required: true, min: 0, max: 100),
          const SectionLabel('Pesadas'),
          for (var i = 0; i < _weighings.length; i++) ...[
            Row(
              children: [
                Expanded(
                  child: NumberField(controller: _weighings[i], label: 'Pesada ${i + 1} (kg)', suffix: 'kg', required: true, min: 0.01),
                ),
                if (_weighings.length > 1)
                  IconButton(tooltip: 'Quitar pesada', onPressed: () => _removeWeighing(i), icon: const Icon(Icons.close_rounded)),
              ],
            ),
            const SizedBox(height: 8),
          ],
          TextButton.icon(onPressed: _addWeighing, icon: const Icon(Icons.add_rounded), label: const Text('Agregar pesada')),
          const SizedBox(height: 8),
          NumberField(controller: _price, label: 'Precio por carga (125 kg)', kind: NumberKind.cop, required: true, min: 1),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _payment,
            decoration: const InputDecoration(labelText: 'Forma de pago'),
            items: const [
              DropdownMenuItem(value: 'efectivo', child: Text('Efectivo')),
              DropdownMenuItem(value: 'transferencia', child: Text('Transferencia')),
              DropdownMenuItem(value: 'credito', child: Text('Crédito')),
              DropdownMenuItem(value: 'otro', child: Text('Otro')),
            ],
            onChanged: (v) => setState(() => _payment = v ?? 'efectivo'),
          ),
          const SizedBox(height: 16),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Muted('Kg recibidos ${formatKg(p.pesoTotal)} · descuento ${formatKg(p.kgDescontados)}', size: 12),
                const SizedBox(height: 4),
                const Muted('PESO PAGABLE'),
                Text(formatKg(p.pesoPagable), style: mono(size: 24, weight: FontWeight.w700, color: AvColors.accent)),
                const SizedBox(height: 4),
                const Muted('TOTAL A PAGAR'),
                Text(formatCop(p.totalPagar), style: mono(size: 24, weight: FontWeight.w700, color: AvColors.accent)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          BusyButton(label: 'Registrar compra', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}
