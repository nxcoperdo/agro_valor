import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_invoice_form_screen.dart' show PartyPickerSheet, SupplierDetails;
import 'coffee_lots_tab.dart' show lotStatusLabel;
import 'coffee_sales_math.dart';

/// Una línea de la venta: un lote de inventario, cuántos kilos salen y a qué precio.
class _SaleLine {
  Json? lot;
  bool byKg = false;
  final kg = TextEditingController();
  final factor = TextEditingController();
  final price = TextEditingController();

  double get available => maxSellableKg(lot?['kgDisponibles'] as num?);

  double get _priceValue => (byKg ? parseDecimal(price.text) : parseCop(price.text)) ?? 0;

  int get subtotal => saleLineSubtotal(kg: kgOrZero(parseDecimal(kg.text)), price: _priceValue, byKg: byKg);

  bool get touched => lot != null || kg.text.isNotEmpty || factor.text.isNotEmpty || price.text.isNotEmpty;

  Json toPayload() => {
        'inventoryLotId': lot!['id'],
        'kg': parseDecimal(kg.text),
        'factor': factor.text.trim().isEmpty ? null : parseDecimal(factor.text),
        if (byKg) 'precioKg': parseDecimal(price.text) else 'precioCarga': parseCop(price.text),
      };

  void dispose() {
    kg.dispose();
    factor.dispose();
    price.dispose();
  }
}

/// Nueva venta: cliente, uno o varios lotes de inventario (cada uno con sus kilos y su precio por carga o por kilo)
/// y forma de pago. El total se ve siempre arriba, en la barra, mientras se llena el formulario.
class CoffeeSaleFormScreen extends StatefulWidget {
  const CoffeeSaleFormScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CoffeeSaleFormScreen> createState() => _CoffeeSaleFormScreenState();
}

class _CoffeeSaleFormScreenState extends State<CoffeeSaleFormScreen> {
  final _form = GlobalKey<FormState>();
  late Future<Json> _inventory = widget.api.coffeeInventory(onlyAvailable: true);
  late final List<_SaleLine> _lines = [_newLine()];

  /// Cliente ya registrado (se manda por id) o, si es null y [_creatingCustomer], uno nuevo.
  Json? _customer;
  bool _creatingCustomer = false;
  String _idType = 'NIT';
  final _idNumber = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();

  DateTime _soldOn = DateTime.now();
  String _payment = 'efectivo';
  final _reference = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;
  bool _saved = false;

  _SaleLine _newLine() {
    final line = _SaleLine();
    for (final c in [line.kg, line.factor, line.price]) {
      c.addListener(_refresh);
    }
    return line;
  }

  void _refresh() => setState(() {});

