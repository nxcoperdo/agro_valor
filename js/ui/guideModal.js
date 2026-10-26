const CLOSE_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" stroke-width="2" /></svg>';

const STEPS = [
  {
    title: 'El precio al día',
    body: 'En <strong>Mercado</strong> ves cuánto vale hoy la carga de café y, con el selector, también el cacao. También compara qué cooperativa paga mejor.',
  },
  {
    title: 'Hacia dónde va el mercado',
    body: 'La proyección muestra la curva de futuros y un rango de precio probable. Es una guía para decidir cuándo vender, no un precio seguro.',
  },
  {
    title: 'Tus cuentas en un solo lugar',
    body: 'En <strong>Calculadora</strong> haces la cuenta de una compra, registras compras y ventas y controlas lo que tienes en Procesamiento. Con Pro lo guardas todo.',
  },
  {
    title: 'Que el precio te avise',
    body: 'Crea una alerta en <strong>Alertas</strong> y te avisamos cuando el precio llegue a tu meta. Esta guía la puedes volver a abrir desde <strong>Mi cuenta</strong>.',
  },
];

/**
 * Tutorial corto para quien acaba de crear su cuenta; se puede omitir en cualquier momento.
 * Reutiliza el marco visual del modal de bienvenida (clases trial-modal-*).
 */
export function showGuideModal(onClose) {
  let index = 0;
  const last = STEPS.length - 1;

  const root = document.createElement('div');
  root.className = 'trial-modal-root';
  root.innerHTML = `
    <div class="trial-modal-scrim"></div>
    <div class="trial-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <button type="button" class="trial-modal-close" aria-label="Omitir guía">${CLOSE_ICON}</button>
      <span class="pro2-eyebrow-badge" id="guide-count"></span>
      <h2 id="guide-title" class="trial-modal-title"></h2>
      <p class="trial-modal-body" id="guide-body"></p>
      <div class="guide-dots" aria-hidden="true">${STEPS.map(() => '<span></span>').join('')}</div>
      <button type="button" class="btn-primary btn-lg trial-modal-cta" id="guide-next"></button>
      <button type="button" class="btn-ghost guide-skip" id="guide-skip">Omitir</button>
    </div>
  `;

  document.body.appendChild(root);
  document.body.classList.add('nav-locked');

  const countEl = root.querySelector('#guide-count');
  const titleEl = root.querySelector('#guide-title');
  const bodyEl = root.querySelector('#guide-body');
  const nextBtn = root.querySelector('#guide-next');
  const dots = [...root.querySelectorAll('.guide-dots span')];
  const previouslyFocused = document.activeElement;

  function paint() {
    countEl.textContent = `Paso ${index + 1} de ${STEPS.length}`;
    titleEl.textContent = STEPS[index].title;
    bodyEl.innerHTML = STEPS[index].body;
    nextBtn.textContent = index === last ? 'Empezar' : 'Siguiente';
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  }

  let removed = false;
  function onRemove() {
    if (removed) return;
    removed = true;
    root.remove();
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    onClose?.();
  }

  function close() {
    root.classList.remove('is-open');
    document.body.classList.remove('nav-locked');
    document.removeEventListener('keydown', onKeydown);
    root.addEventListener('transitionend', onRemove, { once: true });
    // Por si el navegador no dispara transitionend (prefers-reduced-motion, pestaña oculta).
    setTimeout(onRemove, 250);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  nextBtn.addEventListener('click', () => {
    if (index === last) {
      close();
      return;
    }
    index += 1;
    paint();
  });
  root.querySelector('#guide-skip').addEventListener('click', close);
  root.querySelector('.trial-modal-close').addEventListener('click', close);
  root.querySelector('.trial-modal-scrim').addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  paint();
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    nextBtn.focus();
  });
}
