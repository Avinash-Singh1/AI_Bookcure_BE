const { extractMedicalIntent } = require('../services/search.service');
const { parseUserQuery } = require('../services/aiQueryParser');

async function handleSearchSuggest(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required and must be a non-empty string.',
      });
    }

    const sanitizedQuery = query.trim().substring(0, 500);

    const result = await extractMedicalIntent(sanitizedQuery);

    return res.json({
      success: true,
      data: result,
      query: sanitizedQuery,
    });
  } catch (error) {
    console.error('AI Search error:', error.message);
    return res.status(500).json({
      error: 'Failed to process search query. Please try again.',
    });
  }
}

/**
 * POST /api/search/parse-query
 * Parses a user search query into structured filters for Elasticsearch
 */
async function handleParseQuery(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required and must be a non-empty string.',
      });
    }

    const sanitizedQuery = query.trim().substring(0, 500);
    const parsed = await parseUserQuery(sanitizedQuery);

    return res.json({
      success: true,
      data: parsed,
      query: sanitizedQuery,
    });
  } catch (error) {
    console.error('Parse query error:', error.message);
    return res.status(500).json({
      error: 'Failed to parse search query. Please try again.',
    });
  }
}

module.exports = { handleSearchSuggest, handleParseQuery };
