/**
 * Tipos de producto que se pueden comprar. Única fuente de etiquetas, merma inicial y si el
 * producto normalmente necesita secado: servidor, comprobantes, reportes y apps leen de aquí
 * (la web y Flutter lo piden a GET /api/coffee/product-types).
 *
 * Las claves viejas (cafe_verde, cafe_merma_5, cafe_sin_merma, otro) se conservan: hay compras
 * guardadas con ellas y la app móvil instalada las sigue enviando.
 */
const PRODUCT_TYPES = [
  { key: 'cafe', label: 'Café', mermaDefault: 8, requiresDryingDefault: true },
  { key: 'cacao', label: 'Cacao', mermaDefault: 0, requiresDryingDefault: false, priceUnit: 'kg' },
  { key: 'pasilla_cafe', label: 'Pasilla de café', mermaDefault: 0, requiresDryingDefault: false },
  { key: 'maiz', label: 'Maíz', mermaDefault: 0, requiresDryingDefault: false },
  { key: 'frijol', label: 'Frijol', mermaDefault: 0, requiresDryingDefault: false },
  // Claves anteriores (siguen válidas).
  { key: 'cafe_verde', label: 'Café verde', mermaDefault: 8, requiresDryingDefault: true, legacy: true },
  { key: 'cafe_merma_5', label: 'Café con merma 5%', mermaDefault: 5, requiresDryingDefault: true, legacy: true },
  { key: 'cafe_sin_merma', label: 'Café sin merma', mermaDefault: 0, requiresDryingDefault: true, legacy: true },
  { key: 'otro', label: 'Otro', mermaDefault: 0, requiresDryingDefault: true, legacy: true },
];

const BY_KEY = Object.fromEntries(PRODUCT_TYPES.map((t) => [t.key, t]));

const isValid = (key) => Object.prototype.hasOwnProperty.call(BY_KEY, key);
const get = (key) => BY_KEY[key] || null;
const label = (key) => (BY_KEY[key] ? BY_KEY[key].label : key);
/** Unidad en la que se habla el precio del producto: el café por carga de 125 kg, el cacao por kilo. */
const priceUnit = (key) => (BY_KEY[key] && BY_KEY[key].priceUnit) || 'carga';
/** Los que se ofrecen al crear una compra (sin las claves heredadas). */
const selectable = () => PRODUCT_TYPES.filter((t) => !t.legacy);

module.exports = { PRODUCT_TYPES, isValid, get, label, priceUnit, selectable };
