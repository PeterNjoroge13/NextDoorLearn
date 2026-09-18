const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.FIELD_ENCRYPTION_KEY = 'test-only-field-encryption-key';
const { decryptField, encryptField, isEncryptedField } = require('../src/utils/fieldEncryption');

test('sensitive database fields are encrypted and authenticated', () => {
  const encrypted = encryptField('oauth-refresh-token');
  assert.equal(isEncryptedField(encrypted), true);
  assert.notEqual(encrypted, 'oauth-refresh-token');
  assert.equal(decryptField(encrypted), 'oauth-refresh-token');

  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('a') ? 'b' : 'a'}`;
  assert.throws(() => decryptField(tampered));
});

test('legacy plaintext values remain readable for lazy migration', () => {
  assert.equal(decryptField('legacy-token'), 'legacy-token');
  assert.equal(encryptField(null), null);
  assert.equal(decryptField(null), null);
});
