import 'package:flutter_test/flutter_test.dart';
import 'package:agro_valor/widgets/forms.dart';

// Mismos casos que server/test/parseNumber.test.js: web y app deben leer igual lo que escribe el usuario.
void main() {
  const cases = <String, double>{
    '12,5': 12.5,
    '12.5': 12.5,
    '88.5': 88.5,
    '9500.5': 9500.5,
    '0.500': 0.5,
    '1.250': 1250,
    '900.000': 900000,
    '1.234.567': 1234567,
    '1.234,5': 1234.5,
    '9.500': 9500,
    '125': 125,
    ' 1 250 ': 1250,
  };

  cases.forEach((input, expected) {
    test('parseDecimal("$input") = $expected', () {
      expect(parseDecimal(input), expected);
    });
  });

  test('parseDecimal rechaza vacío y texto', () {
    expect(parseDecimal(''), isNull);
    expect(parseDecimal('abc'), isNull);
  });
}
