const express = require('express');
const cooperativeService = require('../services/cooperativeService');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(cooperativeService.getComparison());
});

module.exports = router;
