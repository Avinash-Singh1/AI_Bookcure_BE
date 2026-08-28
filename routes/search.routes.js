const express = require('express');
const { handleSearchSuggest } = require('../controllers/search.controller');

const router = express.Router();

// POST /api/search/ai-suggest — extract medical intent from natural language
router.post('/ai-suggest', handleSearchSuggest);

// POST /api/search/parse-query — alias for backend API queries
router.post('/parse-query', handleSearchSuggest);

module.exports = router;
