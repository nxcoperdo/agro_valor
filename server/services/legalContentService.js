const env = require('../config/env');

const LEGAL_UPDATED_AT = '2026-10-03';

const PENDING = '[pendiente de configurar por AgroValor]';

function contactLine() {
  return `Correo: ${env.legalContactEmail || PENDING}. Dirección postal: ${env.legalPostalAddress || PENDING}.`;
}

/**
 * Texto real de la política de privacidad, pensado para lo que AgroValor efectivamente
 * hace hoy con los datos (ver server/db/schema.sql y server/routes/account.routes.js).
 * Conviene que un abogado la revise antes de publicarla, pero no es un texto de relleno.
 */
const PRIVACY_SECTIONS = [
  {
    heading: 'Quién trata tus datos',
    body:
      'AgroValor es un producto para caficultores colombianos: precio de referencia, comparación entre ' +
      'cooperativas y herramientas para vender mejor tu café. Los datos de tu cuenta los administra el ' +
      'equipo de AgroValor. Puedes escribirnos por WhatsApp al número que usamos para las alertas si tienes ' +
      'cualquier duda sobre tu información.',
  },
  {
    heading: 'Qué datos recogemos',
    body:
      'De tu cuenta: usuario, tu número de WhatsApp, tu nombre y tu municipio (si los escribes). ' +
      'Para la calculadora: el factor de rendimiento, la humedad y el costo de transporte que guardes como ' +
      'valores por defecto. De tu actividad: los precios que reportas de tu cooperativa, tu historial de ' +
      'ventas si lo registras, y las alertas de precio que configures. Si instalas la app, guardamos el ' +
      'identificador de notificación de tu teléfono (token de Firebase) para poder avisarte.',
  },
  {
    heading: 'Para qué los usamos',
    body:
      'Para mostrarte cuánto te queda realmente por tu café según tu factor y tu humedad, para compararte ' +
      'entre cooperativas, para avisarte por WhatsApp o notificación cuando el precio te convenga, y para ' +
      'mejorar el dato colectivo de precios: cuando reportas cuánto te pagaron, ese dato ayuda a que el ' +
      'precio que ven los demás caficultores sea más real.',
  },
  {
    heading: 'Con quién se comparte',
    body:
      'Con nadie fuera de AgroValor. Nunca vendemos tu información. Usamos a Meta (WhatsApp Business) y a ' +
      'Google Firebase únicamente como mensajeros técnicos para entregarte las alertas y notificaciones: ' +
      'ellos mueven el mensaje, no tienen acceso a tu perfil completo dentro de AgroValor. Si te suscribes a ' +
      'Pro desde la app, el pago lo procesa Google Play: nosotros solo recibimos la confirmación de que tu ' +
      'suscripción está activa y hasta cuándo, nunca tu número de tarjeta ni tus datos de pago.',
  },
  {
    heading: 'Cuánto tiempo se conserva',
    body:
      'Mientras tu cuenta esté activa. Si eliminas tu cuenta desde "Mi cuenta", se borran tus datos ' +
      'personales, tus alertas, tu historial de ventas y tus dispositivos registrados. Los precios que ' +
      'reportaste se quedan, pero sin tu nombre asociado: ya son parte del dato colectivo que usan otros ' +
      'caficultores, y borrarlos afectaría esa información compartida.',
  },
  {
    heading: 'Tus derechos',
    body:
      'Como titular de tus datos personales (Ley 1581 de 2012 de Colombia), puedes conocer, actualizar y ' +
      'corregir tu información en cualquier momento desde "Mis datos", y puedes eliminar tu cuenta por ' +
      'completo desde "Mi cuenta". También puedes pedirnos por WhatsApp que te ayudemos con cualquiera de ' +
      'estos pasos si lo prefieres.',
  },
  {
    heading: 'Menores de edad',
    body:
      'AgroValor es solo para personas de 18 años o más. En el registro te pedimos la fecha de nacimiento ' +
      'únicamente para comprobar que eres mayor de edad: no la guardamos, solo anotamos que la verificación se ' +
      'hizo. No recogemos a sabiendas datos de menores de 13 años (COPPA) ni de menores de 18. Si crees que un ' +
      'menor creó una cuenta, escríbenos y la eliminaremos.',
  },
  {
    heading: 'Analítica, grabación de sesiones y fuentes',
    body:
      'No grabamos tu sesión, no usamos mapas de calor ni herramientas de analítica o publicidad. Las fuentes ' +
      'tipográficas se sirven desde nuestro propio servidor, así que tu navegador no se conecta a Google para ' +
      'mostrarlas.',
  },
  {
    heading: 'Mensajes y cómo darte de baja',
    body:
      'Los resúmenes y alertas por WhatsApp o notificación solo se envían si tú los creas, y puedes apagarlos o ' +
      'borrarlos cuando quieras desde "Alertas" y "Mi cuenta" (también puedes desactivar canales). No enviamos ' +
      'correos de marketing; si algún día lo hacemos, cada correo incluirá un enlace de baja y esta dirección ' +
      'postal. Contacto: ' +
      contactLine(),
  },
  {
    heading: 'Cambios a esta política',
    body:
      'Si esta política cambia de forma importante, lo avisaremos dentro de la app. La fecha de la última ' +
      'actualización aparece arriba de este texto.',
  },
];

