const { generateSummary } = require('../services/summary.service');

async function handleGenerateSummary(req, res) {
  try {
    const { specialization, answers } = req.body;

    if (!specialization || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: 'specialization and non-empty answers array are required.',
      });
    }

    const result = await generateSummary({ specialization, answers });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Generate summary error:', error.message);
    return res.status(500).json({ error: 'Failed to generate case summary.' });
  }
}

module.exports = { handleGenerateSummary };
