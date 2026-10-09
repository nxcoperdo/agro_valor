import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_lots_tab.dart';

const _preFinish = ['CREADO', 'EN_TRANSPORTE', 'EN_SECADO'];
const _frozen = ['DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO', 'VENDIDO', 'CERRADO'];

/// Detalle de un lote: compras incluidas, siguiente paso del flujo y procesamiento
/// (envío, costos, salida del secado y entrada a inventario), igual que en la web.
class CoffeeLotDetailScreen extends StatefulWidget {
  const CoffeeLotDetailScreen({super.key, required this.session, required this.lotId});

  final Session session;
  final int lotId;

  @override
  State<CoffeeLotDetailScreen> createState() => _CoffeeLotDetailScreenState();
}

class _CoffeeLotDetailScreenState extends State<CoffeeLotDetailScreen> {
  Key _viewKey = UniqueKey();

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  /// El lote y su procesamiento. Los roles sin acceso a costos reciben 403 en el segundo:
  /// entonces simplemente no se muestra ese bloque (igual que en la web).
  Future<List<Json?>> _load() async {
    final lot = await _api.coffeeLot(widget.lotId);
    Json? processing;
    try {
      processing = await _api.coffeeLotProcessing(widget.lotId);
    } on ApiError catch (e) {
      if (e.status != 403) rethrow;
    }
    return [lot, processing];
  }

