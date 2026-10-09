const express = require('express');
const forecastService = require('../services/forecastService');
const marketSummaryService = require('../services/marketSummaryService');
const subscriptionService = require('../services/subscriptionService');
const { isValidMarket, DEFAULT_MARKET, cocoaUsdPerTonneToCopKg } = require('../config/markets');

const router = express.Router();

/**
 * Vela proyectada de cada día: abre donde cerró el día anterior (el primero, en el precio de
 * hoy), cierra en el precio central y el rango mínimo–máximo hace de mecha. `dayChangePct` es el
 * cambio contra el día anterior; `changePct` (ya existente) es el acumulado contra hoy.
 * Las unidades son las del mercado: centavos/libra en café, USD/tonelada en cacao.
 */
function addCandles(daily, current, closeKey, openKey, dayKey) {
  let prev = current;
  return daily.map((d) => {
    const close = d[closeKey];
    const out = { ...d, [openKey]: prev, [dayKey]: prev ? ((close - prev) / prev) * 100 : null };
    prev = close;
    return out;
  });
}

// Gratis: solo el día de mañana, como muestra. Semana y mes completos son Pro.
const FREE_DAILY_STEPS = 1;

/**
 * Cacao: no hay precio interno de referencia, así que la proyección se entrega en la unidad
 * de la bolsa (USD/t) y en pesos por kilo con la TRM de hoy. Misma estructura de respuesta
 * que el café (daily/weekly/monthly + bloqueo Pro) para que el front la pinte igual.
 */
function buildCocoaResponse({ forecasts, summary, isPro }) {
  const current = summary.international ? summary.international.usdPerTonne : null;
  const trm = summary.exchangeRate ? summary.exchangeRate.rate : null;
  const toCopKg = (usdPerTonne) => (trm != null && usdPerTonne != null ? cocoaUsdPerTonneToCopKg(usdPerTonne, trm) : null);

  const enrich = (f) => ({
    step: f.step,
    predictedForDate: f.predictedForDate,
    usdPerTonne: f.predictedPrice,
    lowUsdPerTonne: f.lowPrice,
    highUsdPerTonne: f.highPrice,
    copPerKg: toCopKg(f.predictedPrice),
    lowCopPerKg: toCopKg(f.lowPrice),
    highCopPerKg: toCopKg(f.highPrice),
    changePct: current ? ((f.predictedPrice - current) / current) * 100 : null,
    modelParams: f.modelParams,
  });

  const daily = addCandles(
    forecasts.filter((f) => f.granularity === 'day').map(enrich),
    current,
    'usdPerTonne',
    'openUsdPerTonne',
    'dayChangePct'
  );
  const weekly = forecasts.filter((f) => f.granularity === 'week').map(enrich);
  const monthly = forecasts.filter((f) => f.granularity === 'month').map(enrich);
  const method = forecasts[0] ? forecasts[0].modelParams.method : null;

  return {
    market: 'cocoa',
    daily: isPro ? daily : daily.slice(0, FREE_DAILY_STEPS),
    weekly: isPro ? weekly : [],
    monthly: isPro ? monthly : [],
    isPro,
    locked: isPro
      ? null
      : {
          dailyCount: Math.max(daily.length - FREE_DAILY_STEPS, 0),
          weeklyCount: weekly.length,
          monthlyCount: monthly.length,
        },
    currentUsdPerTonne: current,
    currentCopPerKg: toCopKg(current),
    note:
      (method === 'holt-winters-fallback'
        ? 'No se pudo consultar la curva de futuros de la bolsa; esta proyección es un respaldo estadístico, menos confiable. '
        : 'El precio central sale de la curva de futuros del cacao en la bolsa de Nueva York (ICE) y el rango ' +
          '(mínimo–máximo) de la volatilidad real del cacao y del dólar en los últimos meses. ') +
      'El valor en pesos por kilo usa la tasa de cambio de hoy sobre el precio internacional: no es el precio ' +
      'que pagará tu comprador, que depende de calidad, humedad y descuentos. Es una estimación, no una garantía.',
  };
}

