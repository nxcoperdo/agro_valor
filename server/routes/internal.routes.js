const express = require('express');
const crypto = require('crypto');
const env = require('../config/env');
const fncReferenceRepository = require('../repositories/fncReferenceRepository');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * El VPS no puede llegar a federaciondecafeteros.org (bloquea el rango de IPs del
 * proveedor), pero GitHub Actions sí. Este endpoint recibe el precio que un workflow
 * programado scrapea desde afuera, para no depender de actualizarlo a mano.
 */
function requireIngestToken(req, res, next) {
  const configured = env.fncIngestToken;
  if (!configured) {
    return res.status(503).json({ error: 'FNC_INGEST_TOKEN no está configurado en el servidor' });
  }

  const header = req.get('Authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  next();
}

router.post('/fnc-price', requireIngestToken, (req, res) => {
  const priceCopCarga = parseFloat(req.body.priceCopCarga);
  const sourceUrl = typeof req.body.sourceUrl === 'string' ? req.body.sourceUrl : env.fncSourceUrl;
  const rawLabel = typeof req.body.rawLabel === 'string' ? req.body.rawLabel.slice(0, 200) : null;

  if (!Number.isFinite(priceCopCarga) || priceCopCarga < 100000) {
    return res.status(400).json({ error: 'priceCopCarga inválido' });
  }

  const saved = fncReferenceRepository.insert({ priceCopCarga, sourceUrl, rawLabel });
  logger.info(`Precio interno de referencia FNC actualizado vía GitHub Actions: ${priceCopCarga} COP/carga`);
  res.json({ ok: true, saved });
});

module.exports = router;