  /// Ejecuta una acción del servidor, recarga y muestra el error si falla.
  Future<void> _run(Future<void> Function() action, {String? success}) async {
    try {
      await action();
      if (mounted && success != null) showMessage(context, success);
      _reload();
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Procesamiento')),
      body: AsyncView<List<Json?>>(
        key: _viewKey,
        load: _load,
        builder: (context, data) {
          final lot = data[0]!;
          final processing = data[1];
          final status = lot['status'] as String;
          final next = lotNextStep[status];
          final purchases = (lot['purchases'] as List<dynamic>? ?? const []).cast<Json>();

          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(child: Text('${lot['code']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
                      Pill(label: lotStatusLabel(status), color: AvColors.accent),
                    ]),
                    if ((lot['notes'] as String?)?.isNotEmpty == true) ...[
                      const SizedBox(height: 4),
                      Muted('${lot['notes']}', size: 12),
                    ],
                    const SizedBox(height: 12),
                    _kv('Compras', '${lot['compras']}'),
                    _kv('Proveedores', '${lot['proveedores']}'),
                    _kv('Peso pagable', formatKg(lot['pesoPagable'] as num?)),
                    _kv('Peso proyectado', formatKg(lot['pesoProyectado'] as num?)),
                    _kv('Total compra', formatCop(lot['totalCompra'] as num?)),
                    if (lot['costosCompra'] != null) _kv('Costos de compra', formatCop(lot['costosCompra'] as num?)),
                    if (next != null) ...[
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () => _run(() => _api.coffeeChangeLotStatus(widget.lotId, next.$1)),
                        child: Text(next.$2),
                      ),
                    ],
                  ],
                ),
              ),
              const SectionLabel('Compras incluidas'),
              for (final p in purchases)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SectionCard(
                    padding: const EdgeInsets.fromLTRB(16, 10, 4, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${p['code']} · ${(p['supplier'] as Json)['name']}',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              Muted(
                                '${p['productLabel'] ?? ''} · ${formatKg(p['pesoPagable'] as num?)} pagables · '
                                '${formatCop(p['totalCompra'] as num?)}'
                                '${p['requiresDrying'] == false ? ' · sin secado' : ''}',
                                size: 12,
                              ),
                            ],
                          ),
                        ),
                        if (status == 'CREADO' && purchases.length > 1)
                          TextButton(
                            onPressed: () => _run(() => _api.coffeeRemoveLotPurchase(widget.lotId, p['id'] as int)),
                            child: const Text('Quitar'),
                          ),
                      ],
                    ),
                  ),
                ),
              if (processing != null) ..._processing(status, processing),
            ],
          );
        },
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Expanded(child: Muted(k)),
            Text(v, style: mono(size: 14)),
          ],
        ),
      );

  List<Widget> _processing(String status, Json pr) {
    final secado = pr['secado'] as Json? ?? const {};
    final kgSecar = (secado['kgSecar'] as num?) ?? 0;
    final kgDirecto = (secado['kgDirecto'] as num?) ?? 0;
    final direct = _preFinish.contains(status) && secado['directoAInventario'] == true;
    final mixed = _preFinish.contains(status) && !direct && kgDirecto > 0;
    final costs = (pr['costos'] as List<dynamic>? ?? const []).cast<Json>();
    final real = pr['resultadoReal'] as Json?;
    final cmp = pr['comparacion'] as Json?;
    final frozen = _frozen.contains(status);

    return [
      const SectionLabel('Procesamiento'),
      if (direct)
        const SectionCard(
          child: Muted('Ninguna compra de este procesamiento requiere secado: se proyecta y entra al 100 %. Puedes enviarlo directo a inventario.'),
        ),
      if (mixed)
        SectionCard(
          child: Muted(
            'En este procesamiento ${formatKg(kgSecar)} se secan y ${formatKg(kgDirecto)} no requieren secado y van directo a '
            'inventario. Al registrar la salida del secado, ingresa solo lo que salió de los ${formatKg(kgSecar)} que se secaron.',
          ),
        ),
      if (_preFinish.contains(status) && !direct) ...[
        const SizedBox(height: 8),
        _ShipmentCard(lotId: widget.lotId, envio: pr['envio'] as Json?, defaultKg: kgSecar + kgDirecto, run: _run, api: _api),
      ],
      const SizedBox(height: 8),
      SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Costos reales de procesamiento', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (costs.isEmpty) const Muted('Sin costos de procesamiento.', size: 12),
            for (final c in costs)
              Row(
                children: [
                  Expanded(child: Text('${c['concepto']}')),
                  Text(formatCop(c['valor'] as num?), style: mono(size: 13)),
                  if (!frozen)
                    IconButton(
                      tooltip: 'Quitar',
                      onPressed: () => _run(() => _api.coffeeRemoveLotCost(widget.lotId, c['id'] as int)),
                      icon: const Icon(Icons.close_rounded, size: 18),
                    ),
                ],
              ),
            if (!frozen) _AddCostRow(lotId: widget.lotId, run: _run, api: _api),
          ],
        ),
      ),
      if (status == 'EN_SECADO' && !direct) ...[
        const SizedBox(height: 8),
        _FinishCard(lotId: widget.lotId, mixed: mixed, kgSecar: kgSecar, run: _run, api: _api),
      ],
      if (status == 'SECADO_FINALIZADO' || direct) ...[
        const SizedBox(height: 8),
        _InventoryCard(lotId: widget.lotId, run: _run, api: _api),
      ],
      if (real != null) ...[
        const SectionLabel('Resultado real'),
        SectionCard(
          child: Column(
            children: [
              _kv('Kg secos reales', formatKg(real['kilosSecosReales'] as num?)),
              _kv('Rendimiento real', '${(real['rendimientoReal'] as num?)?.toStringAsFixed(1) ?? '—'} %'),
              _kv('Kg netos reales', formatKg(real['kilosNetosReales'] as num?)),
              _kv('Costo real total', formatCop(real['costoRealTotal'] as num?)),
              _kv('Costo real por kg', formatCop(real['costoRealKg'] as num?)),
              _kv('Costo real por carga', formatCop(real['costoRealCarga'] as num?)),
            ],
          ),
        ),
      ],
      if (cmp != null) ...[
        const SectionLabel('Proyectado vs real'),
        SectionCard(
          child: Column(
            children: [
              for (final f in (cmp['filas'] as List<dynamic>).cast<Json>())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(flex: 3, child: Text('${f['concepto']}', style: const TextStyle(fontSize: 13))),
                      Expanded(flex: 2, child: Text(_fmtCmp(f['key'] as String, f['proyectado']), style: mono(size: 12))),
                      Expanded(flex: 2, child: Text(_fmtCmp(f['key'] as String, f['real']), style: mono(size: 12))),
                    ],
                  ),
                ),
              if (cmp['tieneReal'] != true) const Muted('El real aparece cuando registres la salida del secado.', size: 12),
            ],
          ),
        ),
      ],
    ];
  }

  String _fmtCmp(String key, Object? v) {
    if (v == null) return '—';
    final n = v as num;
    if (key == 'rendimiento') return '${n.toStringAsFixed(1)} %';
    if (key == 'kilosSecos' || key == 'kilosNetos' || key == 'destare') return formatKg(n);
    return formatCop(n);
  }
}

