const test = require('node:test');
const assert = require('node:assert/strict');

// parseNumber vive en el front (ESM); debe dar lo mismo que parseDecimal de la app (mobile/test/parse_decimal_test.dart).
const load = () => import('../../js/utils/format.js');

const cases = [
  ['12,5', 12.5],
  ['12.5', 12.5],
  ['88.5', 88.5],
  ['9500.5', 9500.5],
  ['0.500', 0.5],
  ['1.250', 1250],
  ['900.000', 900000],
  ['1.234.567', 1234567],
  ['1.234,5', 1234.5],
  ['9.500', 9500],
  ['125', 125],
  [' 1 250 ', 1250],
];

for (const [input, expected] of cases) {
  test(`parseNumber("${input}") = ${expected}`, async () => {
    const { parseNumber } = await load();
    assert.equal(parseNumber(input), expected);
  });
}

test('parseNumber rechaza vacío y texto', async () => {
  const { parseNumber } = await load();
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber(null)));
});

test('parseNumber deja pasar números', async () => {
  const { parseNumber } = await load();
  assert.equal(parseNumber(42), 42);
});
