const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const QUERY_PARSER_PROMPT = `You are a search query parser for a medical/healthcare doctor-finding platform called NectarPlus Health.

Your ONLY job is to extract structured search filters from a user's natural language query and return strict JSON.

INPUT: A user's search query (may contain symptoms, doctor type, location, budget, preferences)
OUTPUT: A JSON object with structured filters for searching doctors

EXTRACTION RULES:
1. Identify the doctor specialization being sought
2. Extract any symptoms mentioned
3. Detect gender preference for the doctor
4. Extract maximum consultation fee/budget
5. Detect location (city, area, locality)
6. Detect availability preferences (today, this week, etc.)
7. Detect consultation type preference (video call, in-clinic, online)
8. Determine the best sort order

SPECIALIZATION MAPPINGS:
- fever, cold, cough, flu → General Physician
- chest pain, heart, BP, blood pressure → Cardiologist
- skin, acne, hair fall, rash, eczema → Dermatologist
- bone, joint, fracture, knee, back pain → Orthopedic
- eye, vision, cataract → Ophthalmologist
- child, baby, infant → Pediatrician
- pregnancy, periods, PCOS, women → Gynecologist
- cancer, tumor → Oncologist
- brain, nerve, headache, migraine, seizure → Neurologist
- lung, breathing, asthma → Pulmonologist
- ear, nose, throat, sinus → ENT
- stomach, liver, digestion, acidity → Gastroenterologist
- kidney, urinary → Nephrologist
- diabetes, thyroid, hormone → Endocrinologist
- mental health, depression, anxiety → Psychiatrist
- teeth, dental, gum → Dentist
- surgery → General Surgeon

AVAILABILITY MAPPINGS:
- "today", "now", "immediately", "urgent" → "today"
- "this week", "soon" → "this_week"
- "weekend", "saturday", "sunday" → "weekend"
- No mention → null

SORT MAPPINGS:
- "best", "top", "highest rated" → "relevance"
- "cheapest", "affordable", "low cost", "budget" → "fee_asc"
- "nearest", "close by" → "distance"
- "most experienced", "senior" → "experience"
- Default → "relevance"

Handle misspellings, Hindi/Hinglish terms, and colloquial language:
- "dil ka doctor" → Cardiologist
- "haddi wala doctor" → Orthopedic
- "bacchon ka doctor" → Pediatrician
- "mahila doctor" → gender: female
- "sasta" → low budget intent

OUTPUT FORMAT (strict JSON, no explanations):
{
  "specialization": "string or null",
  "symptoms": ["array of detected symptoms"],
  "gender": "male|female|null",
  "maxFee": number or null,
  "location": "string or null",
  "availability": "today|this_week|weekend|null",
  "consultationType": ["video"|"clinic"] or [],
  "sortBy": "relevance|fee_asc|distance|experience"
}

IMPORTANT:
- Return ONLY valid JSON
- If a field cannot be determined, use null or empty array
- Do NOT make up information — only extract what's in the query
- Keep specialization as a single string (primary match)
- maxFee should be a number (e.g., 500) not a string`;

// In-memory cache with TTL (reuse pattern from search.service.js)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function normalizeForCache(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function getCached(query) {
  const key = normalizeForCache(query);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) cache.delete(key);
  return null;
}

function setCache(query, data) {
  const key = normalizeForCache(query);
  if (cache.size > 1000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// Default/fallback structure
const DEFAULT_PARSED = {
  specialization: null,
  symptoms: [],
  gender: null,
  maxFee: null,
  location: null,
  availability: null,
  consultationType: [],
  sortBy: "relevance",
};

/**
 * Parse a user's search query into structured filters using GPT-4o
 * @param {string} query - Raw user query
 * @returns {Object} Structured search filters
 */
async function parseUserQuery(query) {
  // Check cache
  const cached = getCached(query);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: QUERY_PARSER_PROMPT },
      { role: "user", content: query },
    ],
    temperature: 0.1,
    max_tokens: 256,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("Failed to parse AI query response:", content);
    return { ...DEFAULT_PARSED, fromCache: false };
  }

  // Validate and normalize the parsed output
  const result = {
    specialization:
      typeof parsed.specialization === "string"
        ? parsed.specialization.trim()
        : null,
    symptoms: Array.isArray(parsed.symptoms)
      ? parsed.symptoms.filter((s) => typeof s === "string")
      : [],
    gender:
      typeof parsed.gender === "string" &&
      ["male", "female"].includes(parsed.gender.toLowerCase())
        ? parsed.gender.toLowerCase()
        : null,
    maxFee:
      typeof parsed.maxFee === "number" && parsed.maxFee > 0
        ? parsed.maxFee
        : null,
    location:
      typeof parsed.location === "string" ? parsed.location.trim() : null,
    availability:
      typeof parsed.availability === "string" &&
      ["today", "this_week", "weekend"].includes(parsed.availability)
        ? parsed.availability
        : null,
    consultationType: Array.isArray(parsed.consultationType)
      ? parsed.consultationType.filter((t) =>
          ["video", "clinic"].includes(t?.toLowerCase())
        )
      : [],
    sortBy:
      typeof parsed.sortBy === "string" &&
      ["relevance", "fee_asc", "distance", "experience"].includes(
        parsed.sortBy
      )
        ? parsed.sortBy
        : "relevance",
    fromCache: false,
  };

  // Cache the result
  setCache(query, result);

  return result;
}

module.exports = { parseUserQuery };
