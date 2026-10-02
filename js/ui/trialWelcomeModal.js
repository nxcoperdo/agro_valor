const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

const CLOSE_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" stroke-width="2" /></svg>';

const CHECK_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m5 12.5 4.25 4.25L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg>';

/**
 * Modal de bienvenida que se muestra una sola vez, justo al crear la cuenta (la prueba
 * gratis solo se otorga en el registro — ver auth.routes.js), nunca en logins posteriores.
 * No depende de ningún flag en localStorage: como solo se llama desde el callback de
 * éxito de signup.js, estructuralmente no puede dispararse dos veces para la misma cuenta.
 */
export function showTrialWelcomeModal(user, onClose) {
  const expiry = user.expiresAt ? dateFmt.format(new Date(user.expiresAt)) : null;
  const features = (user.limits && user.limits.features) || [];

  const root = document.createElement('div');
  root.className = 'trial-modal-root';
  root.innerHTML = `
    <div class="trial-modal-scrim"></div>
    <div class="trial-modal" role="dialog" aria-modal="true" aria-labelledby="trial-modal-title">
      <button type="button" class="trial-modal-close" aria-label="Cerrar">${CLOSE_ICON}</button>
      <span class="pro2-eyebrow-badge">7 días gratis de regalo</span>
      <h2 id="trial-modal-title" class="trial-modal-title">Ya tienes acceso a AgroValor Pro</h2>
      <p class="trial-modal-body">
        Como bienvenida, activamos tu plan Pro gratis por 7 días${
          expiry ? `, hasta el <strong>${expiry}</strong>` : ''
        }. Cuando termine, vuelves al plan gratis automáticamente — puedes pagar en cualquier
        momento desde <strong>Plan Pro</strong> para seguir sin interrupciones.
      </p>
      <ul class="trial-modal-features">
        ${features.map((f) => `<li>${CHECK_ICON}<span>${f}</span></li>`).join('')}
      </ul>
      <button type="button" class="btn-primary btn-lg trial-modal-cta">Empezar a usar Pro</button>
    </div>
  `;

  document.body.appendChild(root);
  document.body.classList.add('nav-locked');

  const scrim = root.querySelector('.trial-modal-scrim');
  const closeBtn = root.querySelector('.trial-modal-close');
  const ctaBtn = root.querySelector('.trial-modal-cta');
  const previouslyFocused = document.activeElement;

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

  scrim.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  ctaBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);

  requestAnimationFrame(() => {
    root.classList.add('is-open');
    closeBtn.focus();
  });
}
