import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_math.dart';

/// Compra de producto (café, cacao, pasilla, maíz, frijol): jornada actual, historial y nueva compra con varias pesadas.
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
    final created = await showFormSheet<bool>(context, title: 'Nueva compra de producto', child: _NewPurchaseForm(api: _api));
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
  List<ProductType> _types = kProductTypes;
  String _type = 'cafe';
  bool _requiresDrying = true;
  bool _priceByKg = false;
  String _payment = 'efectivo';
  bool _busy = false;

  /// Proveedor ya registrado (se manda por id) o, si es null y [_creatingSupplier], uno nuevo.
  Json? _supplier;
  bool _creatingSupplier = false;

  ProductType get _typeInfo => _types.firstWhere((t) => t.key == _type, orElse: () => _types.first);

  @override
  void initState() {
    super.initState();
    for (final c in [_merma, _price]) {
      c.addListener(_refresh);
    }
    _weighings.first.addListener(_refresh);
    // Los tipos de producto los define el servidor; si falla la carga queda el respaldo local.
    widget.api.coffeeProductTypes().then((r) {
      final list = (r['productTypes'] as List<dynamic>? ?? const [])
          .map((e) => ProductType.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted && list.isNotEmpty) setState(() => _types = list);
    }).catchError((_) {});
  }

  Future<void> _pickSupplier() async {
    final picked = await showModalBottomSheet<Json?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _SupplierSheet(api: widget.api),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (picked['new'] == true) {
        _supplier = null;
        _creatingSupplier = true;
      } else {
        _supplier = picked;
        _creatingSupplier = false;
      }
    });
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
        precioCarga: _priceByKg ? 0 : parseCop(_price.text) ?? 0,
        precioKg: _priceByKg ? parseDecimal(_price.text) ?? 0 : null,
      );

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    if (_supplier == null && !_creatingSupplier) {
      showMessage(context, 'Selecciona un proveedor o crea uno nuevo', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.api.coffeeCreatePurchase({
        if (_supplier != null)
          'supplierId': _supplier!['id']
        else
          'supplier': {'idNumber': _idNumber.text.trim(), 'name': _name.text.trim()},
        'productType': _type,
        'requiresDrying': _requiresDrying,
        'porcentajeMermaInicial': parseDecimal(_merma.text),
        'weighings': [for (final c in _weighings) {'pesoKg': parseDecimal(c.text)}],
        if (_priceByKg) 'precioKg': parseDecimal(_price.text) else 'precioCarga': parseCop(_price.text),
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
          // Al tocar se despliega la lista de proveedores registrados, en orden alfabético.
          InkWell(
            onTap: _pickSupplier,
            borderRadius: BorderRadius.circular(12),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Proveedor',
                suffixIcon: Icon(Icons.arrow_drop_down_rounded),
              ),
              child: Text(
                _supplier != null
                    ? '${_supplier!['name']}'
                    : _creatingSupplier
                        ? 'Proveedor nuevo'
                        : 'Toca para elegir de la lista',
                style: TextStyle(color: _supplier == null && !_creatingSupplier ? AvColors.fgMuted : AvColors.fg),
              ),
            ),
          ),
          if (_creatingSupplier) ...[
            const SizedBox(height: 12),
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
          ],
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _type,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Tipo de producto (café, cacao, pasilla de café, maíz, frijol)'),
            items: [for (final t in _types) DropdownMenuItem(value: t.key, child: Text(t.label))],
            onChanged: (v) {
              if (v == null) return;
              setState(() {
                _type = v;
                _merma.text = decimalInputText(_typeInfo.merma);
                _requiresDrying = _typeInfo.requiresDrying;
              });
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('¿Requiere secado?'),
            subtitle: Text(
              _requiresDrying
                  ? 'Pasa por secado antes de entrar a inventario.'
                  : 'No se seca: la proyección es directa al 100 % y va a inventario.',
              style: const TextStyle(fontSize: 12),
            ),
            value: _requiresDrying,
            onChanged: (v) => setState(() => _requiresDrying = v),
          ),
          const SizedBox(height: 4),
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
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Por carga (125 kg)')),
              ButtonSegment(value: true, label: Text('Por kilogramo')),
            ],
            selected: {_priceByKg},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() {
              _priceByKg = s.first;
              _price.clear();
            }),
          ),
          const SizedBox(height: 12),
          NumberField(
            controller: _price,
            label: _priceByKg ? 'Precio por kilogramo' : 'Precio por carga (125 kg)',
            kind: _priceByKg ? NumberKind.decimal : NumberKind.cop,
            required: true,
            min: _priceByKg ? 0.01 : 1,
          ),
          if (_priceByKg)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Muted('Equivale a ${formatCop(p.precioKg * cargaKgBase)} por carga de $cargaKgBase kg', size: 12),
            ),
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

/// Lista de proveedores registrados en orden alfabético (el servidor ya la entrega ordenada).
/// Al escribir se filtra; "Proveedor nuevo" devuelve {'new': true}.
class _SupplierSheet extends StatefulWidget {
  const _SupplierSheet({required this.api});

  final ApiClient api;

  @override
  State<_SupplierSheet> createState() => _SupplierSheetState();
}

class _SupplierSheetState extends State<_SupplierSheet> {
  final _query = TextEditingController();
  late Future<Json> _future = widget.api.coffeeSearchSuppliers('');

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _search(String q) => setState(() => _future = widget.api.coffeeSearchSuppliers(q.trim()));

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _query,
              autofocus: false,
              onChanged: _search,
              decoration: const InputDecoration(labelText: 'Buscar proveedor', prefixIcon: Icon(Icons.search_rounded)),
            ),
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.person_add_alt_1_rounded, color: AvColors.accent),
              title: const Text('Proveedor nuevo'),
              onTap: () => Navigator.pop(context, <String, dynamic>{'new': true}),
            ),
            const Divider(height: 1),
            Expanded(
              child: FutureBuilder<Json>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) return Center(child: Muted('${snap.error}'));
                  final list = (snap.data?['suppliers'] as List<dynamic>? ?? const []).cast<Json>();
                  if (list.isEmpty) {
                    return Center(
                      child: Muted(_query.text.trim().isEmpty ? 'Todavía no hay proveedores registrados.' : 'Sin resultados.'),
                    );
                  }
                  return ListView.builder(
                    itemCount: list.length,
                    itemBuilder: (context, i) {
                      final s = list[i];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${s['name']}'),
                        subtitle: Text('${s['idType'] ?? ''} ${s['idNumber'] ?? ''}'.trim()),
                        onTap: () => Navigator.pop(context, s),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
