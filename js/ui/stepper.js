import { escapeHtml } from '../utils/format.js';

/**
 * Formulario por pasos. steps: [{ id, title, render(state) => html, validate?(state, root) => mensaje|null }]
 * Cada paso es un panel; solo uno es visible. onFinish(state) se llama en el último paso.
 */
export function mountStepper(root, { steps, state, onChange, onFinish, finishLabel = 'Guardar' }) {
  let current = 0;

  function draw() {
    const step = steps[current];
    root.innerHTML = `
      <ol class="stepper" aria-label="Pasos">
        ${steps.map((s, i) => `<li class="stepper-item ${i === current ? 'is-current' : ''} ${i < current ? 'is-done' : ''}"
          ${i === current ? 'aria-current="step"' : ''}><span class="stepper-num">${i + 1}</span><span class="stepper-title">${escapeHtml(s.title)}</span></li>`).join('')}
      </ol>
      <div class="stepper-body" id="stepper-body">${step.render(state)}</div>
      <p class="form-error" id="stepper-error" role="alert" hidden></p>
      <div class="stepper-actions">
        <button type="button" class="btn-ghost" id="step-back" ${current === 0 ? 'hidden' : ''}>Atrás</button>
        <button type="button" class="btn-primary" id="step-next">${current === steps.length - 1 ? finishLabel : 'Siguiente'}</button>
      </div>`;
    if (step.afterRender) step.afterRender(root.querySelector('#stepper-body'), state, () => { onChange && onChange(); });

    root.querySelector('#step-back').addEventListener('click', () => { current -= 1; draw(); });
    root.querySelector('#step-next').addEventListener('click', async () => {
      const error = root.querySelector('#stepper-error');
      const problem = step.validate ? step.validate(state, root) : null;
      if (problem) { error.textContent = problem; error.hidden = false; return; }
      error.hidden = true;
      if (current < steps.length - 1) { current += 1; draw(); return; }
      const btn = root.querySelector('#step-next');
      btn.disabled = true;
      try { await onFinish(state); } catch (err) { error.textContent = err.message; error.hidden = false; btn.disabled = false; }
    });
  }
  draw();
  return { redraw: draw };
}
