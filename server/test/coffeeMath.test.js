const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../domain/coffeeMath');

test('caso principal: 1.000 kg, merma 8%, carga $900.000', () => {
  const c = m.calcularCompra({ pesadasKg: [1000], porcentajeMermaInicial: 8, precioCarga: 900000 });
  assert.equal(c.kgDescontados, 80);
  assert.equal(c.pesoPagable, 920);
  assert.equal(c.precioKg, 7200);
  assert.equal(c.totalCompra, 6624000);
  assert.equal(m.calcularKilosSecosProyectados(920, 55), 506);
});

test('múltiples pesadas suman 1.000 kg (520 + 480) y aceptan decimales', () => {
  assert.equal(m.sumarPesadas([520, 480]), 1000);
  assert.equal(m.sumarPesadas([520.5, '479.5']), 1000);
});

test('merma por defecto según tipo de café', () => {
  assert.equal(m.mermaPorDefecto('cafe_verde'), 8);
  assert.equal(m.mermaPorDefecto('cafe_merma_5'), 5);
  assert.equal(m.mermaPorDefecto('cafe_sin_merma'), 0);
});

test('costo de adquisición y proyección completa', () => {
  assert.equal(m.calcularCostoAdquisicion(6624000, [{ valor: 20000 }, { valor: 10000 }]), 6654000);
  const p = m.calcularProyeccion({
    pesoPagable: 920,
    totalCompra: 6624000,
    costosAsociados: [{ valor: 30000 }],
    costosProyectados: [{ valor: 300, modo: 'por_kg' }, { valor: 50000, modo: 'total' }],
    destareProyectadoKg: 6,
    precioVentaCarga: 1000000,
  });
  assert.equal(p.kilosSecosProyectados, 506);
  assert.equal(p.kilosNetosProyectados, 500);
  assert.equal(p.costosProcesamientoProyectados, 506 * 300 + 50000);
  assert.equal(p.costoTotalProyectado, 6624000 + 30000 + 201800);
  assert.equal(p.costoMinimoKg, Math.round(p.costoTotalProyectado / 500));
  assert.equal(p.ingresoProyectado, 500 * 8000);
  assert.equal(p.utilidadProyectada, 4000000 - p.costoTotalProyectado);
  assert.ok(Math.abs(p.margen - (p.utilidadProyectada / 4000000) * 100) < 0.01);
});

test('resultado real: rendimiento 56,30% y costos reales', () => {
  const r = m.calcularResultadoReal({
    pesoPagable: 920,
    totalCompra: 6624000,
    costosCompra: [{ valor: 30000 }],
    costosProcesamientoReales: [{ valor: 150000 }],
    kilosSecosReales: 518,
    destareRealKg: 0,
  });
  assert.equal(r.rendimientoReal, 56.3);
  assert.equal(r.kilosNetosReales, 518);
  assert.equal(r.costoRealTotal, 6804000);
  assert.equal(r.costoRealKg, Math.round(6804000 / 518));
  assert.equal(r.costoRealCarga, Math.round((6804000 / 518) * 125));
});

test('calculadora rápida y comparación de factores', () => {
  const r = m.calcularRapido({ kilos: 1000, precioCarga: 900000 });
  assert.deepEqual(r, { numeroCargas: 8, precioKg: 7200, valorTotal: 7200000 });
  assert.equal(m.precioSegunFactor({ factorReferencia: 94, factorEvaluado: 88, precioReferencia: 940000 }), 1004091);
  const t = m.compararFactores({
    kilos: 1000,
    opciones: [{ factor: 84, precioCarga: 1000000 }, { factor: 88, precioCarga: 950000 }],
  });
  assert.equal(t.mayorValor.factor, 84);
  assert.equal(t.filas[0].diferencia, 8000000 - 7600000);
  assert.equal(t.filas[1].diferencia, 0);
});

test('rentabilidad: ingreso - costo real = utilidad real', () => {
  const r = m.calcularRentabilidadVenta({ ingresoVenta: 5000000, kgVendidos: 500, costoUnitarioKg: 13136 });
  assert.equal(r.costoMercanciaVendida, 6568000);
  assert.equal(r.utilidadReal, 5000000 - 6568000);
});

test('valida entradas inválidas', () => {
  assert.throws(() => m.calcularPesoPagable(-1, 8), { status: 400 });
  assert.throws(() => m.calcularPesoPagable(100, 120), { status: 400 });
  assert.throws(() => m.sumarPesadas(['abc']), { status: 400 });
});
