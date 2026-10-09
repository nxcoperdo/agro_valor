const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('../services/netPriceService');

const BASE = 1_000_000;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);

test('sin ajustes (factor 94, 12% de humedad) el neto es el precio base', () => {
  const r = net.calculate({ basePriceCopCarga: BASE });
  close(r.netPerCarga, BASE);
  assert.equal(r.total, BASE);
  assert.equal(r.differenceVsBase, 0);
});

test('factor menor al base sube el valor en proporción inversa', () => {
  const r = net.calculate({ basePriceCopCarga: BASE, factor: 88 });
  close(r.netPerCarga, (BASE * 94) / 88);
});

test('humedad por encima de 12% descuenta agua', () => {
  const r = net.calculate({ basePriceCopCarga: BASE, humidity: 15 });
  close(r.netPerCarga, (BASE * 85) / 88);
});

test('humedad por debajo de 12% no da bonificación', () => {
  const r = net.calculate({ basePriceCopCarga: BASE, humidity: 0 });
  close(r.netPerCarga, BASE);
});

test('la pasilla se descuenta como proporción', () => {
  const r = net.calculate({ basePriceCopCarga: BASE, pasillaPct: 5 });
  close(r.netPerCarga, BASE * 0.95);
});

test('el transporte se resta al final y el total multiplica por cargas', () => {
  const r = net.calculate({ basePriceCopCarga: BASE, transportCostCopCarga: 20_000, cargas: 3 });
  close(r.netPerCarga, BASE - 20_000);
  close(r.total, (BASE - 20_000) * 3);
});

test('transporte mayor al valor deja el neto en cero y el desglose cuadra', () => {
  const r = net.calculate({ basePriceCopCarga: 100_000, transportCostCopCarga: 500_000 });
  assert.equal(r.netPerCarga, 0);
  const transport = r.breakdown.find((s) => s.key === 'transport');
  close(transport.delta, -100_000);
  assert.equal(transport.amount, 0);
});

test('el último paso del desglose es el neto por carga', () => {
  const r = net.calculate({ basePriceCopCarga: BASE, factor: 90, humidity: 14, pasillaPct: 3, transportCostCopCarga: 15_000 });
  close(r.breakdown[r.breakdown.length - 1].amount, r.netPerCarga);
});

test('valores fuera de rango se rechazan con 400 y un mensaje claro', () => {
  const bad = [
    [{ factor: 50 }, /factor.*entre 60 y 140/i],
    [{ humidity: 99 }, /humedad.*entre 0 y 30/i],
    [{ pasillaPct: 90 }, /pasilla.*entre 0 y 40/i],
    [{ cargas: -2 }, /cargas.*entre 0 y 10000/i],
    [{ transportCostCopCarga: -1 }, /transporte/i],
  ];
  for (const [extra, msg] of bad) {
    assert.throws(() => net.calculate({ basePriceCopCarga: BASE, ...extra }), (e) => e.status === 400 && msg.test(e.message));
  }
});

test('un valor que no es número se rechaza; vacío o ausente usa el valor base', () => {
  assert.throws(() => net.calculate({ basePriceCopCarga: BASE, humidity: 'abc' }), (e) => e.status === 400);
  const r = net.calculate({ basePriceCopCarga: BASE, factor: '', humidity: undefined, cargas: null });
  assert.equal(r.inputs.factor, net.BASE_FACTOR);
  assert.equal(r.inputs.humidity, net.BASE_HUMIDITY);
  assert.equal(r.inputs.cargas, 1);
});

test('sin precio base válido responde 400', () => {
  for (const bad of [undefined, 0, -5, 'x']) {
    assert.throws(() => net.calculate({ basePriceCopCarga: bad }), (e) => e.status === 400);
  }
});

test('compareAcrossCooperatives ordena de mayor a menor neto y marca mejor, peor y diferencia', () => {
  const coops = [
    { id: 1, name: 'A', region: 'x', priceSource: 'reported', estimatedPriceCopCarga: 900_000 },
    { id: 2, name: 'B', region: 'x', priceSource: 'estimated', estimatedPriceCopCarga: 1_000_000 },
    { id: 3, name: 'C', region: 'x', priceSource: 'estimated', estimatedPriceCopCarga: 950_000 },
  ];
  const rows = net.compareAcrossCooperatives(coops, { cargas: 2 });
  assert.deepEqual(rows.map((r) => r.name), ['B', 'C', 'A']);
  assert.equal(rows[0].isBest, true);
  assert.equal(rows[2].isWorst, true);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  close(rows[2].lostVsBest, (1_000_000 - 900_000) * 2);
  assert.equal(rows[0].lostVsBest, 0);
});
