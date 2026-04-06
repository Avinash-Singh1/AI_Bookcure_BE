const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SEARCH_EXTRACTION_PROMPT = `You are a medical search intent extraction engine for the NectarPlus Health platform. Your ONLY job is to extract structured medical information from user search queries.

INPUT: A user's search query (may be natural language symptoms, disease names, or medical terms)
OUTPUT: A JSON object with extracted medical information

RULES:
1. Extract symptoms, diseases, and map them to medical specializations
2. Assess urgency level based on symptom severity
3. Handle misspellings and colloquial language (e.g., "fevr" = fever, "hart" = heart)
4. Handle Hindi/Hinglish terms (e.g., "bukhar" = fever, "sir dard" = headache)
5. Return ONLY valid JSON — no explanations, no markdown, no conversation
6. If the query is not medical (e.g., "pizza near me"), set isNaturalLanguage to false

SPECIALIZATION MAPPING GUIDELINES:
- Fever, cold, cough, general illness → General Physician
- Chest pain, heart problems, BP → Cardiologist
- Skin issues, hair fall, acne → Dermatologist
- Bone/joint pain, fracture → Orthopedic
- Eye problems → Ophthalmologist
- Children's health → Pediatrician
- Women's health, periods, pregnancy → Gynecologist
- Cancer, tumor → Oncologist
- Brain, nerves, seizure, stroke → Neurologist
- Lung, breathing → Pulmonologist
- Ear, nose, throat → ENT
- Stomach, liver, digestion → Gastroenterologist
- Kidney, urinary → Nephrologist / Urologist
- Diabetes, thyroid, hormones → Endocrinologist
- Mental health → Psychiatrist
- Dental → Dentist
- Surgery-related → General Surgeon

URGENCY LEVELS:
- "low": Minor symptoms, cosmetic issues, chronic conditions
- "medium": Moderate symptoms needing medical attention within days
- "high": Serious symptoms needing prompt attention within 24 hours
- "emergency": Life-threatening symptoms (chest pain, stroke, severe bleeding, difficulty breathing, seizures)

OUTPUT FORMAT (strict JSON):
{
  "symptoms": ["extracted symptom 1", "extracted symptom 2"],
  "diseases": ["possible disease 1", "possible disease 2"],
  "specializations": ["Specialization 1", "Specialization 2"],
  "alternativeSpecializations": ["Related Specialization 1", "Related Specialization 2"],
  "urgency": "low|medium|high|emergency",
  "isNaturalLanguage": true,
  "searchTerms": ["optimized", "search", "keywords"]
}

NOTE: alternativeSpecializations should contain 2-3 related specializations that could also handle the patient's concern, different from the primary specializations. For example, if primary is "Cardiologist", alternatives could be ["General Physician", "Pulmonologist"].`;

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function normalizeQueryForCache(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function getCachedResult(query) {
  const key = normalizeQueryForCache(query);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

function setCachedResult(query, data) {
  const key = normalizeQueryForCache(query);
  // Limit cache size to prevent memory leaks
  if (cache.size > 1000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

async function extractMedicalIntent(query) {
  // Check cache first
  const cached = getCachedResult(query);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SEARCH_EXTRACTION_PROMPT },
      { role: 'user', content: query },
    ],
    temperature: 0.2,
    max_tokens: 256,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      symptoms: [],
      diseases: [],
      specializations: [],
      alternativeSpecializations: [],
      urgency: 'low',
      isNaturalLanguage: false,
      searchTerms: [query],
    };
  }

  // Ensure all required fields exist
  const result = {
    symptoms: parsed.symptoms || [],
    diseases: parsed.diseases || [],
    specializations: parsed.specializations || [],
    alternativeSpecializations: parsed.alternativeSpecializations || [],
    urgency: parsed.urgency || 'low',
    isNaturalLanguage: parsed.isNaturalLanguage !== false,
    searchTerms: parsed.searchTerms || [],
    fromCache: false,
  };

  // Cache the result
  setCachedResult(query, result);

  return result;
}

module.exports = { extractMedicalIntent };
