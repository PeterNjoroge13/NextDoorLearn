const isPositiveInteger = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
};

const isValidEmail = (value) =>
  typeof value === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidTime = (value) =>
  typeof value === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isValidTimeZone = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const sanitizeText = (value, maxLength = 1000) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
};

const normalizeStringArray = (value, { maxItems = 20, maxLength = 100 } = {}) => {
  if (!Array.isArray(value)) return null;
  const normalized = [];
  for (const item of value) {
    const text = sanitizeText(item, maxLength);
    if (text && !normalized.includes(text)) normalized.push(text);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
};

const boundedInteger = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = min } = {}) => {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};

const isValidHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const passwordValidationError = (value) => {
  if (typeof value !== 'string' || value.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    return 'Password must be 72 bytes or fewer';
  }
  return null;
};

module.exports = {
  boundedInteger,
  isPositiveInteger,
  isValidDate,
  isValidEmail,
  isValidHttpUrl,
  isValidTime,
  isValidTimeZone,
  normalizeStringArray,
  passwordValidationError,
  sanitizeText
};
