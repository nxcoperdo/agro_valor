import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../api/api_client.dart';
import '../../format.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import '../../widgets/forms.dart';
import 'coffee_invoice_form_screen.dart' show SupplierDetails;
import 'coffee_sale_form_screen.dart';
import 'coffee_sales_math.dart';

/// Ventas de café: historial y nueva venta de lotes de inventario. No es el diario de "Mis ventas" de la cuenta
/// (ese compara cada venta contra el precio de referencia); esta es la venta del negocio, con cliente y recibo.
class CoffeeSalesTab extends StatefulWidget {
  const CoffeeSalesTab({super.key, required this.session});

  final Session session;

  @override
  State<CoffeeSalesTab> createState() => _CoffeeSalesTabState();
}

class _CoffeeSalesTabState extends State<CoffeeSalesTab> {
  Key _viewKey = UniqueKey();

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  Future<void> _newSale() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => CoffeeSaleFormScreen(api: _api)),
    );
    if (code != null) {
      if (mounted) showMessage(context, 'Venta $code registrada');
      _reload();
    }
  }

  Future<void> _open(Json sale) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => CoffeeSaleDetailScreen(session: widget.session, saleId: sale['id'] as int)),
    );
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _newSale,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nueva venta'),
      ),
      body: AsyncView<Json>(
        key: _viewKey,
        load: _api.coffeeSales,
        builder: (context, data) {
          final sales = (data['sales'] as List<dynamic>? ?? const []).cast<Json>();
          final active = sales.where((s) => s['status'] != 'ANULADA').length;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 80),
            children: [
              if (sales.isEmpty)
                _EmptySales(onCreate: _newSale)
              else ...[
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Muted('TOTAL VENDIDO'),
                      Text(formatCop(activeSalesTotal(sales)), style: mono(size: 24, weight: FontWeight.w700, color: AvColors.accent)),
                      Muted('$active venta(s) activa(s)${sales.length > active ? ' · ${sales.length - active} anulada(s)' : ''}', size: 12),
                    ],
                  ),
                ),
                const SectionLabel('Historial'),
                for (final s in sales) ...[
                  _SaleTile(sale: s, onTap: () => _open(s)),
                  const SizedBox(height: 8),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

class _EmptySales extends StatelessWidget {
  const _EmptySales({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
      child: Column(
        children: [
          Icon(Icons.point_of_sale_rounded, size: 48, color: AvColors.fgMuted),
          const SizedBox(height: 16),
          const Text('Aún no hay ventas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Muted('Vende un lote completo o por partes, con cliente y recibo para compartir.'),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: onCreate,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Registrar la primera venta'),
          ),
        ],
      ),
    );
  }
}

class _SaleTile extends StatelessWidget {
  const _SaleTile({required this.sale, required this.onTap});