  /// Hay algo escrito que se perdería al salir.
  bool get _dirty =>
      _customer != null ||
      _creatingCustomer ||
      _reference.text.isNotEmpty ||
      _notes.text.isNotEmpty ||
      _lines.any((l) => l.touched);

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    for (final c in [_idNumber, _name, _phone, _reference, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<bool> _confirmDiscard() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Descartar la venta?'),
        content: const Text('Lo que escribiste no se ha guardado.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Seguir editando')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Descartar', style: TextStyle(color: AvColors.danger)),
          ),
        ],
      ),
    );
    return leave == true;
  }

  Future<void> _confirmAndLeave() async {
    if (!await _confirmDiscard() || !mounted) return;
    _saved = true; // ya se decidió salir
    Navigator.of(context).pop();
  }

  Future<void> _pickCustomer() async {
    final picked = await showModalBottomSheet<Json?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => PartyPickerSheet.customers(api: widget.api),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (picked['new'] == true) {
        _customer = null;
        _creatingCustomer = true;
      } else {
        _customer = picked;
        _creatingCustomer = false;
      }
    });
  }

  Future<void> _pickLot(_SaleLine line, List<Json> items) async {
    final used = {for (final l in _lines) if (!identical(l, line) && l.lot != null) l.lot!['id']};
    final options = items.where((i) => !used.contains(i['id'])).toList();
    final picked = await showModalBottomSheet<Json>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.7),
          child: options.isEmpty
              ? const Padding(padding: EdgeInsets.all(24), child: Muted('Ya elegiste todos los lotes disponibles.'))
              : ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: options.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final item = options[i];
                    final lot = item['lot'] as Json;
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(vertical: 4),
                      title: Text('${lot['code']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Muted(
                        '${formatKg(item['kgDisponibles'] as num?)} disponibles de ${formatKg(item['kgIniciales'] as num?)}'
                        ' · ${lotStatusLabel(item['status'] as String?)}',
                        size: 12,
                      ),
                      onTap: () => Navigator.pop(context, item),
                    );
                  },
                ),
        ),
      ),
    );
    if (picked != null && mounted) setState(() => line.lot = picked);
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

  void _addLine() => setState(() => _lines.add(_newLine()));

  void _removeLine(int i) {
    final l = _lines.removeAt(i);
    l.dispose();
    setState(() {});
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    if (_customer == null && !_creatingCustomer) {
      showMessage(context, 'Selecciona un cliente o crea uno nuevo', error: true);
      return;
    }
    if (_lines.any((l) => l.lot == null)) {
      showMessage(context, 'Elige el lote de cada línea', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final sale = await widget.api.coffeeCreateSale({
        if (_customer != null)
          'customerId': _customer!['id']
        else
          'customer': {
            'idType': _idType,
            'idNumber': _idNumber.text.trim(),
            'name': _name.text.trim(),
            'phone': _phone.text.trim(),
          },
        'soldOn': isoDay(_soldOn),
        'paymentMethod': _payment,
        'paymentReference': _reference.text.trim(),
        'notes': _notes.text.trim(),
        'items': [for (final l in _lines) l.toPayload()],
      });
      if (!mounted) return;
      _saved = true;
      Navigator.of(context).pop(sale['code']);
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _lines.fold<int>(0, (a, l) => a + l.subtotal);
    return PopScope(
      canPop: !_dirty || _saved,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmAndLeave();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Nueva venta'),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Semantics(
                  label: 'Total de la venta',
                  child: Text(formatCop(total), style: mono(size: 16, weight: FontWeight.w700, color: AvColors.accent)),
                ),
              ),
            ),
          ],
        ),
        body: FutureBuilder<Json>(
          future: _inventory,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ErrorMessage(
                message: '${snap.error}',
                onRetry: () => setState(() => _inventory = widget.api.coffeeInventory(onlyAvailable: true)),
              );
            }
            final items = (snap.data?['items'] as List<dynamic>? ?? const []).cast<Json>();
            if (items.isEmpty) return const _NoInventory();
            return _formBody(items, total);
          },
        ),
      ),
    );
  }

  Widget _formBody(List<Json> items, int total) {
    final canAddLine = _lines.length < items.length;
    return Form(
      key: _form,
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 32),
        children: [
          const SectionLabel('Cliente'),
          ..._customerSection(),
          const SectionLabel('Lotes a vender'),
          const Muted('Cada lote lleva sus kilos y su precio. Puedes vender parte de un lote.', size: 12),
          const SizedBox(height: 8),
          for (var i = 0; i < _lines.length; i++) ...[_lineCard(i, items), const SizedBox(height: 12)],
          OutlinedButton.icon(
            onPressed: canAddLine ? _addLine : null,
            icon: const Icon(Icons.add_rounded),
            label: Text(canAddLine ? 'Agregar otro lote' : 'No quedan más lotes disponibles'),
          ),
          const SectionLabel('Pago'),
          OutlinedButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.event_rounded),
            label: Text('Fecha de la venta: ${formatDate(isoDay(_soldOn))}'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _payment,
            decoration: const InputDecoration(labelText: 'Forma de pago'),
            items: [for (final e in paymentLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _payment = v ?? 'efectivo'),
          ),
          const SizedBox(height: 12),
          TextField(controller: _reference, decoration: const InputDecoration(labelText: 'Referencia (opcional)')),
          const SizedBox(height: 12),
          TextField(controller: _notes, decoration: const InputDecoration(labelText: 'Observaciones (opcional)')),
          const SizedBox(height: 16),
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Muted('${_lines.length} lote(s) · ${formatKg(_lines.fold<double>(0, (a, l) => a + kgOrZero(parseDecimal(l.kg.text))))}', size: 12),
                const SizedBox(height: 4),
                const Muted('TOTAL DE LA VENTA'),
                Text(formatCop(total), style: mono(size: 26, weight: FontWeight.w700, color: AvColors.accent)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          BusyButton(label: 'Registrar venta', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }

  List<Widget> _customerSection() {
    return [
      InkWell(
        onTap: _pickCustomer,
        borderRadius: BorderRadius.circular(12),
        child: InputDecorator(
          decoration: const InputDecoration(labelText: 'Cliente', suffixIcon: Icon(Icons.arrow_drop_down_rounded)),
          child: Text(
            _customer != null
                ? '${_customer!['name']}'
                : _creatingCustomer
                    ? 'Cliente nuevo'
                    : 'Toca para elegir de la lista',
            style: TextStyle(color: _customer == null && !_creatingCustomer ? AvColors.fgMuted : AvColors.fg),
          ),
        ),
      ),
      if (_customer != null) ...[const SizedBox(height: 8), SupplierDetails(supplier: _customer!)],
      if (_creatingCustomer) ...[
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _idType,
          decoration: const InputDecoration(labelText: 'Tipo de identificación'),
          items: [for (final t in idTypes) DropdownMenuItem(value: t, child: Text(t))],
          onChanged: (v) => setState(() => _idType = v ?? 'NIT'),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _idNumber,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Número de identificación'),
          validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Nombre del cliente'),
          validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Teléfono (opcional)'),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => setState(() => _creatingCustomer = false),
            child: const Text('Cancelar cliente nuevo'),
          ),
        ),
      ],
    ];
  }

  Widget _lineCard(int i, List<Json> items) {
    final line = _lines[i];
    final lot = line.lot;
    return SectionCard(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Lote ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700))),
              if (_lines.length > 1)
                IconButton(
                  tooltip: 'Quitar este lote',
                  onPressed: () => _removeLine(i),
                  icon: Icon(Icons.delete_outline_rounded, color: AvColors.fgMuted),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InkWell(
                  onTap: () => _pickLot(line, items),
                  borderRadius: BorderRadius.circular(12),
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Lote', suffixIcon: Icon(Icons.arrow_drop_down_rounded)),
                    child: Text(
                      lot == null
                          ? 'Toca para elegir el lote'
                          : '${(lot['lot'] as Json)['code']} · ${formatKg(lot['kgDisponibles'] as num?)} disp.',
                      style: TextStyle(color: lot == null ? AvColors.fgMuted : AvColors.fg),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: NumberField(
                        controller: line.kg,
                        label: 'Kilos a vender',
                        suffix: 'kg',
                        required: true,
                        min: 0.01,
                        max: lot == null ? null : line.available,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: OutlinedButton(
                        onPressed: lot == null ? null : () => line.kg.text = decimalInputText(line.available),
                        child: const Text('Todo'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                NumberField(controller: line.factor, label: 'Factor (opcional)', hint: 'Ej. 88', min: 1),
                const SizedBox(height: 12),
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(value: false, label: Text('Por carga')),
                    ButtonSegment(value: true, label: Text('Por kilo')),
                  ],
                  selected: {line.byKg},
                  onSelectionChanged: (s) {
                    line.price.clear(); // el valor de una unidad no sirve en la otra
                    setState(() => line.byKg = s.first);
                  },
                ),
                const SizedBox(height: 12),
                NumberField(
                  key: ValueKey('price-${line.byKg}'),
                  controller: line.price,
                  label: line.byKg ? 'Precio por kilo' : 'Precio por carga (125 kg)',
                  kind: line.byKg ? NumberKind.decimal : NumberKind.cop,
                  required: true,
                  min: 1,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Expanded(child: Muted('SUBTOTAL')),
                    Text(formatCop(line.subtotal), style: mono(size: 16, weight: FontWeight.w700)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Sin kilos en inventario no hay nada que vender: se explica y se dice dónde conseguirlos.
class _NoInventory extends StatelessWidget {
  const _NoInventory();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inventory_2_outlined, size: 48, color: AvColors.fgMuted),
            SizedBox(height: 16),
            Text('No hay inventario disponible para vender', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            SizedBox(height: 8),
            Muted('Cuando un lote termine su secado, mándalo a inventario desde la pestaña Lotes y aparecerá aquí.'),
          ],
        ),
      ),
    );
  }
}
