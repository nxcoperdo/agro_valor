const test = require('node:test');
const assert = require('node:assert/strict');
const q = require('../services/quickCalcService');

test('calculadora rápida: 1.000 kg, factor 88, $900.000/carga', () => {
  const r = q.calculate({ kilos: 1000, factor: 88, precioCarga: 900000 });
  assert.equal(r.numeroCargas, 8);
  assert.equal(r.precioKg, 7200);
  assert.equal(r.valorTotal, 7200000);
  assert.equal(r.factorRendimientoTrilla, 88);
});

test('comparar con precios propios de cada factor', () => {
  const r = q.compare({ kilos: 1000, opciones: [{ factor: 84, precioCarga: 1000000 }, { factor: 88, precioCarga: 950000 }, { factor: 90, precioCarga: 900000 }] });
  assert.equal(r.mayorValor.factor, 84);
  assert.deepEqual(r.filas.map((f) => f.diferencia), [8000000 - 7200000, 7600000 - 7200000, 0]);
  assert.equal(r.filas[0].cargas, 8);
});

test('comparar con precio de referencia: factorRef/factor × precioRef', () => {
  const r = q.compare({ kilos: 1000, referencia: { factor: 94, precioCarga: 940000 }, opciones: [{ factor: 88 }, { factor: 94 }] });
  assert.equal(r.filas[0].precioCarga, 1004091);
  assert.equal(r.filas[1].precioCarga, 940000);
  assert.equal(r.mayorValor.factor, 88);
});

test('validaciones', () => {
  assert.throws(() => q.calculate({ kilos: 0, precioCarga: 1 }), { status: 400 });
  assert.throws(() => q.calculate({ kilos: 10, precioCarga: 'x' }), { status: 400 });
  assert.throws(() => q.compare({ kilos: 10, opciones: [{ factor: 88, precioCarga: 1 }] }), { status: 400 });
});

test('comparar: con dos opciones del mismo factor solo se marca una como mayor valor', () => {
  const r = q.compare({ kilos: 1000, opciones: [{ factor: 88, precioCarga: 950000 }, { factor: 88, precioCarga: 950000 }, { factor: 90, precioCarga: 900000 }] });
  assert.deepEqual(r.filas.map((f) => f.esMayor), [true, false, false]);
});
