const { checkSymptoms } = require('../services/symptom.service');

async function handleSymptomCheck(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'query is required and must be a non-empty string.' });
    }

    const sanitized = query.trim().substring(0, 500);
    const result = await checkSymptoms(sanitized);

    return res.json({ success: true, data: result, query: sanitized });
  } catch (error) {
    console.error('Symptom check error:', error.message);
    return res.status(500).json({ error: 'Failed to process symptom check. Please try again.' });
  }
}

module.exports = { handleSymptomCheck };
