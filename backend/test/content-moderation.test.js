const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findContentPolicyViolation } = require('../src/services/contentModeration');

test('allows ordinary tutoring communication', () => {
  assert.equal(findContentPolicyViolation('Can we review derivatives after school tomorrow?'), null);
  assert.equal(findContentPolicyViolation('Please send your practice worksheet before our session.'), null);
});

test('detects high-confidence unsafe content and common obfuscation', () => {
  assert.equal(findContentPolicyViolation('Do not tell your parents. Meet me alone.'), 'unsafe contact with a minor');
  assert.equal(findContentPolicyViolation('S3nd me your p@ssword'), 'requests for sensitive information');
  assert.equal(findContentPolicyViolation('I will hurt you'), 'threats or violence');
  assert.equal(findContentPolicyViolation('Send me nudes'), 'sexual content');
});
