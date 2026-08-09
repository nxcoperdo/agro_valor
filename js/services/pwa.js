let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(canInstall()));
}

export function canInstall() {
  return deferredPrompt !== null;
}

/** Permite a la interfaz mostrar u ocultar el botón "Instalar" cuando cambie el estado. */
export function onInstallAvailabilityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  deferredPrompt = null;
  notify();

  return outcome === 'accepted';
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS marca las apps agregadas a la pantalla de inicio con esta propiedad propia.
    window.navigator.standalone === true
  );
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Se evita el aviso automático del navegador para ofrecerlo dentro de la app.
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    // updateViaCache 'none' evita que el navegador reutilice una copia vieja del
    // script desde su caché HTTP y deje al usuario con una versión desactualizada.
    // Sin service worker la app sigue funcionando: solo pierde el modo sin conexión.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch((err) => {
      console.warn('[AgroValor] No se pudo registrar el service worker:', err);
    });
  };

  // Si la página ya terminó de cargar, esperar el evento 'load' no serviría de nada.
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
