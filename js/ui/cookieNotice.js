const STORAGE_KEY = 'av_cookie_notice_dismissed';

function isDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Sin localStorage (navegación privada) el aviso vuelve a salir la próxima vez; no pasa nada grave.
  }
}

/**
 * AgroValor solo usa una cookie propia y estrictamente necesaria (la de sesión), sin
 * analítica ni publicidad de terceros — por eso es un aviso informativo simple, no un
 * banner de consentimiento con categorías para aceptar/rechazar.
 */
export function initCookieNotice() {
  if (isDismissed()) return;

  const bar = document.createElement('div');
  bar.className = 'cookie-notice';
  bar.innerHTML = `
    <p>
      Usamos una única cookie propia, necesaria para mantener tu sesión iniciada. No usamos
      cookies de analítica ni de publicidad. <a href="#/cookies">Política de cookies</a>.
    </p>
    <button type="button" class="btn-primary" id="cookie-notice-ok">Entendido</button>
  `;
  document.body.appendChild(bar);

  bar.querySelector('#cookie-notice-ok').addEventListener('click', () => {
    markDismissed();
    bar.remove();
  });
}
