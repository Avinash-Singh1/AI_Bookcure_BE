const express = require('express');
const { handleSymptomCheck } = require('../controllers/symptom.controller');

const router = express.Router();

// POST /ai/symptom-check
router.post('/symptom-check', handleSymptomCheck);

module.exports = router;
