import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import '../config.dart';
import '../session.dart';
import '../theme.dart';

final _price = NumberFormat('#,##0.00', 'es_CO');

String _signed(num v) => '${v >= 0 ? '+' : '−'}${_price.format(v.abs())}';

/// Tarjeta "Bolsa de Nueva York · Café C Dic 2026" (c/lb). Independiente del resto de la
/// pantalla Precio: si la consulta falla solo ella muestra "No disponible".
class NyCoffeeDec26Card extends StatefulWidget {
  const NyCoffeeDec26Card({super.key, required this.session});

  final Session session;

  @override
  State<NyCoffeeDec26Card> createState() => _NyCoffeeDec26CardState();
}

class _NyCoffeeDec26CardState extends State<NyCoffeeDec26Card> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _failed = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 60), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final token = widget.session.api.token;
      final res = await http.get(
        Uri.parse('$apiBaseUrl/api/ny-coffee/dec26'),
        headers: {'X-Client': 'mobile', if (token != null) 'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
      final json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _data = json;
        _failed = json['available'] != true;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _failed = true;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: BoxDecoration(
          color: AvColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AvColors.border),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('Bolsa de Nueva York · Café C Dic 2026', style: TextStyle(fontSize: 13, color: AvColors.fgMuted)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: AvColors.accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Text(
                    'ICE',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: AvColors.accent),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ..._body(),
          ],
        ),
      ),
    );
  }

  List<Widget> _body() {
    if (_loading) {
      return [Text('Cargando…', style: TextStyle(fontSize: 13, color: AvColors.fgMuted))];
    }
    final d = _data;
    if (_failed || d == null || d['price'] == null) {
      return [Text('No disponible', style: TextStyle(fontSize: 15, color: AvColors.fgMuted))];
    }

    final change = d['change'] as num?;
    final changePct = d['changePct'] as num?;
    final low = d['dayLow'] as num?;
    final high = d['dayHigh'] as num?;
    final prev = d['previousClose'] as num?;
    final quotedAt = d['quotedAt'] as String?;
    final color = (change ?? 0) >= 0 ? AvColors.positive : AvColors.danger;
    final time = quotedAt == null
        ? null
        : DateFormat("d MMM, HH:mm", 'es').format(DateTime.parse(quotedAt).toUtc().subtract(const Duration(hours: 5)));

    TextStyle label() => TextStyle(fontSize: 11, color: AvColors.fgMuted);

    return [
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.end,
        spacing: 10,
        children: [
          Text(_price.format(d['price'] as num), style: mono(size: 30, weight: FontWeight.w700, spacing: -0.5)),
          Padding(
            padding: const EdgeInsets.only(bottom: 5),
            child: Text('c/lb', style: TextStyle(fontSize: 13, color: AvColors.fgMuted)),
          ),
          if (change != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Text(
                '${_signed(change)}${changePct != null ? ' (${_signed(changePct)}%)' : ''}',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color),
              ),
            ),
        ],
      ),
      const SizedBox(height: 10),
      Divider(height: 1, color: AvColors.border),
      const SizedBox(height: 10),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Cierre anterior', style: label()),
                const SizedBox(height: 2),
                Text(prev != null ? _price.format(prev) : '—', style: mono(size: 14, weight: FontWeight.w600)),
              ],
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rango del día', style: label()),
                const SizedBox(height: 2),
                Text(
                  low != null && high != null ? '${_price.format(low)} - ${_price.format(high)}' : '—',
                  style: mono(size: 14, weight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ],
      ),
      const SizedBox(height: 8),
      Text(
        '${time != null ? 'Última cotización: $time (hora de Colombia)' : 'Última cotización no disponible'} · con unos minutos de retraso',
        style: TextStyle(fontSize: 11, color: AvColors.fgMuted, height: 1.5),
      ),
    ];
  }
}
