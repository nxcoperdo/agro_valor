/// Vista previa de una compra en pantalla. El servidor recalcula y es quien guarda
/// (server/domain/coffeeMath.js); estas cuentas solo muestran el resultado mientras se escribe.
const cargaKgBase = 125;

class PurchasePreview {
  const PurchasePreview({
    required this.pesoTotal,
    required this.kgDescontados,
    required this.pesoPagable,
    required this.precioKg,
    required this.totalPagar,
  });

  final double pesoTotal;
  final double kgDescontados;
  final double pesoPagable;
  final double precioKg;
  final int totalPagar;
}

double _round2(double v) => (v * 100).roundToDouble() / 100;

PurchasePreview previewPurchase({
  required List<double> pesadasKg,
  required double mermaPct,
  required double precioCarga,
}) {
  final total = _round2(pesadasKg.fold<double>(0, (a, b) => a + b));
  final descontados = _round2(total * mermaPct / 100);
  final pagable = _round2(total - descontados);
  final precioKg = precioCarga / cargaKgBase;
  return PurchasePreview(
    pesoTotal: total,
    kgDescontados: descontados,
    pesoPagable: pagable,
    precioKg: precioKg,
    totalPagar: (pagable * precioKg).round(),
  );
}

/// Merma por defecto según el tipo de café (editable por el usuario).
const mermaPorTipo = {'cafe_verde': 8.0, 'cafe_merma_5': 5.0, 'cafe_sin_merma': 0.0, 'otro': 0.0};
const nombreTipoCafe = {
  'cafe_verde': 'Café verde',
  'cafe_merma_5': 'Café con merma 5%',
  'cafe_sin_merma': 'Café sin merma',
  'otro': 'Otro',
};