/**
 * Términos de uso. Estructura estándar para una app de suscripción (objeto, cuentas,
 * pago/cancelación, contenido que aporta el usuario, responsabilidad, ley aplicable),
 * pero con las condiciones reales de AgroValor, no una plantilla genérica.
 */
const TERMS_SECTIONS = [
  {
    heading: 'Qué es AgroValor y quién puede usarlo',
    body:
      'AgroValor es una herramienta para caficultores colombianos: precio de referencia, comparación entre ' +
      'cooperativas, calculadora de precio neto, alertas y proyección del mercado. Solo pueden crear cuenta ' +
      'personas de 18 años o más. Al crear una cuenta aceptas estos términos. Si no estás de acuerdo, no debes usar la app ni la web.',
  },
  {
    heading: 'Tu cuenta',
    body:
      'Eres responsable de la información que registras y de mantener tu contraseña segura. Puedes ver y ' +
      'corregir tus datos desde "Mi cuenta", y eliminar tu cuenta por completo cuando quieras. Nos ' +
      'reservamos el derecho de suspender cuentas que reporten precios falsos a propósito o usen el ' +
      'servicio para dañar el dato colectivo que usan los demás caficultores.',
  },
  {
    heading: 'Los precios que reportas',
    body:
      'Cuando reportas cuánto te pagó una cooperativa, ese dato se usa para calcular el precio "reportado" ' +
      'que ven otros usuarios. Al reportar, aceptas que ese número (sin tu nombre) se comparta públicamente ' +
      'dentro de la app como parte del ranking de cooperativas. Nos reservamos el derecho de descartar ' +
      'reportes que parezcan errores o abuso.',
  },
  {
    heading: 'Plan Pro y pagos',
    body:
      'El plan gratis incluye el precio de referencia, el dólar y el ranking general de cooperativas. Pro ' +
      'agrega alertas por WhatsApp, calculadora personalizada, historial de ventas y proyección. Pro se paga ' +
      'con un pago único anual a través del checkout de Mercado Pago, tanto en la web como en la app (la app ' +
      'abre el checkout en el navegador). No es una suscripción: no se renueva ni se te cobra de nuevo ' +
      'automáticamente, y el plan queda activo durante un año desde el pago. Al vencerse, puedes volver a ' +
      'pagar cuando quieras para renovarlo. Si prefieres pagar por Nequi o Daviplata, puedes escribirnos por ' +
      'WhatsApp para que te activemos el plan a mano.',
  },
  {
    heading: 'Renovación, cancelación y reembolsos',
    body:
      'Pro dura 1 año desde el pago ($150.000 COP, pago único) y NO se renueva automáticamente: no hay ' +
      'suscripción que cancelar ni cobros futuros. Al vencer, vuelves al plan gratis. Si compraste por internet ' +
      'tienes derecho de retracto durante 5 días hábiles desde el pago (Ley 1480 de 2011, art. 47), siempre que ' +
      'no hayas usado el servicio de forma sustancial; escríbenos y te devolvemos el dinero. También puedes ' +
      'eliminar tu cuenta cuando quieras desde "Mi cuenta". ' + contactLine(),
  },
  {
    heading: 'Disponibilidad del servicio',
    body:
      'Hacemos lo posible por mantener el servicio funcionando, pero los precios dependen de fuentes ' +
      'externas (la Federación Nacional de Cafeteros, proveedores de tasa de cambio) que pueden fallar o ' +
      'demorarse. La información de precio y proyección es de carácter informativo: no es una garantía de ' +
      'precio de compra ni asesoría financiera.',
  },
  {
    heading: 'Propiedad',
    body:
      'El nombre, el logo y el diseño de AgroValor son de AgroValor. El dato colectivo de precios reportados ' +
      'se comparte dentro de la app para beneficio de todos los caficultores que la usan.',
  },
  {
    heading: 'Cambios a estos términos',
    body: 'Si estos términos cambian de forma importante, lo avisaremos dentro de la app.',
  },
  {
    heading: 'Ley aplicable y contacto',
    body:
      'Estos términos se rigen por las leyes de Colombia. Cualquier duda, escríbenos por WhatsApp al número ' +
      'que usamos para las alertas.',
  },
];

