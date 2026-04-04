const EMERGENCY_KEYWORDS = [
  'chest pain',
  'difficulty breathing',
  'can\'t breathe',
  'cannot breathe',
  'shortness of breath',
  'stroke',
  'seizure',
  'unconscious',
  'passed out',
  'fainting',
  'severe bleeding',
  'heavy bleeding',
  'heart attack',
  'choking',
  'suicidal',
  'overdose',
  'anaphylaxis',
  'allergic reaction severe',
];

const EMERGENCY_WARNING =
  '⚠️ **This could be a medical emergency. Please seek immediate medical attention or call emergency services (911 / local emergency number) right away.** Do not wait — your safety is the priority.';

function detectEmergency(message) {
  const lowerMessage = message.toLowerCase();
  const isEmergency = EMERGENCY_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword)
  );
  return { isEmergency };
}

module.exports = { detectEmergency, EMERGENCY_WARNING };
