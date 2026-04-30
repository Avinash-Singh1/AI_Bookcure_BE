const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYMPTOM_CHECK_PROMPT = `You are a medical triage AI for NectarPlus Health. Analyze the user's input and return a structured JSON response.

RULES:
1. First determine if the input is medically relevant (symptoms, diseases, body issues, health concerns). Reject nonsense, greetings, or non-medical queries.
2. Extract all symptoms mentioned, including implied ones.
3. Map symptoms to the most relevant medical specializations with a confidence score (0.0-1.0). Scores must sum to 1.0.
4. Assign urgency: "low" (cosmetic/chronic), "medium" (needs attention within days), "high" (within 24h), "emergency" (life-threatening).

SPECIALIZATION MAPPING:
- Chest pain, palpitations, high BP → Cardiologist
- Skin rash, acne, hair fall, eczema → Dermatologist
- Bone/joint/back pain, fracture → Orthopedic
- Child health, pediatric issues → Pediatrician
- Women's health, PCOS, pregnancy → Gynecologist
- Brain, stroke, seizure, migraine, nerve → Neurologist
- Breathing, asthma, lung issues → Pulmonologist
- Ear, nose, throat, sinus → ENT Specialist
- Stomach, liver, acid reflux, IBS → Gastroenterologist
- Kidney, urinary tract → Nephrologist
- Diabetes, thyroid, hormone → Endocrinologist
- Mental health, anxiety, depression → Psychiatrist
- Eye issues, vision → Ophthalmologist
- Dental issues → Dentist
- Fever, cold, flu, general illness → General Physician

OUTPUT FORMAT (strict JSON, no markdown):
{
  "valid": true,
  "symptoms": ["symptom1", "symptom2"],
  "specialists": [
    { "name": "SpecialistName", "confidence": 0.7 },
    { "name": "SpecialistName2", "confidence": 0.3 }
  ],
  "urgency": "low|medium|high|emergency"
}

If not medical: { "valid": false, "reason": "brief reason" }

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations.`;

// In-memory cache (1 hour TTL)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

function getCacheKey(query) {
  return query.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function getFromCache(query) {
  const key = getCacheKey(query);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setInCache(query, data) {
  const key = getCacheKey(query);
  if (cache.size > 1000) cache.delete(cache.keys().next().value);
  cache.set(key, { data, timestamp: Date.now() });
}

const FALLBACK_RESPONSE = {
  valid: true,
  symptoms: [],
  specialists: [{ name: 'General Physician', confidence: 1.0 }],
  urgency: 'low',
  fromCache: false,
  fallback: true,
};

async function checkSymptoms(query) {
  const cached = getFromCache(query);
  if (cached) return { ...cached, fromCache: true };

  let parsed;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYMPTOM_CHECK_PROMPT },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    parsed = JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error('Symptom check OpenAI error:', err.message);
    return { ...FALLBACK_RESPONSE };
  }

  // Validate and normalise
  if (!parsed.valid) {
    return { valid: false, reason: parsed.reason || 'Not a medical query' };
  }

  // Ensure specialists confidence sums to ~1
  const specialists = Array.isArray(parsed.specialists)
    ? parsed.specialists
        .filter((s) => s && typeof s.name === 'string' && typeof s.confidence === 'number')
        .slice(0, 4)
    : [{ name: 'General Physician', confidence: 1.0 }];

  const total = specialists.reduce((sum, s) => sum + s.confidence, 0);
  const normalised = specialists.map((s) => ({
    name: s.name,
    confidence: Math.round((s.confidence / (total || 1)) * 100) / 100,
  }));

  const result = {
    valid: true,
    symptoms: Array.isArray(parsed.symptoms)
      ? parsed.symptoms.filter((s) => typeof s === 'string')
      : [],
    specialists: normalised,
    urgency: ['low', 'medium', 'high', 'emergency'].includes(parsed.urgency)
      ? parsed.urgency
      : 'low',
    fromCache: false,
  };

  setInCache(query, result);
  return result;
}

module.exports = { checkSymptoms };
