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

/// El precio se define por carga (125 kg) o directamente por kilo; si viene [precioKg] manda ese,
/// igual que en el servidor.
PurchasePreview previewPurchase({
  required List<double> pesadasKg,
  required double mermaPct,
  double precioCarga = 0,
  double? precioKg,
}) {
  final total = _round2(pesadasKg.fold<double>(0, (a, b) => a + b));
  final descontados = _round2(total * mermaPct / 100);
  final pagable = _round2(total - descontados);
  final precioKgFinal = precioKg ?? precioCarga / cargaKgBase;
  return PurchasePreview(
    pesoTotal: total,
    kgDescontados: descontados,
    pesoPagable: pagable,
    precioKg: precioKgFinal,
    totalPagar: (pagable * precioKgFinal).round(),
  );
}

/// Tipo de producto que se puede comprar. La fuente es GET /api/coffee/product-types; esta lista
/// es el respaldo si no se puede pedir al servidor.
class ProductType {
  const ProductType(this.key, this.label, this.merma, this.requiresDrying);

  factory ProductType.fromJson(Map<String, dynamic> j) => ProductType(
        j['key'] as String,
        j['label'] as String,
        (j['mermaDefault'] as num).toDouble(),
        j['requiresDryingDefault'] == true,
      );

  final String key;
  final String label;
  final double merma;
  final bool requiresDrying;
}

const kProductTypes = [
  ProductType('cafe', 'Café', 8, true),
  ProductType('cacao', 'Cacao', 0, false),
  ProductType('pasilla_cafe', 'Pasilla de café', 0, false),
  ProductType('maiz', 'Maíz', 0, false),
  ProductType('frijol', 'Frijol', 0, false),
];

/// Merma por defecto según el tipo de producto (editable por el usuario). Incluye las claves
/// anteriores (cafe_verde, cafe_merma_5…): hay compras guardadas con ellas.
const mermaPorTipo = {
  'cafe': 8.0,
  'cacao': 0.0,
  'pasilla_cafe': 0.0,
  'maiz': 0.0,
  'frijol': 0.0,
  'cafe_verde': 8.0,
  'cafe_merma_5': 5.0,
  'cafe_sin_merma': 0.0,
  'otro': 0.0,
};
const nombreTipoCafe = {
  'cafe': 'Café',
  'cacao': 'Cacao',
  'pasilla_cafe': 'Pasilla de café',
  'maiz': 'Maíz',
  'frijol': 'Frijol',
  'cafe_verde': 'Café verde',
  'cafe_merma_5': 'Café con merma 5%',
  'cafe_sin_merma': 'Café sin merma',
  'otro': 'Otro',
};
