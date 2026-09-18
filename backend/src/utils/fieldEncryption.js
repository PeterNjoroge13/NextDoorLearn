const crypto = require('crypto');

const prefix = 'enc:v1:';

const encryptionKey = () => {
  const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('FIELD_ENCRYPTION_KEY or JWT_SECRET is required');
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptField = (value) => {
  if (value === undefined || value === null || value === '') return value || null;
  if (String(value).startsWith(prefix)) return String(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${prefix}${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`;
};

const decryptField = (value) => {
  if (value === undefined || value === null || value === '') return value || null;
  const encoded = String(value);
  if (!encoded.startsWith(prefix)) return encoded;
  const payload = Buffer.from(encoded.slice(prefix.length), 'base64url');
  if (payload.length < 29) throw new Error('Encrypted field is invalid');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

const isEncryptedField = (value) => typeof value === 'string' && value.startsWith(prefix);

module.exports = { decryptField, encryptField, isEncryptedField };
