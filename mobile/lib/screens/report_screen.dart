import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/cooperative_picker.dart';
import '../widgets/forms.dart';

/// Reportar lo que pagó una cooperativa. Es gratis a propósito: estos reportes vuelven real el ranking para todos.
class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key, required this.session, this.cooperativeId});

  final Session session;
  final int? cooperativeId;

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _form = GlobalKey<FormState>();
  final _price = TextEditingController();
  final _factor = TextEditingController();
  final _humidity = TextEditingController();
  late final Future<Json> _coops = _api.cooperatives(widget.session.market);

  bool get _isCocoa => widget.session.market == 'cocoa';
  late int? _coopId = widget.cooperativeId;
  DateTime _date = DateTime.now();
  bool _busy = false;
  late Future<Json> _mine = _api.myReports();

  ApiClient get _api => widget.session.api;

  @override
  void dispose() {
    for (final c in [_price, _factor, _humidity]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      final res = await _api.reportPrice({
        'cooperativeId': _coopId,
        // Café se reporta por carga; cacao, por kilo (el servidor valida cada rango).
        if (_isCocoa) 'priceCopKg': parseCop(_price.text) else 'priceCopCarga': parseCop(_price.text),
        if (!_isCocoa) 'factor': parseDecimal(_factor.text),
        if (!_isCocoa) 'humidity': parseDecimal(_humidity.text),
        'reportedForDate': isoDay(_date),
      });
      if (!mounted) return;
      _price.clear();
      _factor.clear();
      _humidity.clear();
      setState(() => _mine = _api.myReports());
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.volunteer_activism_rounded, color: AvColors.accent),
          title: const Text('¡Gracias por reportar!'),
          content: Text(res['message'] as String? ?? ''),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Listo'))],
        ),
      );
    } catch (e) {
      if (mounted) showMessage(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reportar precio')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Muted(
            _isCocoa
                ? '¿Vendiste cacao? Cuéntanos cuánto te pagaron por kilo. Con dos reportes de productores '
                    'distintos, el precio de ese comprador aparece para todos.'
                : '¿Vendiste hoy? Cuéntanos cuánto te pagaron por carga. Con dos reportes de caficultores distintos, '
                    'el precio de esa cooperativa deja de ser estimado y pasa a ser real para todos.',
          ),
          const SizedBox(height: 16),
          SectionCard(
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  CooperativePicker(
                    future: _coops,
                    value: _coopId,
                    required: true,
                    onChanged: (id) => setState(() => _coopId = id),
                  ),
                  const SizedBox(height: 12),
                  NumberField(
                    controller: _price,
                    label: _isCocoa ? 'Precio pagado por kilo' : 'Precio pagado por carga de 125 kg',
                    kind: NumberKind.cop,
                    required: true,
                    min: _isCocoa ? 1000 : 100000,
                    max: _isCocoa ? 200000 : 20000000,
                  ),
                  const SizedBox(height: 12),
                  if (!_isCocoa) ...[
                    Row(
                      children: [
                        Expanded(child: NumberField(controller: _factor, label: 'Factor', hint: '94', min: 60, max: 140)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: NumberField(controller: _humidity, label: 'Humedad', hint: '12', suffix: '%', min: 0, max: 30),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  OutlinedButton.icon(
                    onPressed: _pickDate,
                    icon: const Icon(Icons.event_rounded, size: 18),
                    label: Text('Precio del ${formatDate(isoDay(_date))}'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      foregroundColor: AvColors.fg,
                      side: const BorderSide(color: AvColors.border),
                    ),
                  ),
                  const SizedBox(height: 16),
                  BusyButton(label: 'Enviar reporte', icon: Icons.send_rounded, busy: _busy, onPressed: _submit),
                ],
              ),
            ),
          ),
          const SectionLabel('Mis reportes'),
          FutureBuilder<Json>(
            future: _mine,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
              }
              final reports = (snap.data?['reports'] as List<dynamic>? ?? const []).cast<Json>();
              if (snap.hasError) return Muted('${snap.error}');
              if (reports.isEmpty) return const Muted('Todavía no has reportado precios.');
              return Column(children: [for (final r in reports) _ReportRow(report: r)]);
            },
          ),
        ],
      ),
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.report});

  final Json report;

  @override
  Widget build(BuildContext context) {
    // Este endpoint devuelve las filas tal cual la base de datos (snake_case).
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(report['cooperative_name'] as String? ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
                Muted(formatDate(report['reported_for_date'] as String?), size: 12),
              ],
            ),
          ),
          Text(formatCop(report['price_cop_carga'] as num?), style: mono(size: 14)),
        ],
      ),
    );
  }
}
