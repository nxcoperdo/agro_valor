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

  test('el factor se muestra como Factor 88, nunca como porcentaje', () {
    expect(formatFactor(88), 'Factor 88');
    expect(formatFactor(88.5), 'Factor 88.5');
    expect(formatFactor(88).contains('%'), false);
  });
}
