const PRIVACY_UPDATED_AT = '2026-09-27';

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
      'ellos mueven el mensaje, no tienen acceso a tu perfil completo dentro de AgroValor.',
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
    heading: 'Cambios a esta política',
    body:
      'Si esta política cambia de forma importante, lo avisaremos dentro de la app. La fecha de la última ' +
      'actualización aparece arriba de este texto.',
  },
];

function getPrivacyPolicy() {
  return { updatedAt: PRIVACY_UPDATED_AT, sections: PRIVACY_SECTIONS };
}

module.exports = { getPrivacyPolicy };
