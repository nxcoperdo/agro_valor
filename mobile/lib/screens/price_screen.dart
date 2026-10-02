import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../api/api_client.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

final _int = NumberFormat('#,##0', 'es_CO');
final _two = NumberFormat('#,##0.00', 'en_US');

class PriceScreen extends StatelessWidget {
  const PriceScreen({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      load: session.api.currentPrice,
      builder: (context, market) {
        final internal = market['internal'] as Json?;
        final international = market['international'] as Json?;
        final parity = market['exportParity'] as Json?;
        final exchange = market['exchangeRate'] as Json?;

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            if (internal != null) ...[_InternalCard(internal: internal), const SizedBox(height: 12)],
            if (international != null) ...[
              _MarketCard(international: international, exchange: exchange),
              const SizedBox(height: 12),
            ],
            _ChartPanel(session: session),
            if (parity != null) ...[
              const SizedBox(height: 12),
              _ParityCard(parity: parity, international: international, exchange: exchange),
            ],
          ],
        );
      },
    );
  }
}

// --- Piezas comunes del diseño -------------------------------------------------------

class _Card extends StatelessWidget {
  const _Card({required this.child, this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 16), this.radius = 16});

  final Widget child;
  final EdgeInsets padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AvColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AvColors.border),
      ),
      padding: padding,
      child: child,
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text, {required this.color, this.caps = false});

  final String text;
  final Color color;
  final bool caps;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: caps ? 10 : 8, vertical: caps ? 3 : 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(100)),
      child: Text(
        caps ? text.toUpperCase() : text,
        style: TextStyle(
          fontSize: caps ? 10 : 11,
          fontWeight: caps ? FontWeight.w700 : FontWeight.w600,
          letterSpacing: caps ? 0.8 : null,
          color: color,
        ),
      ),
    );
  }
}

const _muted13 = TextStyle(fontSize: 13, color: AvColors.fgMuted);
const _muted11 = TextStyle(fontSize: 11, color: AvColors.fgMuted, height: 1.5);

// --- Tarjetas de precio -------------------------------------------------------------

class _InternalCard extends StatelessWidget {
  const _InternalCard({required this.internal});

  final Json internal;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat("d 'de' MMM", 'es').format(DateTime.parse(internal['scrapedAt'] as String).toLocal());
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Lo que le pagan al caficultor', style: _muted13),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _int.format(internal['copPerCarga'] as num),
                style: mono(size: 36, weight: FontWeight.w700, spacing: -1),
              ),
              const SizedBox(width: 6),
              const Text('\$', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500, color: AvColors.fgMuted)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'por carga de ${internal['cargaKg']} kg de pergamino seco, factor de rendimiento $referenceFactor',
            style: _muted13,
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, thickness: 1, color: AvColors.border),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Factor $referenceFactor', style: _muted13),
              Text('${_int.format(internal['copPerCarga'] as num)} \$', style: mono(size: 13)),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Factor 88', style: _muted13),
              Text(
                '${_int.format(copPerCargaAtFactor(internal['copPerCarga'] as num, 88))} \$',
                style: mono(size: 13),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, thickness: 1, color: AvColors.border),
          const SizedBox(height: 10),
          Row(
            children: [
              const _Tag('FNC', color: AvColors.accent),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${internal['label']} · $date',
                  style: const TextStyle(fontSize: 12, color: AvColors.fgMuted),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MarketCard extends StatelessWidget {
  const _MarketCard({required this.international, required this.exchange});

  final Json international;
  final Json? exchange;

  @override
  Widget build(BuildContext context) {
    final usdCarga = usdPerLbToCarga(international['usdPerLb'] as num);
    final rate = exchange?['rate'] as num?;
    final change = international['changePct'] as num?;
    final real = international['source'] == 'real';
    final monthly = international['granularity'] == 'mensual';
    final meta = [
      international['exchange'] ?? 'Bolsa',
      if (international['quotedAt'] != null) 'cotización ${timeAgo(international['quotedAt'] as String)}',
      if (rate != null) '1 USD ≈ ${_int.format(rate)} \$',
      if (monthly) 'promedio del mes',
    ].join(' · ');

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Mercado internacional${international['contract'] != null ? ' · ${international['contract']}' : ''}',
                  style: _muted13,
                ),
              ),
              _Tag(
                !real ? 'Simulado' : (monthly ? 'Dato mensual' : 'En vivo'),
                color: real && !monthly ? AvColors.positive : AvColors.accent,
                caps: true,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: 10,
            children: [
              Text('US\$ ${_two.format(usdCarga)}', style: mono(size: 30, weight: FontWeight.w700, spacing: -0.5)),
              if (change != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Text(
                    formatPct(change),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: change >= 0 ? AvColors.positive : AvColors.danger,
                    ),
                  ),
                ),
            ],
          ),
          if (rate != null) ...[
            const SizedBox(height: 4),
            Text.rich(
              TextSpan(
                style: _muted13,
                children: [
                  const TextSpan(text: '≈ '),
                  TextSpan(text: '${_int.format(usdCarga * rate)} \$', style: mono(size: 13)),
                  const TextSpan(text: ' por carga'),
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Text(meta, style: _muted11),
        ],
      ),
    );
  }
}

