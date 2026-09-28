const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isFeatureDisabled, requireFeature } = require('../src/services/featureFlags');
const { runParticipantOperations } = require('../src/services/googleCalendar');
const { publicPaymentConfig } = require('../src/services/payments');
const { boundedDays } = require('../src/services/dataRetention');
const { sanitizeDetails } = require('../src/services/logger');

const withEnvironment = async (values, callback) => {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  try {
    await callback();
  } finally {
    Object.entries(original).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
};

test('maintenance switches return a stable client-facing response', async () => {
  await withEnvironment({ DISABLE_NEW_BOOKINGS: 'true' }, async () => {
    assert.equal(isFeatureDisabled('bookings'), true);
    let response;
    requireFeature('bookings')({}, {
      status(status) {
        return { json(payload) { response = { status, payload }; } };
      }
    }, () => assert.fail('Disabled feature should not call next'));
    assert.equal(response.status, 503);
    assert.equal(response.payload.code, 'FEATURE_MAINTENANCE');
    assert.equal(response.payload.feature, 'bookings');
  });
});

test('payment maintenance hides checkout configuration without disabling provider credentials', async () => {
  await withEnvironment({
    DISABLE_PAYMENTS: '1',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_placeholder'
  }, async () => {
    const config = publicPaymentConfig();
    assert.equal(config.configured, false);
    assert.equal(config.maintenance, true);
    assert.equal(config.publishableKey, null);
  });
});

test('Google participant operations isolate failures', async () => {
  const completed = [];
  const results = await runParticipantOperations([{ userId: 10 }, { userId: 20 }], async ({ userId }) => {
    if (userId === 10) throw Object.assign(new Error('revoked'), { code: 401 });
    completed.push(userId);
    return { eventId: 'calendar-event-20' };
  });
  assert.deepEqual(completed, [20]);
  assert.equal(results[0].status, 'failed');
  assert.equal(results[1].status, 'synced');
  assert.equal(results[1].eventId, 'calendar-event-20');
});

test('retention configuration is bounded and logs redact sensitive fields', () => {
  assert.equal(boundedDays('14', 30), 14);
  assert.equal(boundedDays('0', 30), 30);
  assert.equal(boundedDays('99999', 30), 30);
  assert.deepEqual(sanitizeDetails({
    requestId: 'request-1',
    password: 'do-not-log',
    recipient: 'student@example.com',
    nested: { authorization: 'Bearer secret', token: 'secret-token', safe: 'visible' }
  }), {
    requestId: 'request-1',
    password: '[redacted]',
    recipient: '[redacted]',
    nested: { authorization: '[redacted]', token: '[redacted]', safe: 'visible' }
  });
});
