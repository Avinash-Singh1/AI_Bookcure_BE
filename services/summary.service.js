const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_PROMPT = `You are a medical intake AI. Given a patient's answers to pre-consultation questions, generate a structured clinical summary for the doctor.

INPUT: Array of { questionId, question, answer } objects and the specialization.
OUTPUT: Strict JSON (no markdown) with this exact shape:

{
  "summary": {
    "symptoms": ["symptom1", "symptom2"],
    "duration": "e.g. 3 days",
    "severity": "mild|moderate|severe",
    "possible_causes": ["cause1", "cause2"]
  },
  "triage": "Recommended specialist or General Physician"
}

RULES:
- Extract symptoms from all answers
- Infer duration from time-related answers
- Assess severity from pain/impact answers
- List 2-4 plausible causes based on symptoms
- Keep it concise — this is a pre-consult snapshot
- Return ONLY valid JSON, no markdown`;

/**
 * Generate AI case summary from pre-consult answers
 */
async function generateSummary({ specialization, answers }) {
  const formattedAnswers = answers
    .map((a) => `Q: ${a.question || a.questionId}\nA: ${Array.isArray(a.answer) ? a.answer.join(', ') : a.answer}`)
    .join('\n\n');

  const userContent = `Specialization: ${specialization}\n\nPatient Answers:\n${formattedAnswers}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    return {
      summary: {
        symptoms: parsed.summary?.symptoms || [],
        duration: parsed.summary?.duration || '',
        severity: parsed.summary?.severity || '',
        possible_causes: parsed.summary?.possible_causes || [],
      },
      triage: parsed.triage || specialization,
    };
  } catch (err) {
    console.error('generateSummary AI error:', err.message);
    // Fallback: build a basic summary from raw answers
    const symptoms = answers
      .filter((a) => a.question && a.question.toLowerCase().includes('symptom'))
      .map((a) => (Array.isArray(a.answer) ? a.answer.join(', ') : a.answer));

    return {
      summary: {
        symptoms: symptoms.length ? symptoms : ['See patient answers'],
        duration: '',
        severity: '',
        possible_causes: [],
      },
      triage: specialization,
    };
  }
}

module.exports = { generateSummary };
