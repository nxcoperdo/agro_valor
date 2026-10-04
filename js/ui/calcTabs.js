/**
 * Pestañas de la sección Calculadora: precio neto, calculadora rápida, cacao y todo el módulo de café.
 * Las rutas de detalle (una compra, un lote, un comprobante…) resaltan la pestaña de su lista.
 */
export const CALC_TABS = [
  { hash: '#/calculadora', label: 'Precio neto' },
  { hash: '#/calculadora-rapida', label: 'Cuánto vale mi café' },
  { hash: '#/calculadora-cacao', label: '🍫 Cacao' },
  { hash: '#/panel-cafe', label: 'Resumen' },
  { hash: '#/compras', label: 'Compra de producto' },
  { hash: '#/lotes', label: 'Lotes' },
  { hash: '#/inventario', label: 'Inventario' },
  { hash: '#/ventas-cafe', label: 'Ventas de café' },
  { hash: '#/rentabilidad', label: 'Rentabilidad' },
  { hash: '#/reportes-cafe', label: 'Reportes' },
];

/** Ruta de detalle → pestaña a la que pertenece. */
const PARENT_TAB = {
  '#/compra': '#/compras',
  '#/comprobante': '#/compras',
  '#/resumen-dia': '#/compras',
  '#/lote': '#/lotes',
};

/** Hash de la pestaña que debe verse activa para una ruta del grupo. */
export function calcTabFor(hash) {
  return PARENT_TAB[hash] || hash;
}

export function isCalcRoute(hash) {
  return CALC_TABS.some((t) => t.hash === calcTabFor(hash));
}

export function calcTabsHtml(hash) {
  const active = calcTabFor(hash);
  return `
    <nav class="calc-tabs" aria-label="Calculadora">
      ${CALC_TABS.map((t) => `<a href="${t.hash}" class="calc-tab ${t.hash === active ? 'is-active' : ''}"
        ${t.hash === active ? 'aria-current="page"' : ''}>${t.label}</a>`).join('')}
    </nav>`;
}

/** Lleva la pestaña activa a la vista cuando la barra se desplaza (móvil). */
export function revealActiveTab(root) {
  const el = root.querySelector('.calc-tab.is-active');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center' });
}