class _ParityCard extends StatefulWidget {
  const _ParityCard({required this.parity, required this.international, required this.exchange});

  final Json parity;
  final Json? international;
  final Json? exchange;

  @override
  State<_ParityCard> createState() => _ParityCardState();
}

class _ParityCardState extends State<_ParityCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final p = widget.parity;
    final rows = [
      if (widget.international != null)
        ('Precio ICE', 'US\$ ${_two.format(usdPerLbToCarga(widget.international!['usdPerLb'] as num))}'),
      ('Prima Colombia', '+US\$ ${_two.format((p['premiumUsdPerLb'] as num) * (p['excelsoLbPerCarga'] as num))}'),
      if (widget.exchange != null) ('TRM', '${_int.format(widget.exchange!['rate'] as num)} \$'),
      ('Factor de rendimiento', '${p['factor']}'),
    ];

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => _open = !_open),
      child: _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Paridad de exportación', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${_int.format(p['copPerCarga'] as num)} ',
                              style: mono(size: 18, weight: FontWeight.w700, color: AvColors.accent),
                            ),
                            const TextSpan(
                              text: '\$ por carga',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AvColors.accent),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                AnimatedRotation(
                  turns: _open ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.expand_more_rounded, color: AvColors.fgMuted),
                ),
              ],
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              child: !_open
                  ? const SizedBox(width: double.infinity)
                  : Column(
                      children: [
                        const SizedBox(height: 12),
                        const Divider(height: 1, thickness: 1, color: AvColors.border),
                        const SizedBox(height: 8),
                        for (final (k, v) in rows)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [Text(k, style: _muted13), Text(v, style: mono(size: 13))],
                            ),
                          ),
                        const SizedBox(height: 4),
                        Text(p['note'] as String? ?? '', style: _muted11),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

// --- Velas ---------------------------------------------------------------------------

class Candle {
  Candle(this.day, this.open) : high = open, low = open, close = open;

  final DateTime day;
  final double open;
  double high;
  double low;
  double close;
  String label = '';

  bool get isUp => close >= open;
}

/// Agrupa el histórico por día (hora de Colombia, UTC-5) en velas de apertura/máximo/mínimo/cierre.
List<Candle> buildCandles(List<dynamic> history, int days) {
  final byDay = <String, Candle>{};
  for (final raw in history) {
    final row = raw as Json;
    final at = DateTime.parse((row['fetchedAt'] ?? row['quotedAt']) as String).toUtc().subtract(const Duration(hours: 5));
    final key = '${at.year}-${at.month}-${at.day}';
    final value = usdPerLbToCarga(row['usdPerLb'] as num);
    final c = byDay[key];
    if (c == null) {
      byDay[key] = Candle(at, value);
    } else {
      c.high = math.max(c.high, value);
      c.low = math.min(c.low, value);
      c.close = value;
    }
  }

  final fmt = days <= 7 ? DateFormat('EEE', 'es') : (days <= 90 ? DateFormat('d MMM', 'es') : DateFormat('MMM yy', 'es'));
  return byDay.values.map((c) => c..label = fmt.format(c.day)).toList();
}

const _periods = [('7D', 7, 3), ('30D', 30, 7), ('90D', 90, 14), ('1A', 365, 30)];

class _ChartPanel extends StatefulWidget {
  const _ChartPanel({required this.session});

  final Session session;

  @override
  State<_ChartPanel> createState() => _ChartPanelState();
}

