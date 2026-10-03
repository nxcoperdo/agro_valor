import { escapeHtml } from '../utils/format.js';

/**
 * Diálogo propio en lugar de window.confirm / window.prompt (que bloquean y se ven mal en el celular).
 * Devuelve una promesa: true/false para confirmar, o el texto escrito (o null) si se pide un motivo.
 *   await askConfirm({ title, message, confirmLabel, danger })
 *   await askReason({ title, message, label, confirmLabel })   // el motivo es obligatorio
 */
function openDialog({ title, message = '', confirmLabel = 'Confirmar', danger = false, reasonLabel = null }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'av-dialog';
    dialog.setAttribute('aria-labelledby', 'av-dialog-title');
    dialog.innerHTML = `
      <form method="dialog">
        <h3 id="av-dialog-title">${escapeHtml(title)}</h3>
        ${message ? `<p>${escapeHtml(message)}</p>` : ''}
        ${reasonLabel ? `<div class="field"><label for="av-dialog-reason">${escapeHtml(reasonLabel)}</label>
          <input id="av-dialog-reason" name="reason" autocomplete="off" /></div>` : ''}
        <p class="form-error" id="av-dialog-error" role="alert" hidden></p>
        <div class="av-dialog-actions">
          <button type="button" class="btn-ghost" data-cancel>Cancelar</button>
          <button type="submit" class="${danger ? 'btn-danger' : 'btn-primary'}" value="ok">${escapeHtml(confirmLabel)}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const none = reasonLabel ? null : false;
    let done = false;
    // Cierra, limpia y resuelve una sola vez, sin depender del evento "close" (Esc, botones y submit llegan aquí).
    const finish = (value) => {
      if (done) return;
      done = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    const form = dialog.querySelector('form');
    const input = dialog.querySelector('#av-dialog-reason');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input) { finish(true); return; }
      const value = input.value.trim();
      if (!value) {
        const err = dialog.querySelector('#av-dialog-error');
        err.textContent = 'Escribe el motivo para continuar.';
        err.hidden = false;
        input.focus();
        return;
      }
      finish(value);
    });
    dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(none));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(none); }); // tecla Esc
    dialog.addEventListener('close', () => finish(none));
    dialog.showModal();
    (input || dialog.querySelector('[data-cancel]')).focus();
  });
}

export const askConfirm = (opts) => openDialog(opts);
export const askReason = (opts) => openDialog({ ...opts, reasonLabel: opts.label || 'Motivo' });
