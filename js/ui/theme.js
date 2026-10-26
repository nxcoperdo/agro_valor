const STORAGE_KEY = 'av_theme';
const MODES = ['system', 'light', 'dark'];
const LABELS = { system: 'Auto', light: 'Claro', dark: 'Oscuro' };
const BAR_COLORS = { light: '#f4f7f2', dark: '#0b3d2e' };

const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

export function getThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function resolve(mode) {
  if (mode === 'system') return prefersLight.matches ? 'light' : 'dark';
  return mode;
}

/** Pone data-theme en <html> y el color de la barra del navegador según la preferencia. */
export function applyTheme(mode = getThemePreference()) {
  const theme = resolve(mode);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[theme]);
}

export function setThemePreference(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Sin localStorage la elección dura solo mientras la pestaña esté abierta.
  }
  applyTheme(mode);
}

/** Si el usuario sigue al sistema, el tema cambia solo cuando cambia el del dispositivo. */
export function initTheme() {
  applyTheme();
  prefersLight.addEventListener('change', () => {
    if (getThemePreference() === 'system') applyTheme('system');
  });
}

/** Botón que rota Auto → Claro → Oscuro. Se puede montar en cualquier encabezado. */
export function createThemeToggle(className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `theme-toggle ${className}`.trim();

  const paint = () => {
    const mode = getThemePreference();
    button.textContent = `Tema: ${LABELS[mode]}`;
    button.setAttribute('aria-label', `Apariencia: ${LABELS[mode]}. Toca para cambiarla.`);
  };

  button.addEventListener('click', () => {
    const next = MODES[(MODES.indexOf(getThemePreference()) + 1) % MODES.length];
    setThemePreference(next);
    paint();
  });

  paint();
  return button;
}
