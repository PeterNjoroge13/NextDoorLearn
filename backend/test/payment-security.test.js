const { test } = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { isValidMeetingUrl } = require('../src/utils/validation');
const {
  assertPaymentIntentMatches,
  shouldApplyPaymentStatus,
  statusForPaymentIntentEvent
} = require('../src/services/paymentSecurity');

const payment = {
  id: 91,
  session_id: 17,
  student_id: 5,
  tutor_id: 8,
  amount_cents: 2500,
  currency: 'usd'
};

const intent = (overrides = {}) => ({
  id: 'pi_verified',
  amount: 2500,
  currency: 'usd',
  status: 'succeeded',
  transfer_data: { destination: 'acct_tutor' },
  metadata: {
    nextdoorlearn_payment_id: '91',
    nextdoorlearn_session_id: '17',
    nextdoorlearn_student_id: '5',
    nextdoorlearn_tutor_id: '8'
  },
  ...overrides
});

test('accepts only payment intents that match the server-side ledger', () => {
  assert.equal(assertPaymentIntentMatches(intent(), payment, 'acct_tutor'), true);
  assert.throws(() => assertPaymentIntentMatches(intent({ amount: 1 }), payment, 'acct_tutor'), /amount/i);
  assert.throws(() => assertPaymentIntentMatches(intent({ currency: 'eur' }), payment, 'acct_tutor'), /currency/i);
  assert.throws(() => assertPaymentIntentMatches(intent({ metadata: { ...intent().metadata, nextdoorlearn_session_id: '99' } }), payment, 'acct_tutor'), /ownership/i);
  assert.throws(() => assertPaymentIntentMatches(intent({ transfer_data: { destination: 'acct_attacker' } }), payment, 'acct_tutor'), /destination/i);
  assert.throws(() => assertPaymentIntentMatches(intent(), payment, null), /destination/i);
});

test('rejects fabricated or inconsistent payment event transitions', () => {
  assert.equal(statusForPaymentIntentEvent('payment_intent.succeeded', intent()), 'succeeded');
  assert.equal(statusForPaymentIntentEvent('payment_intent.untrusted', intent()), null);
  assert.throws(
    () => statusForPaymentIntentEvent('payment_intent.succeeded', intent({ status: 'requires_payment_method' })),
    /do not agree/i
  );
  assert.equal(shouldApplyPaymentStatus('succeeded', 'failed'), false);
  assert.equal(shouldApplyPaymentStatus('refunded', 'succeeded'), false);
  assert.equal(shouldApplyPaymentStatus('failed', 'succeeded'), true);
});

test('Stripe signature verification rejects forged payloads', () => {
  const secret = 'whsec_unit_test_secret';
  const payload = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded', data: { object: intent() } });
  const validHeader = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(Stripe.webhooks.constructEvent(payload, validHeader, secret).id, 'evt_test');
  assert.throws(() => Stripe.webhooks.constructEvent(payload, 't=1,v1=forged', secret));
});

test('custom meeting links are limited to trusted conferencing providers', () => {
  assert.equal(isValidMeetingUrl('https://meet.google.com/abc-defg-hij'), true);
  assert.equal(isValidMeetingUrl('https://school.zoom.us/j/12345'), true);
  assert.equal(isValidMeetingUrl('https://zoom.us.attacker.example/j/12345'), false);
  assert.equal(isValidMeetingUrl('https://user:password@zoom.us/j/12345'), false);
  assert.equal(isValidMeetingUrl('http://zoom.us/j/12345'), false);
});