typedef _Run = Future<void> Function(Future<void> Function() action, {String? success});

class _ShipmentCard extends StatefulWidget {
  const _ShipmentCard({required this.lotId, required this.envio, required this.defaultKg, required this.run, required this.api});

  final int lotId;
  final Json? envio;
  final num defaultKg;
  final _Run run;
  final ApiClient api;

  @override
  State<_ShipmentCard> createState() => _ShipmentCardState();
}

class _ShipmentCardState extends State<_ShipmentCard> {
  late final _place = TextEditingController(text: widget.envio?['lugar'] as String? ?? '');
  late final _kg = TextEditingController(text: decimalInputText((widget.envio?['kilosEnviados'] as num?) ?? widget.defaultKg));

  @override
  void dispose() {
    _place.dispose();
    _kg.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Envío', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(controller: _place, decoration: const InputDecoration(labelText: 'Lugar de procesamiento')),
          const SizedBox(height: 8),
          TextField(
            controller: _kg,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Kilos enviados', suffixText: 'kg'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => widget.run(
              () => widget.api.coffeeSaveLotShipment(widget.lotId, {
                'lugar': _place.text.trim(),
                'kilosEnviados': parseDecimal(_kg.text),
              }),
              success: 'Envío guardado',
            ),
            child: const Text('Guardar envío'),
          ),
        ],
      ),
    );
  }
}

class _AddCostRow extends StatefulWidget {
  const _AddCostRow({required this.lotId, required this.run, required this.api});

  final int lotId;
  final _Run run;
  final ApiClient api;

  @override
  State<_AddCostRow> createState() => _AddCostRowState();
}

class _AddCostRowState extends State<_AddCostRow> {
  final _concept = TextEditingController();
  final _value = TextEditingController();

  @override
  void dispose() {
    _concept.dispose();
    _value.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(controller: _concept, decoration: const InputDecoration(labelText: 'Concepto (secado, transporte…)')),
          const SizedBox(height: 8),
          TextField(
            controller: _value,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Valor', prefixText: '\$ '),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () => widget.run(() async {
              await widget.api.coffeeAddLotCost(widget.lotId, {'concepto': _concept.text.trim(), 'valor': parseCop(_value.text)});
              _concept.clear();
              _value.clear();
            }),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Agregar costo'),
          ),
        ],
      ),
    );
  }
}

class _FinishCard extends StatefulWidget {
  const _FinishCard({required this.lotId, required this.mixed, required this.kgSecar, required this.run, required this.api});

  final int lotId;
  final bool mixed;
  final num kgSecar;
  final _Run run;
  final ApiClient api;

  @override
  State<_FinishCard> createState() => _FinishCardState();
}

class _FinishCardState extends State<_FinishCard> {
  final _dry = TextEditingController();
  final _destare = TextEditingController(text: '0');

  @override
  void dispose() {
    _dry.dispose();
    _destare.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Salida real del secado', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _dry,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: widget.mixed
                  ? 'Kilos secos reales (de los ${formatKg(widget.kgSecar)} que se secaron)'
                  : 'Kilos secos reales',
              suffixText: 'kg',
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _destare,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Destare real', suffixText: 'kg'),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => widget.run(
              () => widget.api.coffeeFinishLot(widget.lotId, {
                'kilosSecosReales': parseDecimal(_dry.text),
                'destareRealKg': parseDecimal(_destare.text) ?? 0,
              }),
              success: 'Salida registrada',
            ),
            child: const Text('Registrar salida'),
          ),
        ],
      ),
    );
  }
}

class _InventoryCard extends StatefulWidget {
  const _InventoryCard({required this.lotId, required this.run, required this.api});

  final int lotId;
  final _Run run;
  final ApiClient api;

  @override
  State<_InventoryCard> createState() => _InventoryCardState();
}

class _InventoryCardState extends State<_InventoryCard> {
  final _place = TextEditingController();

  @override
  void dispose() {
    _place.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Entrada a inventario', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(controller: _place, decoration: const InputDecoration(labelText: 'Ubicación (bodega)')),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => widget.run(
              () => widget.api.coffeeEnterInventory(widget.lotId, {'ubicacion': _place.text.trim()}),
              success: 'Procesamiento enviado a inventario',
            ),
            child: const Text('Enviar a inventario'),
          ),
        ],
      ),
    );
  }
}
