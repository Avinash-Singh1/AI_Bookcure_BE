const express = require('express');
const { handleGenerateSummary } = require('../controllers/summary.controller');

const router = express.Router();

// POST /ai/generate-summary — called internally by main backend only
router.post('/generate-summary', handleGenerateSummary);

module.exports = router;
