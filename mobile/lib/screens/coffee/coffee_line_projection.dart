import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';

/// Proyección de UN producto de la factura (igual que el panel de la web): rendimiento de secado,
/// destare, precio de venta opcional y costos proyectados. Los roles sin acceso a costos reciben 403
/// y el bloque no se muestra.
class CoffeeLineProjection extends StatefulWidget {
  const CoffeeLineProjection({super.key, required this.api, required this.purchaseId, required this.editable});

  final ApiClient api;
  final int purchaseId;

  /// Una factura anulada solo se consulta.
  final bool editable;

  @override
  State<CoffeeLineProjection> createState() => _CoffeeLineProjectionState();
}

class _CostRow {
  _CostRow({String concepto = '', num? valor, this.modo = 'total'})
      : concepto = TextEditingController(text: concepto),
        valor = TextEditingController(text: copInputText(valor));

  final TextEditingController concepto;
  final TextEditingController valor;
  String modo;

  void dispose() {
    concepto.dispose();
    valor.dispose();
  }
}

class _CoffeeLineProjectionState extends State<CoffeeLineProjection> {
  final _form = GlobalKey<FormState>();
  final _rend = TextEditingController();
  final _destare = TextEditingController();
  final _precio = TextEditingController();
  final _costs = <_CostRow>[];

  Json? _data;
  bool _loading = true;
  bool _forbidden = false;
  bool _busy = false;
  bool _expanded = false;
  bool _requiresDrying = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _rend.dispose();
    _destare.dispose();
    _precio.dispose();
    for (final c in _costs) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await widget.api.coffeeProjection(widget.purchaseId);
      if (!mounted) return;
      _fill(data);
      setState(() {
        _data = data;
        _loading = false;
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (e.status == 403) {
          _forbidden = true;
        } else {
          _error = '$e';
        }
      });
    }
  }

  void _fill(Json data) {
    final e = data['entradas'] as Json;
    _requiresDrying = data['requiresDrying'] == true;
    _rend.text = decimalInputText(e['rendimientoSecadoPct'] as num?);
    _destare.text = decimalInputText(e['destareKg'] as num?);
    _precio.text = copInputText(e['precioVentaCarga'] as num?);
    for (final c in _costs) {
      c.dispose();
    }
    _costs
      ..clear()
      ..addAll(((e['costos'] as List<dynamic>?) ?? const []).cast<Json>().map(
            (c) => _CostRow(concepto: '${c['concepto']}', valor: c['valor'] as num?, modo: '${c['modo']}'),
          ));
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final costos = [
        for (final c in _costs)
          if (c.concepto.text.trim().isNotEmpty || parseCop(c.valor.text) != null)
            {'concepto': c.concepto.text.trim(), 'valor': parseCop(c.valor.text), 'modo': c.modo},
      ];
      final data = await widget.api.coffeeSaveProjection(widget.purchaseId, {
        'requiereSecado': _requiresDrying,
        'rendimientoSecadoPct': _requiresDrying ? parseDecimal(_rend.text) : 100,
        'destareKg': parseDecimal(_destare.text) ?? 0,
        'precioVentaCarga': parseCop(_precio.text),
        'costos': costos,
      });
      if (!mounted) return;
      _fill(data);
      setState(() => _data = data);
      showMessage(context, 'Proyección guardada');
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _kv(String k, String v, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Muted(k, size: 12)),
          Text(v, style: mono(size: 13, weight: strong ? FontWeight.w700 : FontWeight.w500, color: strong ? AvColors.accent : AvColors.fg)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    if (_forbidden) return const SizedBox.shrink();
    if (_loading) {
      return const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: LinearProgressIndicator());
    }
    final d = _data;
    if (d == null) return _error == null ? const SizedBox.shrink() : Text(_error!, style: const TextStyle(color: AvColors.danger));

    final noSale = d['ingresoProyectado'] == null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 20),
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          child: Row(children: [
            Expanded(
              child: Text(
                'Proyección${_requiresDrying ? ' de secado' : ' (sin secado)'}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            if (d['guardada'] == true) const Pill(label: 'Guardada', color: AvColors.positive),
            Icon(_expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: AvColors.fgMuted),
          ]),
        ),
        const SizedBox(height: 6),
        _kv('Kg secos proyectados', formatKg(d['kilosSecosProyectados'] as num?)),
        _kv('Kg netos proyectados', formatKg(d['kilosNetosProyectados'] as num?)),
        _kv('Costo total proyectado', formatCop(d['costoTotalProyectado'] as num?)),
        _kv('Costo mínimo por kg', formatCop(d['costoMinimoKg'] as num?), strong: true),
        _kv('Costo mínimo por carga', formatCop(d['costoMinimoCarga'] as num?), strong: true),
        if (!noSale) ...[
          _kv('Ingreso proyectado', formatCop(d['ingresoProyectado'] as num?)),
          _kv('Utilidad proyectada', formatCop(d['utilidadProyectada'] as num?)),
          _kv('Margen', d['margen'] == null ? '—' : formatPct(d['margen'] as num)),
        ],
        if (_expanded && widget.editable) _formBody(),
      ],
    );
  }

  Widget _formBody() {
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('¿Requiere proceso de secado?'),
            subtitle: Muted(
              _requiresDrying
                  ? 'Se proyecta con el rendimiento de secado de abajo.'
                  : 'No se seca: la proyección es directa al 100 %.',
              size: 12,
            ),
            value: _requiresDrying,
            onChanged: (v) => setState(() {
              _requiresDrying = v;
              _rend.text = v ? '55' : '100';
            }),
          ),
          const SizedBox(height: 8),
          if (_requiresDrying) ...[
            NumberField(controller: _rend, label: 'Rendimiento de secado', suffix: '%', required: true, min: 1, max: 100),
            const SizedBox(height: 12),
          ],
          NumberField(controller: _destare, label: 'Destare proyectado', suffix: 'kg', min: 0),
          const SizedBox(height: 12),
          NumberField(controller: _precio, label: 'Precio actual café seco por carga (opcional)', kind: NumberKind.cop),
          const SizedBox(height: 16),
          const Text('Costos proyectados', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          for (var i = 0; i < _costs.length; i++) _costRow(i),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => setState(() => _costs.add(_CostRow())),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Agregar costo proyectado'),
            ),
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: AvColors.danger)),
          const SizedBox(height: 8),
          BusyButton(label: 'Calcular y guardar', busy: _busy, onPressed: _save),
        ],
      ),
    );
  }

  Widget _costRow(int i) {
    final c = _costs[i];
    return Padding(
      key: ObjectKey(c),
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 5,
            child: TextFormField(controller: c.concepto, decoration: const InputDecoration(labelText: 'Concepto')),
          ),
          const SizedBox(width: 8),
          Expanded(flex: 4, child: NumberField(controller: c.valor, label: 'Valor', kind: NumberKind.cop)),
          const SizedBox(width: 8),
          Expanded(
            flex: 4,
            child: DropdownButtonFormField<String>(
              initialValue: c.modo,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Se cobra'),
              items: const [
                DropdownMenuItem(value: 'total', child: Text('Total')),
                DropdownMenuItem(value: 'por_kg', child: Text('Por kg seco')),
              ],
              onChanged: (v) => c.modo = v ?? 'total',
            ),
          ),
          IconButton(
            tooltip: 'Quitar costo',
            onPressed: () => setState(() => _costs.removeAt(i).dispose()),
            icon: const Icon(Icons.close_rounded, color: AvColors.fgMuted),
          ),
        ],
      ),
    );
  }
}