/**
 * Política de cookies. AgroValor solo usa una cookie propia y estrictamente necesaria
 * para la sesión (server/services/authService.js: COOKIE_NAME = 'av_token') — nada de
 * analítica ni publicidad de terceros. No aplica a la app móvil, que no usa cookies.
 */
const COOKIE_SECTIONS = [
  {
    heading: 'Qué es una cookie',
    body:
      'Un archivo pequeño que el navegador guarda para recordar información entre una visita y otra a un ' +
      'sitio web. Esto solo aplica a la versión web de AgroValor: la app móvil no usa cookies.',
  },
  {
    heading: 'La única cookie que usamos',
    body:
      'Se llama "av_token". Guarda tu sesión iniciada, para que no tengas que escribir tu contraseña en cada ' +
      'página. Dura 8 horas, o 30 días si marcaste "Recordarme" al entrar. No la usamos para publicidad ni ' +
      'para rastrearte por otros sitios.',
  },
  {
    heading: 'Por qué es necesaria',
    body:
      'Sin ella no podemos saber que ya iniciaste sesión, y tendrías que volver a entrar en cada página. Por ' +
      'eso es una cookie técnica esencial: no ofrecemos la opción de desactivarla y seguir usando la cuenta, ' +
      'igual que ocurre con cualquier sitio que requiere inicio de sesión.',
  },
  {
    heading: 'Lo que no hacemos',
    body:
      'No usamos cookies de analítica (como Google Analytics), ni de publicidad, ni de redes sociales, ni ' +
      'de ningún proveedor externo. La única cookie de este sitio es la de sesión, propia de AgroValor.',
  },
  {
    heading: 'Cómo controlarla',
    body:
      'Cerrar sesión borra la cookie. También puedes borrarla a mano desde la configuración de tu navegador ' +
      'en cualquier momento; al hacerlo, simplemente se cerrará tu sesión.',
  },
];

/**
 * Política DMCA. AgroValor casi no aloja contenido de terceros (solo cifras de precio que reportan
 * los usuarios), pero se publica el procedimiento y los datos del agente designado para poder
 * acogerse al "safe harbor" del 17 U.S.C. § 512 una vez se registre el agente en copyright.gov.
 */
function dmcaSections() {
  return [
    {
      heading: 'Qué es esta página',
      body:
        'AgroValor respeta los derechos de autor. Si crees que algo publicado en AgroValor infringe tu derecho ' +
        'de autor, puedes enviarnos una notificación según la Digital Millennium Copyright Act (17 U.S.C. § 512) ' +
        'y la legislación colombiana (Ley 23 de 1982, Decisión Andina 351).',
    },
    {
      heading: 'Cómo enviar una notificación',
      body:
        'Envíala por escrito al agente designado e incluye: (1) tu firma física o electrónica; (2) la obra ' +
        'protegida que consideras infringida; (3) la dirección (URL) exacta del material que reclamas; (4) tus ' +
        'datos de contacto (dirección, teléfono y correo); (5) una declaración de buena fe de que el uso no está ' +
        'autorizado por el titular, su agente ni la ley; y (6) una declaración, bajo pena de perjurio, de que la ' +
        'información es exacta y de que eres el titular o estás autorizado para actuar en su nombre.',
    },
    {
      heading: 'Contra-notificación',
      body:
        'Si retiramos material y crees que fue un error, puedes enviar una contra-notificación con tu firma, la ' +
        'identificación del material retirado y dónde estaba, una declaración bajo pena de perjurio de que lo ' +
        'retiramos por error o identificación equivocada, y tu aceptación de la jurisdicción de los tribunales de ' +
        'tu domicilio. Restableceremos el material en 10 a 14 días hábiles salvo que el reclamante inicie una acción judicial.',
    },
    {
      heading: 'Infractores reincidentes',
      body: 'Eliminaremos las cuentas de quienes infrinjan derechos de autor de forma repetida.',
    },
    {
      heading: 'Agente designado',
      body:
        `Nombre: ${env.dmcaAgentName || PENDING}. Correo: ${env.dmcaAgentEmail || PENDING}. ` +
        `Teléfono: ${env.dmcaAgentPhone || PENDING}. Dirección postal: ${env.legalPostalAddress || PENDING}.`,
    },
  ];
}

function getDmcaPolicy() {
  return { updatedAt: LEGAL_UPDATED_AT, sections: dmcaSections() };
}

function getPrivacyPolicy() {
  return { updatedAt: LEGAL_UPDATED_AT, sections: PRIVACY_SECTIONS };
}

function getTermsOfService() {
  return { updatedAt: LEGAL_UPDATED_AT, sections: TERMS_SECTIONS };
}

function getCookiePolicy() {
  return { updatedAt: LEGAL_UPDATED_AT, sections: COOKIE_SECTIONS };
}

module.exports = { getPrivacyPolicy, getTermsOfService, getCookiePolicy, getDmcaPolicy };