class _ChartPanelState extends State<_ChartPanel> {
  final _cache = <String, List<Candle>>{};
  String _period = '30D';
  bool _showMA = true;
  int? _hover;
  List<Candle> _data = const [];
  String? _error;
  bool _loading = true;

  (String, int, int) get _p => _periods.firstWhere((p) => p.$1 == _period);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final (id, days, _) = _p;
    setState(() {
      _loading = !_cache.containsKey(id);
      _error = null;
      _hover = null;
    });
    try {
      _cache[id] ??= buildCandles(await widget.session.api.priceHistory(days), days);
      if (!mounted || id != _period) return;
      setState(() {
        _data = _cache[id]!;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo cargar el histórico: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final enough = _data.length >= 2;
    return _Card(
      padding: EdgeInsets.zero,
      radius: 20,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _summary(enough),
                const SizedBox(height: 12),
                _controls(),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: _loading
                ? const SizedBox(height: 200, child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
                : !enough
                    ? SizedBox(
                        height: 120,
                        child: Center(
                          child: Text(
                            _error ?? 'Aún no hay suficiente histórico para este periodo.',
                            textAlign: TextAlign.center,
                            style: _muted13,
                          ),
                        ),
                      )
                    : _CandleChart(
                        data: _data,
                        showMA: _showMA,
                        maWindow: _p.$3,
                        hover: _hover,
                        onHover: (i) => setState(() => _hover = i),
                      ),
          ),
          if (enough) _ohlc(_data.last),
        ],
      ),
    );
  }

