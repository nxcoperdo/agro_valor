import 'package:intl/intl.dart';

const cargaKg = 125;
const lbPerKg = 2.2046226218;
const lbPerCarga = cargaKg * lbPerKg;

/// La cotización internacional llega por libra; en la app siempre se muestra por carga.
double usdPerLbToCarga(num usdPerLb) => usdPerLb * lbPerCarga;

final _cop = NumberFormat.currency(locale: 'es_CO', symbol: r'$ ', decimalDigits: 0);
final _usd = NumberFormat.currency(locale: 'en_US', symbol: r'US$ ', decimalDigits: 2);

String formatCop(num? value) => value == null ? '—' : _cop.format(value);
String formatUsd(num? value) => value == null ? '—' : _usd.format(value);

/// Versión compacta ("$2.15M") para espacios chicos.
String formatCopShort(num? value) {
  if (value == null) return '—';
  if (value.abs() >= 1000000) return '\$${(value / 1000000).toStringAsFixed(2)}M';
  if (value.abs() >= 1000) return '\$${(value / 1000).round()}K';
  return formatCop(value);
}

String formatPct(num? value) {
  if (value == null) return '';
  return '${value >= 0 ? '+' : ''}${value.toStringAsFixed(2)}%';
}

String formatDate(String? iso) {
  if (iso == null) return '';
  return DateFormat("d 'de' MMM", 'es').format(DateTime.parse(iso).toLocal());
}

String timeAgo(String? iso) {
  if (iso == null) return '';
  final diff = DateTime.now().difference(DateTime.parse(iso));
  if (diff.inMinutes < 1) return 'hace un momento';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  return 'hace ${diff.inDays} d';
}

/// Fecha como la espera el API ("2026-09-25").
String isoDay(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
