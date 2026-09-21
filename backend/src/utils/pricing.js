const MAX_TUTOR_RATE = 25;
const STUDENT_BUDGETS = new Set(['free', 'under-10', 'under-15', 'under-20', 'under-25', 'flexible']);

const validateTutorRate = (value) => {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_TUTOR_RATE) {
    return { error: `Hourly rate must be between $0 and $${MAX_TUTOR_RATE}` };
  }
  return { value: Math.round(rate * 100) / 100 };
};

const budgetLimit = (preference) => {
  const value = String(preference || 'flexible').toLowerCase();
  if (value === 'free') return 0;
  const match = value.match(/^under-(10|15|20|25)$/);
  return match ? Number(match[1]) : MAX_TUTOR_RATE;
};

module.exports = { budgetLimit, MAX_TUTOR_RATE, STUDENT_BUDGETS, validateTutorRate };