  Widget _summary(bool enough) {
    final last = enough ? _data.last : null;
    final prev = enough ? _data[_data.length - 2] : null;
    final isUp = last != null && last.close >= prev!.close;
    final changePct = last != null ? (last.close - prev!.close) / prev.close * 100 : 0.0;
    final upCount = _data.where((d) => d.isUp).length;
    final color = isUp ? AvColors.positive : AvColors.danger;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'HISTÓRICO · US\$ POR CARGA',
                style: TextStyle(fontSize: 10, color: AvColors.fgMuted, letterSpacing: 1, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 5),
              if (last != null)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(_two.format(last.close), style: mono(size: 26, weight: FontWeight.w700, spacing: -0.5)),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${isUp ? '▲' : '▼'} ${changePct.abs().toStringAsFixed(2)}%',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color),
                      ),
                    ),
                  ],
                )
              else
                const SizedBox(height: 34),
            ],
          ),
        ),
        if (enough)
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                children: [
                  Text('▲$upCount', style: mono(size: 11, color: AvColors.positive)),
                  const SizedBox(width: 8),
                  Text('▼${_data.length - upCount}', style: mono(size: 11, color: AvColors.danger)),
                ],
              ),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: SizedBox(
                  width: 70,
                  height: 4,
                  child: Stack(
                    children: [
                      Container(color: AvColors.danger.withValues(alpha: 0.25)),
                      FractionallySizedBox(
                        widthFactor: upCount / _data.length,
                        child: Container(color: AvColors.positive),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
      ],
    );
  }

  Widget _controls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(9)),
          child: Row(
            children: [
              for (final (id, _, _) in _periods)
                GestureDetector(
                  onTap: () {
                    if (id == _period) return;
                    _period = id;
                    _load();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.symmetric(horizontal: 1),
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
                    decoration: BoxDecoration(
                      color: id == _period ? AvColors.accent : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      id,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4,
                        color: id == _period ? AvColors.onAccent : AvColors.fgMuted,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => setState(() => _showMA = !_showMA),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _showMA ? AvColors.ma.withValues(alpha: 0.1) : Colors.transparent,
              borderRadius: BorderRadius.circular(7),
              border: Border.all(color: _showMA ? AvColors.ma.withValues(alpha: 0.5) : AvColors.border),
            ),
            child: Text(
              'MA ${_p.$3}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _showMA ? AvColors.ma : AvColors.fgMuted,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _ohlc(Candle last) {
    final cells = [
      ('APERTURA', last.open, AvColors.fg),
      ('MÁXIMO', last.high, AvColors.positive),
      ('MÍNIMO', last.low, AvColors.danger),
      ('CIERRE', last.close, AvColors.fg),
    ];
    return Container(
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: AvColors.border))),
      child: IntrinsicHeight(
        child: Row(
          children: [
            for (var i = 0; i < cells.length; i++) ...[
              if (i > 0) const VerticalDivider(width: 1, thickness: 1, color: AvColors.border),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(
                    children: [
                      Text(
                        cells[i].$1,
                        style: const TextStyle(
                          fontSize: 9,
                          color: AvColors.fgMuted,
                          letterSpacing: 0.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(_two.format(cells[i].$2), style: mono(size: 13, weight: FontWeight.w700, color: cells[i].$3)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CandleChart extends StatelessWidget {
  const _CandleChart({
    required this.data,
    required this.showMA,
    required this.maWindow,
    required this.hover,
    required this.onHover,
  });

  final List<Candle> data;
  final bool showMA;
  final int maWindow;
  final int? hover;
  final ValueChanged<int?> onHover;

  static const height = 200.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final slotW = (width - _CandlePainter.padLeft - _CandlePainter.padRight) / data.length;

        void hoverAt(double x) {
          final i = ((x - _CandlePainter.padLeft) / slotW - 0.5).round();
          final next = i >= 0 && i < data.length ? i : null;
          if (next != hover) onHover(next);
        }

        final d = hover != null ? data[hover!] : null;

        return Listener(
          onPointerDown: (e) => hoverAt(e.localPosition.dx),
          onPointerMove: (e) => hoverAt(e.localPosition.dx),
          onPointerUp: (_) => onHover(null),
          onPointerCancel: (_) => onHover(null),
          child: SizedBox(
            height: height,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _CandlePainter(data: data, showMA: showMA, maWindow: maWindow, hover: hover),
                  ),
                ),
                if (d != null)
                  Positioned(
                    top: 8,
                    left: hover! > data.length / 2 ? 8 : null,
                    right: hover! <= data.length / 2 ? 8 : null,
                    child: _Tooltip(candle: d),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Tooltip extends StatelessWidget {
  const _Tooltip({required this.candle});

  final Candle candle;

  @override
  Widget build(BuildContext context) {
    final color = candle.isUp ? AvColors.positive : AvColors.danger;
    final change = (candle.close - candle.open) / candle.open * 100;
    const labelStyle = TextStyle(fontSize: 11, color: Color(0x73E8F5E9));

    return IgnorePointer(
      child: Container(
        constraints: const BoxConstraints(minWidth: 148),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AvColors.tooltip,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.4)),
          boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 32, offset: Offset(0, 8))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(candle.label, style: mono(size: 10, color: const Color(0x80E8F5E9), spacing: 0.5)),
            const SizedBox(height: 7),
            for (final (k, v) in [
              ('Apertura', candle.open),
              ('Máximo', candle.high),
              ('Mínimo', candle.low),
              ('Cierre', candle.close),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(width: 60, child: Text(k, style: labelStyle)),
                    const SizedBox(width: 14),
                    Text(_two.format(v), style: mono(size: 12, weight: FontWeight.w600)),
                  ],
                ),
              ),
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.only(top: 7),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0x0FFFFFFF)))),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(width: 60, child: Text('Cambio', style: labelStyle)),
                  const SizedBox(width: 14),
                  Text(
                    '${candle.isUp ? '+' : ''}${change.toStringAsFixed(2)}%',
                    style: mono(size: 13, weight: FontWeight.w700, color: color),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CandlePainter extends CustomPainter {
  _CandlePainter({required this.data, required this.showMA, required this.maWindow, required this.hover});

  final List<Candle> data;
  final bool showMA;
  final int maWindow;
  final int? hover;

  static const padTop = 10.0;
  static const padRight = 8.0;
  static const padBottom = 20.0;
  static const padLeft = 46.0;

  @override
  void paint(Canvas canvas, Size size) {
    final chartW = size.width - padLeft - padRight;
    final chartH = size.height - padTop - padBottom;
    final n = data.length;

    var minP = data.map((d) => d.low).reduce(math.min);
    var maxP = data.map((d) => d.high).reduce(math.max);
    var pad = (maxP - minP) * 0.1;
    if (pad == 0) pad = maxP * 0.01;
    minP -= pad;
    maxP += pad;

    double py(double p) => padTop + chartH - (p - minP) / (maxP - minP) * chartH;
    final slotW = chartW / n;
    final candleW = math.max(2.0, slotW * 0.6);
    double cx(int i) => padLeft + i * slotW + slotW / 2;

    final axisStyle = mono(size: 9, color: AvColors.fgFaint);
    void label(String text, Offset at, {TextAlign align = TextAlign.right, TextStyle? style}) {
      final tp = TextPainter(
        text: TextSpan(text: text, style: style ?? axisStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      final dx = switch (align) {
        TextAlign.right => at.dx - tp.width,
        TextAlign.center => at.dx - tp.width / 2,
        _ => at.dx,
      };
      tp.paint(canvas, Offset(dx, at.dy - tp.height / 2));
    }

    // Cuadrícula y eje Y
    final grid = Paint()
      ..color = const Color(0x0DFFFFFF)
      ..strokeWidth = 1;
    for (var i = 0; i <= 5; i++) {
      final t = minP + i * (maxP - minP) / 5;
      canvas.drawLine(Offset(padLeft, py(t)), Offset(size.width - padRight, py(t)), grid);
      label(t.toStringAsFixed(0), Offset(padLeft - 4, py(t)));
    }

    // Eje X
    final count = math.min(n, n <= 7 ? n : (n <= 90 ? 6 : 7));
    final step = math.max(1, n ~/ math.max(1, count - 1));
    final xTicks = <int>{for (var i = 0; i < count - 1; i++) i * step, n - 1};
    for (final i in xTicks.where((i) => i < n)) {
      label(data[i].label, Offset(cx(i), size.height - padBottom / 2 + 4), align: TextAlign.center);
    }

    // Velas
    for (var i = 0; i < n; i++) {
      final d = data[i];
      final color = (d.isUp ? AvColors.positive : AvColors.danger)
          .withValues(alpha: hover != null && hover != i ? 0.35 : 1);
      final stroke = Paint()
        ..color = color
        ..style = PaintingStyle.stroke;
      canvas.drawLine(Offset(cx(i), py(d.high)), Offset(cx(i), py(d.low)), stroke..strokeWidth = 1.2);

      final top = py(math.max(d.open, d.close));
      final bodyH = math.max(1.5, py(math.min(d.open, d.close)) - top);
      final body = RRect.fromRectAndRadius(
        Rect.fromLTWH(cx(i) - candleW / 2, top, candleW, bodyH),
        const Radius.circular(1.5),
      );
      if (d.isUp) canvas.drawRRect(body, Paint()..color = color);
      canvas.drawRRect(body, stroke..strokeWidth = 1.5);
    }

    // Media móvil
    if (showMA && n >= maWindow) {
      final path = Path();
      var started = false;
      for (var i = maWindow - 1; i < n; i++) {
        var sum = 0.0;
        for (var j = i - maWindow + 1; j <= i; j++) {
          sum += data[j].close;
        }
        final p = Offset(cx(i), py(sum / maWindow));
        started ? path.lineTo(p.dx, p.dy) : path.moveTo(p.dx, p.dy);
        started = true;
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = AvColors.ma
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeJoin = StrokeJoin.round
          ..strokeCap = StrokeCap.round,
      );
    }

    // Cruz de lectura
    if (hover != null) {
      final d = data[hover!];
      final y = py(d.close);
      _dashed(canvas, Offset(cx(hover!), padTop), Offset(cx(hover!), size.height - padBottom), const Color(0x26FFFFFF));
      _dashed(canvas, Offset(padLeft, y), Offset(size.width - padRight, y), const Color(0x1AFFFFFF));
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(0, y - 9, padLeft - 2, 16), const Radius.circular(3)),
        Paint()..color = d.isUp ? AvColors.positive : AvColors.danger,
      );
      label(
        d.close.toStringAsFixed(0),
        Offset(padLeft - 4, y - 1),
        style: mono(size: 8, weight: FontWeight.w700, color: AvColors.onAccent),
      );
    }
  }

  void _dashed(Canvas canvas, Offset a, Offset b, Color color) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    final total = (b - a).distance;
    final dir = (b - a) / total;
    for (var t = 0.0; t < total; t += 6) {
      canvas.drawLine(a + dir * t, a + dir * math.min(t + 3, total), paint);
    }
  }

  @override
  bool shouldRepaint(_CandlePainter old) =>
      old.data != data || old.showMA != showMA || old.maWindow != maWindow || old.hover != hover;
}
