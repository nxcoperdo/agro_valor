import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_math.dart';
import 'coffee_sales_math.dart';

/// Un producto de la factura con sus campos en edición.
class _LineDraft {
  _LineDraft(ProductType t) : type = t.key, requiresDrying = t.requiresDrying {
    merma.text = decimalInputText(t.merma);
  }

  String type;
  bool requiresDrying;
  bool priceByKg = false;
  final merma = TextEditingController();
  final price = TextEditingController();
  final List<TextEditingController> weighings = [TextEditingController()];

  PurchasePreview get preview => previewPurchase(
        pesadasKg: [for (final c in weighings) parseDecimal(c.text) ?? 0],
        mermaPct: parseDecimal(merma.text) ?? 0,
        precioCarga: priceByKg ? 0 : parseCop(price.text) ?? 0,
        precioKg: priceByKg ? parseDecimal(price.text) ?? 0 : null,
      );

  Json toPayload() => {
        'productType': type,
        'requiresDrying': requiresDrying,
        'porcentajeMermaInicial': parseDecimal(merma.text),
        'weighings': [for (final c in weighings) {'pesoKg': parseDecimal(c.text)}],
        if (priceByKg) 'precioKg': parseDecimal(price.text) else 'precioCarga': parseCop(price.text),
      };

  void dispose() {
    merma.dispose();
    price.dispose();
    for (final c in weighings) {
      c.dispose();
    }
  }
}

/// Nueva compra como factura: proveedor completo, uno o varios productos (cada uno con su precio)
/// y forma de pago. Al registrar, la factura queda lista para clasificarse en lotes.
class CoffeeInvoiceFormScreen extends StatefulWidget {
  const CoffeeInvoiceFormScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CoffeeInvoiceFormScreen> createState() => _CoffeeInvoiceFormScreenState();
}

class _CoffeeInvoiceFormScreenState extends State<CoffeeInvoiceFormScreen> {
  final _form = GlobalKey<FormState>();
  List<ProductType> _types = kProductTypes;
  late final List<_LineDraft> _lines = [_newLine()];
  String _payment = 'efectivo';
  final _reference = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;

  /// Proveedor ya registrado (se manda por id) o, si es null y [_creatingSupplier], uno nuevo.
  Json? _supplier;
  bool _creatingSupplier = false;
  String _idType = 'CC';
  final _idNumber = TextEditingController();
  final _name = TextEditingController();
  final _legalName = TextEditingController();
  final _phone = TextEditingController();
  final _municipality = TextEditingController();
  final _address = TextEditingController();
  final _supplierNotes = TextEditingController();

  _LineDraft _newLine() {
    final line = _LineDraft(_types.first);
    line.merma.addListener(_refresh);
    line.price.addListener(_refresh);
    line.weighings.first.addListener(_refresh);
    return line;
  }

  void _refresh() => setState(() {});

  ProductType _typeOf(String key) => _types.firstWhere((t) => t.key == key, orElse: () => _types.first);

