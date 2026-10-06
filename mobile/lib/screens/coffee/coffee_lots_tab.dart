import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_lot_detail_screen.dart';

/// Etiquetas de los estados de un lote (mismas que la web, `LOT_STATUS`).
const lotStatusLabels = {
  'CREADO': 'Creado',
  'EN_TRANSPORTE': 'En transporte',
  'EN_SECADO': 'En secado',
  'SECADO_FINALIZADO': 'Secado finalizado',
  'DISPONIBLE_PARA_VENTA': 'Disponible para venta',
  'PARCIALMENTE_VENDIDO': 'Parcialmente vendido',
  'VENDIDO': 'Vendido',
  'CERRADO': 'Cerrado',
};

String lotStatusLabel(String? status) => lotStatusLabels[status] ?? (status ?? '—');

/// Siguiente paso manual del flujo del lote: estado → (nuevo estado, texto del botón).
const lotNextStep = {
  'CREADO': ('EN_TRANSPORTE', 'Enviar a transporte'),
  'EN_TRANSPORTE': ('EN_SECADO', 'Iniciar secado'),
  'VENDIDO': ('CERRADO', 'Cerrar lote'),
};

/// Lotes: lista y creación juntando compras que todavía no tienen lote.
class CoffeeLotsTab extends StatefulWidget {
  const CoffeeLotsTab({super.key, required this.session});

  final Session session;

  @override
  State<CoffeeLotsTab> createState() => _CoffeeLotsTabState();
}

class _CoffeeLotsTabState extends State<CoffeeLotsTab> {
  Key _viewKey = UniqueKey();

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  Future<void> _open(int id) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => CoffeeLotDetailScreen(session: widget.session, lotId: id)),
    );
    if (mounted) _reload();
  }

  Future<void> _create() async {
    final lot = await showFormSheet<Json>(context, title: 'Crear lote', child: _NewLotForm(api: _api));
    if (lot == null || !mounted) return;
    _reload();
    await _open(lot['id'] as int);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Crear lote'),
      ),
      body: AsyncView<Json>(
        key: _viewKey,
        load: _api.coffeeLots,
        builder: (context, data) {
          final lots = (data['lots'] as List<dynamic>? ?? const []).cast<Json>();
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 80),
            children: [
              const Muted('Junta las compras de un cliente en un lote, sigue su secado y envíalo a inventario.', size: 12),
              const SizedBox(height: 12),
              if (lots.isEmpty) const Muted('Aún no hay lotes. Toca "Crear lote" para juntar compras.'),
              for (final l in lots) ...[_LotTile(lot: l, onTap: () => _open(l['id'] as int)), const SizedBox(height: 8)],
            ],
          );
        },
      ),
    );
  }
}

class _LotTile extends StatelessWidget {
  const _LotTile({required this.lot, required this.onTap});

  final Json lot;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SectionCard(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${lot['code']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Muted(
                    '${lot['compras']} compra(s) · ${lot['proveedores']} proveedor(es) · '
                    '${formatKg(lot['pesoPagable'] as num?)} pagables',
                    size: 12,
                  ),
                  const SizedBox(height: 6),
                  Pill(label: lotStatusLabel(lot['status'] as String?), color: AvColors.accent),
                ],
              ),
            ),
            Text(formatCop(lot['totalCompra'] as num?), style: mono(size: 14, weight: FontWeight.w600)),
            const Icon(Icons.chevron_right_rounded, color: AvColors.fgMuted),
          ],
        ),
      ),
    );
  }
}

/// Elige las compras activas sin lote y crea el lote. Devuelve el lote creado.
class _NewLotForm extends StatefulWidget {
  const _NewLotForm({required this.api});

  final ApiClient api;

  @override
  State<_NewLotForm> createState() => _NewLotFormState();
}

class _NewLotFormState extends State<_NewLotForm> {
  late final Future<Json> _free = widget.api.coffeePurchases(onlyWithoutLot: true);
  final _notes = TextEditingController();
  final _selected = <int>{};
  bool _busy = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_selected.isEmpty) {
      showMessage(context, 'Selecciona al menos una compra', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final lot = await widget.api.coffeeCreateLot(_selected.toList(), _notes.text.trim());
      if (mounted) Navigator.of(context).pop(lot);
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Json>(
      future: _free,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
        }
        if (snap.hasError) return Muted('${snap.error}');
        final purchases = (snap.data?['purchases'] as List<dynamic>? ?? const []).cast<Json>();
        if (purchases.isEmpty) return const Muted('No hay compras activas sin lote.');

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final p in purchases)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _selected.contains(p['id'] as int),
                onChanged: (v) => setState(() {
                  final id = p['id'] as int;
                  v == true ? _selected.add(id) : _selected.remove(id);
                }),
                title: Text('${p['code']} · ${(p['supplier'] as Json)['name']}'),
                subtitle: Text(
                  '${p['productLabel'] ?? ''} · ${formatKg(p['pesoPagable'] as num?)} pagables · '
                  '${formatCop(p['totalCompra'] as num?)}'
                  '${p['requiresDrying'] == false ? ' · sin secado' : ''}',
                ),
              ),
            const SizedBox(height: 8),
            TextField(controller: _notes, decoration: const InputDecoration(labelText: 'Observaciones')),
            const SizedBox(height: 16),
            BusyButton(label: 'Crear lote', busy: _busy, onPressed: _save),
          ],
        );
      },
    );
  }
}