  final Json sale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final voided = sale['status'] == 'ANULADA';
    final items = (sale['items'] as List<dynamic>).cast<Json>();
    final lots = items.map((i) => '${i['lotCode']}').join(', ');
    return Opacity(
      opacity: voided ? 0.55 : 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: SectionCard(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${sale['code']} · ${(sale['customer'] as Json)['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Muted('${formatDate(sale['soldOn'] as String?)} · ${formatKg(saleKg(items))} · $lots${voided ? ' · ANULADA' : ''}', size: 12),
                  ],
                ),
              ),
              Text(formatCop(sale['total'] as num?), style: mono(size: 14, weight: FontWeight.w600)),
              Icon(Icons.chevron_right_rounded, color: AvColors.fgMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Detalle de una venta: cliente, cada lote con su precio y subtotal, recibo para compartir y anulación.
class CoffeeSaleDetailScreen extends StatefulWidget {
  const CoffeeSaleDetailScreen({super.key, required this.session, required this.saleId});

  final Session session;
  final int saleId;

  @override
  State<CoffeeSaleDetailScreen> createState() => _CoffeeSaleDetailScreenState();
}

class _CoffeeSaleDetailScreenState extends State<CoffeeSaleDetailScreen> {
  Key _viewKey = UniqueKey();
  bool _sharing = false;

  ApiClient get _api => widget.session.api;

  void _reload() => setState(() => _viewKey = UniqueKey());

  Future<void> _shareReceipt(BuildContext buttonContext, Json sale) async {
    // En iPad la hoja de compartir se ancla al botón.
    final box = buttonContext.findRenderObject() as RenderBox?;
    final origin = box == null ? null : box.localToGlobal(Offset.zero) & box.size;
    setState(() => _sharing = true);
    try {
      final bytes = await _api.coffeeSaleReceiptPdf(widget.saleId);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(bytes, mimeType: 'application/pdf')],
          fileNameOverrides: ['${sale['code']}.pdf'],
          subject: 'Recibo de venta ${sale['code']}',
          sharePositionOrigin: origin,
        ),
      );
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  Future<void> _void(Json sale) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Anular ${sale['code']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Muted('La venta no se borra: queda anulada y los kilos vuelven al inventario.', size: 12),
            const SizedBox(height: 8),
            TextField(controller: controller, decoration: const InputDecoration(labelText: 'Motivo (obligatorio)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: Text('Anular venta', style: TextStyle(color: AvColors.danger)),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) return;
    try {
      await _api.coffeeVoidSale(widget.saleId, reason);
      if (mounted) showMessage(context, 'Venta anulada');
      _reload();
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Venta de café')),
      body: AsyncView<Json>(
        key: _viewKey,
        load: () => _api.coffeeSale(widget.saleId),
        builder: (context, sale) {
          final voided = sale['status'] == 'ANULADA';
          final items = (sale['items'] as List<dynamic>).cast<Json>();
          final customer = sale['customer'] as Json;
          final reference = sale['paymentReference'] as String?;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.paddingOf(context).bottom + 32),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(child: Text('${sale['code']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
                      Pill(label: voided ? 'ANULADA' : 'ACTIVA', color: voided ? AvColors.danger : AvColors.positive),
                    ]),
                    const SizedBox(height: 4),
                    Muted(formatDate(sale['soldOn'] as String?), size: 12),
                    if (voided) Text('Anulada: ${sale['voidReason'] ?? ''}', style: TextStyle(color: AvColors.danger, fontSize: 12)),
                    const SizedBox(height: 8),
                    Text('${customer['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    SupplierDetails(supplier: customer),
                    const SizedBox(height: 8),
                    Muted(
                      'Pago: ${paymentLabel(sale['paymentMethod'] as String?)}${reference != null && reference.isNotEmpty ? ' · $reference' : ''}',
                      size: 12,
                    ),
                    if ((sale['notes'] as String?)?.isNotEmpty == true) Muted('${sale['notes']}', size: 12),
                  ],
                ),
              ),
              const SectionLabel('Lotes vendidos'),
              for (final i in items) ...[
                SectionCard(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(child: Text('${i['lotCode']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                        if (i['factor'] != null) Pill(label: formatFactor(i['factor'] as num), color: AvColors.fgMuted),
                      ]),
                      const SizedBox(height: 6),
                      Muted('${formatKg(i['kg'] as num?)} vendidos', size: 12),
                      Muted('${formatCop(i['precioKg'] as num?)} por kg · ${formatCop(i['precioCarga'] as num?)} por carga', size: 12),
                      const SizedBox(height: 4),
                      Row(children: [
                        const Expanded(child: Muted('SUBTOTAL')),
                        Text(formatCop(i['subtotal'] as num?), style: mono(size: 16, weight: FontWeight.w700)),
                      ]),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
              ],
              SectionCard(
                child: Row(children: [
                  const Expanded(child: Text('TOTAL', style: TextStyle(fontWeight: FontWeight.w700))),
                  Text(formatCop(sale['total'] as num?), style: mono(size: 22, weight: FontWeight.w700, color: AvColors.accent)),
                ]),
              ),
              const SizedBox(height: 16),
              Builder(
                builder: (buttonContext) => FilledButton.icon(
                  onPressed: _sharing ? null : () => _shareReceipt(buttonContext, sale),
                  icon: _sharing
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.ios_share_rounded),
                  label: Text(_sharing ? 'Preparando recibo…' : 'Compartir recibo'),
                ),
              ),
              if (!voided) ...[
                // Separada de la acción principal: es la única acción destructiva de la pantalla.
                const SizedBox(height: 32),
                OutlinedButton.icon(
                  onPressed: () => _void(sale),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AvColors.danger,
                    side: BorderSide(color: AvColors.danger),
                  ),
                  icon: const Icon(Icons.block_rounded),
                  label: const Text('Anular venta'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
