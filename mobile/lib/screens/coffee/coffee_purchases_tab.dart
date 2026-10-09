import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_invoice_form_screen.dart';
import 'coffee_lot_detail_screen.dart';
import 'coffee_line_projection.dart';
import 'coffee_sales_math.dart';

/// Compra de producto: jornada actual, historial de facturas y nueva compra (factura con uno o varios productos).
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
    final results = await Future.wait([_api.coffeeInvoices(), _api.coffeeCurrentWorkday()]);
    return [results[0], results[1]];
  }

  Future<void> _newInvoice() async {
    final created = await Navigator.of(context).push<Json>(
      MaterialPageRoute(builder: (_) => CoffeeInvoiceFormScreen(api: _api)),
    );
    if (created != null && mounted) {
      showMessage(context, 'Compra registrada');
      _reload();
      // Se abre la factura con su proyección y el botón de enviar a inventario.
      await _open(created);
    }
  }

  Future<void> _open(Json invoice) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => CoffeeInvoiceDetailScreen(session: widget.session, invoiceId: invoice['id'] as int)),
    );
    if (mounted) _reload();
  }

  Future<void> _void(Json invoice) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Anular ${invoice['code']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Muted('Se anula la factura completa, con todos sus productos.', size: 12),
            const SizedBox(height: 8),
            TextField(controller: controller, decoration: const InputDecoration(labelText: 'Motivo (obligatorio)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Anular')),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) return;
    try {
      await _api.coffeeVoidInvoice(invoice['id'] as int, reason);
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
        onPressed: _newInvoice,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva compra'),
      ),
      body: AsyncView<List<Json>>(
        key: _viewKey,
        load: _load,
        builder: (context, data) {
          final invoices = (data[0]['invoices'] as List<dynamic>? ?? const []).cast<Json>();
          final workday = data[1];
          final summary = workday['summary'] as Json? ?? const {};
          final products = summary['productos'];
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 80),
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
                    Muted(
                      '${summary['compras']} compras${products != null && products != summary['compras'] ? ' ($products productos)' : ''}'
                      ' · ${summary['proveedores']} proveedores · ${summary['pesadas']} pesadas',
                      size: 12,
                    ),
                    Text(formatCop(summary['totalPagado'] as num?), style: mono(size: 22, weight: FontWeight.w600)),
                    Muted('${formatKg(summary['kgRecibidos'] as num?)} recibidos · ${formatKg(summary['kgPagables'] as num?)} pagables', size: 12),
                  ],
                ),
              ),
              const SectionLabel('Historial'),
              if (invoices.isEmpty) const Muted('Aún no hay compras registradas.'),
              for (final inv in invoices) ...[
                _InvoiceTile(invoice: inv, onTap: () => _open(inv), onVoid: () => _void(inv)),
                const SizedBox(height: 8),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Totales de una factura: si está anulada se muestran las cifras de sus líneas (los totales del servidor solo suman activas).
num _invoiceKg(Json inv) => inv['status'] == 'ANULADA'
    ? (inv['lines'] as List<dynamic>).fold<num>(0, (a, l) => a + ((l as Json)['pesoPagable'] as num))
    : (inv['totals'] as Json)['pesoPagable'] as num;

num _invoiceTotal(Json inv) => inv['status'] == 'ANULADA'
    ? (inv['lines'] as List<dynamic>).fold<num>(0, (a, l) => a + ((l as Json)['totalCompra'] as num))
    : (inv['totals'] as Json)['totalCompra'] as num;

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice, required this.onTap, required this.onVoid});

  final Json invoice;
  final VoidCallback onTap;
  final VoidCallback onVoid;

  @override
  Widget build(BuildContext context) {
    final voided = invoice['status'] == 'ANULADA';
    final supplier = invoice['supplier'] as Json;
    final lines = (invoice['lines'] as List<dynamic>).cast<Json>();
    final products = lines.map((l) => '${l['productLabel']}').join(', ');
    return Opacity(
      opacity: voided ? 0.55 : 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: SectionCard(
          padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${invoice['code']} · ${supplier['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Muted('$products · ${formatKg(_invoiceKg(invoice))} pagables${voided ? ' · ANULADA' : ''}', size: 12),
                  ],
                ),
              ),
              Text(formatCop(_invoiceTotal(invoice)), style: mono(size: 14, weight: FontWeight.w600)),
              if (!voided)
                IconButton(
                  tooltip: 'Anular factura',
                  onPressed: onVoid,
                  icon: const Icon(Icons.block_rounded, color: AvColors.fgMuted),
                )
              else
                const SizedBox(width: 12),
            ],
          ),
        ),
      ),
    );
  }
}

/// Detalle de una factura: datos completos del proveedor, forma de pago y cada producto con su subtotal.
class CoffeeInvoiceDetailScreen extends StatefulWidget {
  const CoffeeInvoiceDetailScreen({super.key, required this.session, required this.invoiceId});

