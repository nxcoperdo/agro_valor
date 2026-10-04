import 'package:agro_valor/screens/coffee/coffee_lots_tab.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('todos los estados del lote tienen etiqueta en español', () {
    for (final s in ['CREADO', 'EN_TRANSPORTE', 'EN_SECADO', 'SECADO_FINALIZADO', 'DISPONIBLE_PARA_VENTA', 'PARCIALMENTE_VENDIDO', 'VENDIDO', 'CERRADO']) {
      expect(lotStatusLabels.containsKey(s), true, reason: s);
    }
    expect(lotStatusLabel('EN_SECADO'), 'En secado');
    expect(lotStatusLabel('RARO'), 'RARO');
    expect(lotStatusLabel(null), '—');
  });

  test('el flujo manual avanza CREADO → EN_TRANSPORTE → EN_SECADO y cierra lo vendido', () {
    expect(lotNextStep['CREADO']!.$1, 'EN_TRANSPORTE');
    expect(lotNextStep['EN_TRANSPORTE']!.$1, 'EN_SECADO');
    expect(lotNextStep['VENDIDO']!.$1, 'CERRADO');
    expect(lotNextStep.containsKey('EN_SECADO'), false); // de ahí sale registrando la salida real
  });
}
