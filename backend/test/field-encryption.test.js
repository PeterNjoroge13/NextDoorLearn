const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.FIELD_ENCRYPTION_KEY = 'test-only-field-encryption-key';
const { decryptField, encryptField, isEncryptedField } = require('../src/utils/fieldEncryption');

test('sensitive database fields are encrypted and authenticated', () => {
  const encrypted = encryptField('oauth-refresh-token');
  assert.equal(isEncryptedField(encrypted), true);
  assert.notEqual(encrypted, 'oauth-refresh-token');
  assert.equal(decryptField(encrypted), 'oauth-refresh-token');

  const payload = Buffer.from(encrypted.slice('enc:v1:'.length), 'base64url');
  payload[20] ^= 1;
  const tampered = `enc:v1:${payload.toString('base64url')}`;
  assert.throws(() => decryptField(tampered));
});

test('legacy plaintext values remain readable for lazy migration', () => {
  assert.equal(decryptField('legacy-token'), 'legacy-token');
  assert.equal(encryptField(null), null);
  assert.equal(decryptField(null), null);
});
