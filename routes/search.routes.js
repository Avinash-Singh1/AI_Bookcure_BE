const express = require('express');
const { handleSearchSuggest, handleParseQuery } = require('../controllers/search.controller');

const router = express.Router();

// POST /api/search/ai-suggest — extract medical intent from natural language
router.post('/ai-suggest', handleSearchSuggest);

// POST /api/search/parse-query — parse query into structured ES filters
router.post('/parse-query', handleParseQuery);

module.exports = router;