/**
 * El modelo proyecta la cotización internacional, que es la serie que tenemos.
 * Para que le sirva al caficultor se traduce a lo que le importa: en qué porcentaje
 * podría moverse el mercado, y a cuánto quedaría el precio interno SI se moviera
 * igual. Se dice explícitamente que es un supuesto, no una predicción del precio
 * que pagará su cooperativa.
 */
router.get('/', async (req, res, next) => {
  try {
    const market = req.query.market || DEFAULT_MARKET;
    if (!isValidMarket(market)) return res.status(400).json({ error: 'Mercado no soportado' });

    const isPro = subscriptionService.isPro(req.fullUser);
    const forecasts = await forecastService.getForecast(market);
    const summary = marketSummaryService.getMarketSummary(market);

    if (market === 'cocoa') return res.json(buildCocoaResponse({ forecasts, summary, isPro }));

    const currentCents = summary.international ? summary.international.centsPerLb : null;
    const internalNow = summary.internal ? summary.internal.copPerCarga : null;

    // Traduce cada precio (central y los dos bordes del rango) de centavos/libra a lo que
    // le importa al caficultor: el % en que se movería el mercado y, SI el precio interno se
    // moviera igual, a cuánto quedaría la carga. Es un supuesto, no la predicción de precio
    // de ninguna cooperativa en particular.
    const impliedCop = (centsPerLb) => {
      if (currentCents == null || internalNow == null) return null;
      return internalNow * (centsPerLb / currentCents);
    };

    const enrich = (f) => {
      const changePct = currentCents ? ((f.predictedPrice - currentCents) / currentCents) * 100 : null;

      return {
        step: f.step,
        predictedForDate: f.predictedForDate,
        usdPerLb: f.predictedPrice / 100,
        centsPerLb: f.predictedPrice,
        lowCentsPerLb: f.lowPrice ?? null,
        highCentsPerLb: f.highPrice ?? null,
        changePct,
        impliedInternalCopPerCarga: impliedCop(f.predictedPrice),
        lowImpliedCopPerCarga: f.lowPrice != null ? impliedCop(f.lowPrice) : null,
        highImpliedCopPerCarga: f.highPrice != null ? impliedCop(f.highPrice) : null,
        modelParams: f.modelParams,
      };
    };

    const daily = addCandles(
      forecasts.filter((f) => f.granularity === 'day').map(enrich),
      currentCents,
      'centsPerLb',
      'openCentsPerLb',
      'dayChangePct'
    );
    const weekly = forecasts.filter((f) => f.granularity === 'week').map(enrich);
    const monthly = forecasts.filter((f) => f.granularity === 'month').map(enrich);

    const method = forecasts[0] ? forecasts[0].modelParams.method : null;
    const note =
      method === 'holt-winters-fallback'
        ? 'No se pudo consultar la curva de futuros de la bolsa; esta proyección es un respaldo ' +
          'estadístico sobre el histórico propio, menos confiable que de costumbre. El rango (mínimo–máximo) ' +
          'muestra qué tan incierta es. Es una estimación, no una garantía de precio de compra.'
        : 'El precio central sale de la curva de futuros de la bolsa de Nueva York (lo que el mercado ya está ' +
          'pagando hoy por café a entregar en los próximos meses), y el rango (mínimo–máximo) viene de la ' +
          'volatilidad real del café y del dólar en los últimos meses: entre más lejos la fecha, más ancho. ' +
          'El equivalente en pesos supone que el precio interno se mueve en la misma proporción que el ' +
          'internacional, cosa que no siempre ocurre porque también influyen la tasa de cambio y la prima de ' +
          'Colombia. Es una estimación, no una garantía de precio de compra.';

    res.json({
      market,
      daily: isPro ? daily : daily.slice(0, FREE_DAILY_STEPS),
      weekly: isPro ? weekly : [],
      monthly: isPro ? monthly : [],
      isPro,
      locked: isPro
        ? null
        : {
            dailyCount: Math.max(daily.length - FREE_DAILY_STEPS, 0),
            weeklyCount: weekly.length,
            monthlyCount: monthly.length,
          },
      currentUsdPerLb: currentCents != null ? currentCents / 100 : null,
      internalNowCopPerCarga: internalNow,
      note,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
