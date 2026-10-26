const express = require('express');
const feedbackService = require('../services/feedbackService');

const router = express.Router();

/** Sugerencias y reportes de problemas, para cualquier usuario con sesión (no solo Pro). */
router.post('/', (req, res, next) => {
  try {
    const feedback = feedbackService.createFeedback(req.user.id, req.body || {});
    res.status(201).json({ ok: true, feedback, message: 'Gracias, lo vamos a revisar.' });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', (req, res) => {
  res.json({ feedback: feedbackService.getMyFeedback(req.user.id) });
});

module.exports = router;
