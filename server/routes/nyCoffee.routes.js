const express = require('express');
const { getNyCoffeeDec26 } = require('../services/nyCoffeeDec26Service');

const router = express.Router();

/** Cotización del café C (ICE Nueva York), vencimiento diciembre 2026. Siempre responde 200. */
router.get('/dec26', async (req, res) => {
  res.json(await getNyCoffeeDec26());
});

module.exports = router;
