/**
 * Mercados disponibles en la interfaz. Espejo ligero de server/config/markets.js: aquí solo
 * van los textos y la unidad que se muestran; la lógica de precios vive en el servidor.
 */
export const MARKETS = [
  { id: 'coffee', name: 'Café', emoji: '☕', unitLabel: 'carga de 125 kg', thresholdUnit: 'carga' },
  { id: 'cocoa', name: 'Cacao', emoji: '🍫', unitLabel: 'kilo', thresholdUnit: 'kilo' },
];

export const DEFAULT_MARKET = 'coffee';

export function getMarketMeta(id) {
  return MARKETS.find((m) => m.id === id) || MARKETS[0];
}
