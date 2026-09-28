const SENSITIVE_KEY = /^(authorization|cookie|.*password.*|.*secret.*|.*token.*|email(address)?|phone(number)?|address|recipient|content|body)$/i;

const sanitizeDetails = (value, depth = 0) => {
  if (depth > 4) return '[truncated]';
  if (value instanceof Error) {
    return {
      name: value.name,
      code: value.code,
      ...(process.env.NODE_ENV === 'production'
        ? {}
        : { message: value.message, stack: value.stack })
    };
  }
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeDetails(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[redacted]' : sanitizeDetails(item, depth + 1)
  ]));
};

const write = (level, event, details = {}) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeDetails(details)
  });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
};

module.exports = {
  error: (event, details) => write('error', event, details),
  info: (event, details) => write('info', event, details),
  sanitizeDetails,
  warn: (event, details) => write('warn', event, details)
};
