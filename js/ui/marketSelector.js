import { MARKETS, DEFAULT_MARKET, getMarketMeta } from '../config/markets.js';

const STORAGE_KEY = 'av_market';

/** Mercado elegido por el usuario (café si nunca eligió o el almacenamiento no está disponible). */
export function getSelectedMarket() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return MARKETS.some((m) => m.id === saved) ? saved : DEFAULT_MARKET;
  } catch (err) {
    return DEFAULT_MARKET;
  }
}

function saveMarket(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (err) {
    // Sin almacenamiento la elección dura solo mientras la pestaña esté abierta.
  }
}

/**
 * Desplegable de mercado. Café es el principal y viene seleccionado por defecto.
 * `onChange(marketId)` se llama solo cuando el usuario cambia de mercado.
 */
export function renderMarketSelector(container, { value, onChange }) {
  container.innerHTML = `
    <label class="market-selector">
      <span class="market-selector-label">Mercado</span>
      <select class="market-selector-select" aria-label="Elegir mercado">
        ${MARKETS.map(
          (m) => `<option value="${m.id}" ${m.id === value ? 'selected' : ''}>${m.emoji} ${m.name}</option>`
        ).join('')}
      </select>
    </label>
  `;

  container.querySelector('select').addEventListener('change', (e) => {
    const id = getMarketMeta(e.target.value).id;
    saveMarket(id);
    onChange(id);
  });
}