  final Session session;
  final int invoiceId;

  @override
  State<CoffeeInvoiceDetailScreen> createState() => _CoffeeInvoiceDetailScreenState();
}

class _CoffeeInvoiceDetailScreenState extends State<CoffeeInvoiceDetailScreen> {
  Key _viewKey = UniqueKey();
  bool _sending = false;

  Session get session => widget.session;
  int get invoiceId => widget.invoiceId;

  /// Crea el procesamiento con los productos pendientes. Sin secado entra directo a inventario;
  /// con secado se abre el procesamiento para registrarlo. La proyección de cada compra no se toca.
  Future<void> _sendToInventory() async {
    setState(() => _sending = true);
    try {
      final r = await session.api.coffeeInvoiceToInventory(invoiceId);
      if (!mounted) return;
      if (r['needsDrying'] == true) {
        showMessage(context, 'Procesamiento ${r['lotCode']} creado: registra el secado');
        await Navigator.of(context).push<void>(
          MaterialPageRoute(builder: (_) => CoffeeLotDetailScreen(session: session, lotId: r['lotId'] as int)),
        );
      } else {
        showMessage(context, 'Enviado a inventario');
      }
      if (mounted) setState(() => _viewKey = UniqueKey());
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Factura de compra')),
      body: AsyncView<Json>(
        key: _viewKey,
        load: () => session.api.coffeeInvoice(invoiceId),
        builder: (context, inv) {
          final lines = (inv['lines'] as List<dynamic>).cast<Json>();
          final voided = inv['status'] == 'ANULADA';
          final canSend = !voided && lines.any((l) => l['status'] == 'ACTIVA' && l['lot'] == null);
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(child: Text('${inv['code']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
                      Pill(label: '${inv['status']}', color: voided ? AvColors.danger : AvColors.positive),
                    ]),
                    const SizedBox(height: 4),
                    Muted(formatDate(inv['purchasedAt'] as String?), size: 12),
                    if (voided) Muted('Anulada: ${inv['voidReason'] ?? ''}', size: 12),
                    const SizedBox(height: 8),
                    Text('${(inv['supplier'] as Json)['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    SupplierDetails(supplier: inv['supplier'] as Json),
                    const SizedBox(height: 8),
                    Muted(
                      'Pago: ${paymentLabel(inv['paymentMethod'] as String?)}'
                      '${(inv['paymentReference'] as String?)?.isNotEmpty == true ? ' · ${inv['paymentReference']}' : ''}',
                      size: 12,
                    ),
                    if ((inv['notes'] as String?)?.isNotEmpty == true) Muted('${inv['notes']}', size: 12),
                  ],
                ),
              ),
              const SectionLabel('Productos'),
              for (final l in lines) ...[
                SectionCard(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(child: Text('${l['productLabel']} · ${l['code']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                        if (l['requiresDrying'] == false) const Pill(label: 'Sin secado', color: AvColors.fgMuted),
                      ]),
                      const SizedBox(height: 6),
                      Muted(
                        '${formatKg(l['pesoTotalCompra'] as num?)} recibidos · merma ${(l['porcentajeMermaInicial'] as num?) ?? 0} % · '
                        '${formatKg(l['pesoPagable'] as num?)} pagables',
                        size: 12,
                      ),
                      Muted('${formatCop(l['precioKg'] as num?)} por kg · ${formatCop(l['precioCarga'] as num?)} por carga', size: 12),
                      if (l['lot'] != null) Muted('Lote ${(l['lot'] as Json)['code']}', size: 12),
                      const SizedBox(height: 4),
                      Row(children: [
                        const Expanded(child: Muted('SUBTOTAL')),
                        Text(formatCop(l['totalCompra'] as num?), style: mono(size: 16, weight: FontWeight.w700)),
                      ]),
                      CoffeeLineProjection(api: session.api, purchaseId: l['id'] as int, editable: !voided),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
              SectionCard(
                child: Row(children: [
                  const Expanded(child: Text('TOTAL', style: TextStyle(fontWeight: FontWeight.w700))),
                  Text(formatCop(_invoiceTotal(inv)), style: mono(size: 22, weight: FontWeight.w700, color: AvColors.accent)),
                ]),
              ),
              const SizedBox(height: 8),
              if (canSend) ...[
                BusyButton(label: 'Enviar a inventario', busy: _sending, onPressed: _sendToInventory),
                const SizedBox(height: 8),
                const Muted(
                  'Sin secado entra directo a inventario; si algún producto se seca, se crea el procesamiento. La proyección se conserva.',
                  size: 12,
                ),
              ] else
                const Muted(
                  'Para clasificar estos productos en un procesamiento, ve a la pestaña Procesamiento.',
                  size: 12,
                ),
            ],
          );
        },
      ),
    );
  }
}
