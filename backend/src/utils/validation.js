const isPositiveInteger = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
};

const isValidEmail = (value) =>
  typeof value === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const isValidDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const isValidTime = (value) =>
  typeof value === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const sanitizeText = (value, maxLength = 1000) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
};

module.exports = {
  isPositiveInteger,
  isValidDate,
  isValidEmail,
  isValidTime,
  sanitizeText
};
