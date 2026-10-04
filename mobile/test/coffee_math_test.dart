import 'package:agro_valor/format.dart';
import 'package:agro_valor/screens/coffee/coffee_math.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('caso principal: 1.000 kg, merma 8%, carga \$900.000', () {
    final p = previewPurchase(pesadasKg: [520, 480], mermaPct: 8, precioCarga: 900000);
    expect(p.pesoTotal, 1000);
    expect(p.kgDescontados, 80);
    expect(p.pesoPagable, 920);
    expect(p.precioKg, 7200);
    expect(p.totalPagar, 6624000);
  });

  test('merma por defecto por tipo de café', () {
    expect(mermaPorTipo['cafe_verde'], 8);
    expect(mermaPorTipo['cafe_merma_5'], 5);
    expect(mermaPorTipo['cafe_sin_merma'], 0);
  });

  test('productos nuevos: merma 0 y sin secado (excepto el café)', () {
    expect(mermaPorTipo['cafe'], 8);
    for (final key in ['cacao', 'pasilla_cafe', 'maiz', 'frijol']) {
      expect(mermaPorTipo[key], 0, reason: key);
      final t = kProductTypes.firstWhere((t) => t.key == key);
      expect(t.merma, 0);
      expect(t.requiresDrying, false);
    }
    expect(kProductTypes.firstWhere((t) => t.key == 'cafe').requiresDrying, true);
    expect(nombreTipoCafe['maiz'], 'Maíz');
  });

  test('precio por kilo: total directo y manda sobre la carga', () {
    final p = previewPurchase(pesadasKg: [2000], mermaPct: 0, precioKg: 2500);
    expect(p.precioKg, 2500);
    expect(p.totalPagar, 5000000);
    final both = previewPurchase(pesadasKg: [1000], mermaPct: 0, precioCarga: 900000, precioKg: 2000);
    expect(both.totalPagar, 2000000);
  });

  test('el factor se muestra como Factor 88, nunca como porcentaje', () {
    expect(formatFactor(88), 'Factor 88');
    expect(formatFactor(88.5), 'Factor 88.5');
    expect(formatFactor(88).contains('%'), false);
  });
}
