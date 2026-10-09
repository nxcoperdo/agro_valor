import 'coffee_math.dart';

/// Formas de pago que acepta el servidor, con su etiqueta (mismas claves en compras y ventas).
const paymentLabels = {
  'efectivo': 'Efectivo',
  'transferencia': 'Transferencia',
  'credito': 'Crédito',
  'otro': 'Otro',
};

String paymentLabel(String? key) => paymentLabels[key] ?? (key ?? '—');

/// Tipos de identificación que acepta el servidor para clientes y proveedores.
const idTypes = ['CC', 'NIT', 'CE', 'PASAPORTE', 'OTRO'];

/// Equivale a Number.EPSILON de JavaScript: el servidor lo suma antes de redondear (1,005 → 1,01).
const _epsilon = 2.220446049250313e-16;

/// Kilos con 2 decimales, como los guarda el servidor.
double roundKg(double kg) => ((kg + _epsilon) * 100).round() / 100;

/// Subtotal de una línea de venta, igual que el servidor: kg × precio por kilo, o kg × precio por carga ÷ 125.
int saleLineSubtotal({required double kg, required double price, required bool byKg}) {
  final perKg = byKg ? price : price / cargaKgBase;
  return (roundKg(kg) * perKg).round();
}

/// Cuánto se puede vender de un lote: lo disponible, con el mismo redondeo de kilos.
double maxSellableKg(num? available) => roundKg((available ?? 0).toDouble());

/// Kilos del campo, o 0 si está vacío o no es válido.
double kgOrZero(double? parsed) => parsed != null && parsed > 0 ? parsed : 0;

/// Resumen de una venta ya registrada: kilos totales de sus líneas (la lista no trae el total de kilos).
double saleKg(Iterable<Map<String, dynamic>> items) =>
    roundKg(items.fold<double>(0, (a, i) => a + ((i['kg'] as num?)?.toDouble() ?? 0)));

/// Suma de las ventas activas (las anuladas no cuentan).
int activeSalesTotal(Iterable<Map<String, dynamic>> sales) => sales
    .where((s) => s['status'] != 'ANULADA')
    .fold<int>(0, (a, s) => a + ((s['total'] as num?)?.round() ?? 0));