  @override
  void initState() {
    super.initState();
    // Los tipos de producto los define el servidor; si falla la carga queda el respaldo local.
    widget.api.coffeeProductTypes().then((r) {
      final list = (r['productTypes'] as List<dynamic>? ?? const [])
          .map((e) => ProductType.fromJson(e as Map<String, dynamic>))
          .toList();
      if (mounted && list.isNotEmpty) setState(() => _types = list);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    for (final c in [_reference, _notes, _idNumber, _name, _legalName, _phone, _municipality, _address, _supplierNotes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickSupplier() async {
    final picked = await showModalBottomSheet<Json?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => PartyPickerSheet.suppliers(api: widget.api),
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

  void _addLine() => setState(() => _lines.add(_newLine()));

  void _removeLine(int i) {
    final l = _lines.removeAt(i);
    l.dispose();
    setState(() {});
  }

  void _addWeighing(_LineDraft line) {
    final c = TextEditingController()..addListener(_refresh);
    setState(() => line.weighings.add(c));
  }

  void _removeWeighing(_LineDraft line, int j) {
    final c = line.weighings.removeAt(j);
    c.dispose();
    setState(() {});
  }

  Json _supplierPayload() => {
        'idType': _idType,
        'idNumber': _idNumber.text.trim(),
        'name': _name.text.trim(),
        'legalName': _legalName.text.trim(),
        'phone': _phone.text.trim(),
        'municipality': _municipality.text.trim(),
        'address': _address.text.trim(),
        'notes': _supplierNotes.text.trim(),
      };

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    if (_supplier == null && !_creatingSupplier) {
      showMessage(context, 'Selecciona un proveedor o crea uno nuevo', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.api.coffeeCreateInvoice({
        if (_supplier != null) 'supplierId': _supplier!['id'] else 'supplier': _supplierPayload(),
        'paymentMethod': _payment,
        'paymentReference': _reference.text.trim(),
        'notes': _notes.text.trim(),
        'items': [for (final l in _lines) l.toPayload()],
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
    final totalPagable = _lines.fold<double>(0, (a, l) => a + l.preview.pesoPagable);
    final total = _lines.fold<int>(0, (a, l) => a + l.preview.totalPagar);

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva compra')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const SectionLabel('Proveedor'),
            ..._supplierSection(),
            const SectionLabel('Productos'),
            const Muted(
              'Si el cliente trae varios productos, agrégalos: cada uno lleva su pesada, su precio y su subtotal, como una factura.',
              size: 12,
            ),
            const SizedBox(height: 8),
            for (var i = 0; i < _lines.length; i++) ...[_lineCard(i), const SizedBox(height: 12)],
            OutlinedButton.icon(
              onPressed: _addLine,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Agregar otro producto'),
            ),
            const SectionLabel('Pago'),
            DropdownButtonFormField<String>(
              initialValue: _payment,
              decoration: const InputDecoration(labelText: 'Forma de pago'),
              items: [for (final e in paymentLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() => _payment = v ?? 'efectivo'),
            ),
            const SizedBox(height: 12),
            TextField(controller: _reference, decoration: const InputDecoration(labelText: 'Referencia')),
            const SizedBox(height: 12),
            TextField(controller: _notes, decoration: const InputDecoration(labelText: 'Observaciones')),
            const SizedBox(height: 16),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Muted('${_lines.length} producto(s)', size: 12),
                  const SizedBox(height: 4),
                  const Muted('PESO PAGABLE'),
                  Text(formatKg(totalPagable), style: mono(size: 22, weight: FontWeight.w700, color: AvColors.accent)),
                  const SizedBox(height: 4),
                  const Muted('TOTAL A PAGAR'),
                  Text(formatCop(total), style: mono(size: 24, weight: FontWeight.w700, color: AvColors.accent)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            BusyButton(label: 'Registrar compra', busy: _busy, onPressed: _save),
          ],
        ),
      ),
    );
  }

  List<Widget> _supplierSection() {
    return [
      // Al tocar se despliega la lista de proveedores registrados, en orden alfabético.
      InkWell(
        onTap: _pickSupplier,
        borderRadius: BorderRadius.circular(12),
        child: InputDecorator(
          decoration: const InputDecoration(labelText: 'Proveedor', suffixIcon: Icon(Icons.arrow_drop_down_rounded)),
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
      if (_supplier != null) ...[const SizedBox(height: 8), SupplierDetails(supplier: _supplier!)],
      if (_creatingSupplier) ...[
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _idType,
          decoration: const InputDecoration(labelText: 'Tipo de identificación'),
          items: [for (final t in idTypes) DropdownMenuItem(value: t, child: Text(t))],
          onChanged: (v) => setState(() => _idType = v ?? 'CC'),
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
          decoration: const InputDecoration(labelText: 'Nombre'),
          validator: (v) => (v == null || v.trim().isEmpty) ? 'Obligatorio' : null,
        ),
        const SizedBox(height: 12),
        TextField(controller: _legalName, decoration: const InputDecoration(labelText: 'Razón social')),
        const SizedBox(height: 12),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Teléfono'),
        ),
        const SizedBox(height: 12),
        TextField(controller: _municipality, decoration: const InputDecoration(labelText: 'Municipio')),
        const SizedBox(height: 12),
        TextField(controller: _address, decoration: const InputDecoration(labelText: 'Dirección')),
        const SizedBox(height: 12),
        TextField(controller: _supplierNotes, decoration: const InputDecoration(labelText: 'Observaciones')),
      ],
    ];
  }

  Widget _lineCard(int i) {
    final line = _lines[i];
    final p = line.preview;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Producto ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700))),
              if (_lines.length > 1)
                TextButton(onPressed: () => _removeLine(i), child: const Text('Quitar')),
            ],
          ),
          DropdownButtonFormField<String>(
            initialValue: line.type,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Tipo de producto (café, cacao, pasilla de café, maíz, frijol)'),
            items: [for (final t in _types) DropdownMenuItem(value: t.key, child: Text(t.label))],
            onChanged: (v) {
              if (v == null) return;
              setState(() {
                line.type = v;
                line.merma.text = decimalInputText(_typeOf(v).merma);
                line.requiresDrying = _typeOf(v).requiresDrying;
              });
            },
          ),
          const SizedBox(height: 12),
          NumberField(controller: line.merma, label: 'Merma inicial (%)', suffix: '%', required: true, min: 0, max: 100),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('¿Requiere secado?'),
            subtitle: Text(
              line.requiresDrying
                  ? 'Pasa por secado antes de entrar a inventario.'
                  : 'No se seca: la proyección es directa al 100 % y va a inventario.',
              style: const TextStyle(fontSize: 12),
            ),
            value: line.requiresDrying,
            onChanged: (v) => setState(() => line.requiresDrying = v),
          ),
          for (var j = 0; j < line.weighings.length; j++) ...[
            Row(
              children: [
                Expanded(
                  child: NumberField(
                    controller: line.weighings[j],
                    label: 'Pesada ${j + 1} (kg)',
                    suffix: 'kg',
                    required: true,
                    min: 0.01,
                  ),
                ),
                if (line.weighings.length > 1)
                  IconButton(
                    tooltip: 'Quitar pesada',
                    onPressed: () => _removeWeighing(line, j),
                    icon: const Icon(Icons.close_rounded),
                  ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _addWeighing(line),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Agregar pesada'),
            ),
          ),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Por carga (125 kg)')),
              ButtonSegment(value: true, label: Text('Por kilogramo')),
            ],
            selected: {line.priceByKg},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() {
              line.priceByKg = s.first;
              line.price.clear();
            }),
          ),
          const SizedBox(height: 12),
          NumberField(
            controller: line.price,
            label: line.priceByKg ? 'Precio por kilogramo' : 'Precio por carga (125 kg)',
            kind: line.priceByKg ? NumberKind.decimal : NumberKind.cop,
            required: true,
            min: line.priceByKg ? 0.01 : 1,
          ),
          const SizedBox(height: 8),
          Muted(
            'Kg pagables ${formatKg(p.pesoPagable)} · precio por kg ${formatCop(p.precioKg)}',
            size: 12,
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Expanded(child: Muted('SUBTOTAL')),
              Text(formatCop(p.totalPagar), style: mono(size: 18, weight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Todos los datos de un proveedor registrado (los que el servidor guarda).
class SupplierDetails extends StatelessWidget {
  const SupplierDetails({super.key, required this.supplier});

  final Json supplier;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String?)>[
      ('Identificación', '${supplier['idType'] ?? ''} ${supplier['idNumber'] ?? ''}'.trim()),
      ('Razón social', supplier['legalName'] as String?),
      ('Teléfono', supplier['phone'] as String?),
      ('Municipio', supplier['municipality'] as String?),
      ('Dirección', supplier['address'] as String?),
      ('Observación', supplier['notes'] as String?),
    ].where((r) => r.$2 != null && r.$2!.trim().isNotEmpty).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 1),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: '${r.$1}: ', style: const TextStyle(color: AvColors.fgMuted, fontSize: 12)),
                  TextSpan(text: r.$2!, style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Lista de personas registradas (proveedores o clientes) con todos sus datos. Al escribir se filtra;
/// la fila de "nuevo" devuelve {'new': true}. [search] consulta al servidor y [listKey] es la clave de la lista
/// en su respuesta ('suppliers' o 'customers').
class PartyPickerSheet extends StatefulWidget {
  const PartyPickerSheet({
    super.key,
    required this.search,
    required this.listKey,
    required this.searchLabel,
    required this.newLabel,
    required this.noneLabel,
  });

  /// Proveedores de compras.
  PartyPickerSheet.suppliers({Key? key, required ApiClient api})
      : this(
          key: key,
          search: api.coffeeSearchSuppliers,
          listKey: 'suppliers',
          searchLabel: 'Buscar proveedor',
          newLabel: 'Proveedor nuevo',
          noneLabel: 'Todavía no hay proveedores registrados.',
        );

  /// Clientes de ventas.
  PartyPickerSheet.customers({Key? key, required ApiClient api})
      : this(
          key: key,
          search: api.coffeeSearchCustomers,
          listKey: 'customers',
          searchLabel: 'Buscar cliente por nombre o documento',
          newLabel: 'Cliente nuevo',
          noneLabel: 'Todavía no hay clientes registrados.',
        );

  final Future<Json> Function(String q) search;
  final String listKey;
  final String searchLabel;
  final String newLabel;
  final String noneLabel;

  @override
  State<PartyPickerSheet> createState() => _PartyPickerSheetState();
}

class _PartyPickerSheetState extends State<PartyPickerSheet> {
  final _query = TextEditingController();
  late Future<Json> _future = widget.search('');

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _search(String q) => setState(() => _future = widget.search(q.trim()));

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.75,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _query,
              onChanged: _search,
              decoration: InputDecoration(labelText: widget.searchLabel, prefixIcon: const Icon(Icons.search_rounded)),
            ),
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.person_add_alt_1_rounded, color: AvColors.accent),
              title: Text(widget.newLabel),
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
                  final list = (snap.data?[widget.listKey] as List<dynamic>? ?? const []).cast<Json>();
                  if (list.isEmpty) {
                    return Center(
                      child: Muted(_query.text.trim().isEmpty ? widget.noneLabel : 'Sin resultados.'),
                    );
                  }
                  return ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final s = list[i];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                        title: Text('${s['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: SupplierDetails(supplier: s),
                        ),
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
