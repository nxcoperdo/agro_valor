import { api } from '../services/api.js';
import { getCachedUser } from '../services/auth.js';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

function sectionHtml(section) {
  return `
    <section class="panel">
      <div class="panel-header"><h2>${section.heading}</h2></div>
      <p class="panel-intro">${section.body}</p>
    </section>
  `;
}

/** Página genérica para cualquier texto legal (privacidad, términos, cookies): mismo layout, distinto fetch. */
function legalPage(title, fetchContent) {
  return async function render(container) {
    const backHref = getCachedUser() ? '#/cuenta' : '#/';

    container.innerHTML = `
      <div class="landing">
        <header class="landing-header">
          <div class="brand">
            <img class="brand-icon-img" src="img/logo-icon.png" alt="" width="32" height="32" />
            <span class="brand-word"><span class="brand-agro">Agro</span><span class="brand-valor">Valor</span></span>
          </div>
          <div class="landing-actions">
            <a class="btn-ghost" href="${backHref}">Volver</a>
          </div>
        </header>

        <div class="panel">
          <div class="panel-header"><h2>${title}</h2></div>
          <p class="disclaimer" id="legal-updated"></p>
        </div>

        <div id="legal-sections"><span class="skeleton" style="width:100%;height:160px;display:block;"></span></div>
      </div>
    `;

    const updatedEl = container.querySelector('#legal-updated');
    const sectionsEl = container.querySelector('#legal-sections');

    try {
      const { updatedAt, sections } = await fetchContent();
      updatedEl.textContent = `Última actualización: ${dateFmt.format(new Date(updatedAt))}`;
      sectionsEl.innerHTML = sections.map(sectionHtml).join('');
    } catch (err) {
      sectionsEl.innerHTML = `<div class="panel"><p class="panel-error">No se pudo cargar: ${err.message}</p></div>`;
    }
  };
}

export const renderPrivacyPolicy = legalPage('Política de privacidad', api.privacyPolicy);
export const renderTermsOfService = legalPage('Términos de uso', api.termsOfService);
export const renderCookiePolicy = legalPage('Política de cookies', api.cookiePolicy);
