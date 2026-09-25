const compact = (value) => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replaceAll('@', 'a')
  .replaceAll('$', 's')
  .replace(/[013457]/g, (character) => ({
    0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't'
  })[character])
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const rules = [
  {
    category: 'sexual content',
    pattern: /\b(?:porn(?:ography)?|sexual\s+(?:photo|video|content)|explicit\s+(?:photo|video|content)|send\s+(?:me\s+)?(?:a\s+)?nudes?|show\s+(?:me\s+)?(?:a\s+)?nudes?|share\s+(?:a\s+)?nudes?|what\s+are\s+you\s+wearing)\b/
  },
  {
    category: 'threats or violence',
    pattern: /\b(?:i|we)\s+(?:will|am\s+going\s+to|m\s+going\s+to|ll)\s+(?:kill|hurt|attack|beat|shoot|stab)\s+(?:you|your\s+family)\b|\bi\s+know\s+where\s+you\s+live\b/
  },
  {
    category: 'unsafe contact with a minor',
    pattern: /\b(?:do\s+not|dont)\s+tell\s+(?:your\s+)?(?:parent|parents|guardian)|\bkeep\s+this\s+(?:a\s+)?secret\s+from\s+(?:your\s+)?(?:parent|parents|guardian)|\bmeet\s+me\s+alone\b/
  },
  {
    category: 'requests for sensitive information',
    pattern: /\bsend\s+(?:me\s+)?(?:your\s+)?(?:password|social\s+security\s+number|credit\s+card\s+number|bank\s+login)|\bwhat\s+is\s+(?:your\s+)?(?:password|social\s+security\s+number)\b/
  },
  {
    category: 'targeted harassment',
    pattern: /\b(?:go\s+kill\s+yourself|you\s+should\s+kill\s+yourself|worthless\s+(?:idiot|loser)|stupid\s+(?:idiot|loser))\b/
  }
];

const findContentPolicyViolation = (...values) => {
  const normalized = values
    .flat(Infinity)
    .filter((value) => typeof value === 'string')
    .map(compact)
    .filter(Boolean)
    .join(' ');
  if (!normalized) return null;
  return rules.find((rule) => rule.pattern.test(normalized))?.category || null;
};

const contentPolicyError = (category) => ({
  error: `This content cannot be posted because it may contain ${category}. Revise it or contact support if this is a mistake.`,
  code: 'CONTENT_POLICY'
});

module.exports = { findContentPolicyViolation, contentPolicyError };
