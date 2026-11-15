const test = require('node:test');
const assert = require('node:assert/strict');
const { STRIPE_API_VERSION, tutorAccountState } = require('../src/services/payments');

const v2Account = (transferStatus, entries = []) => ({
  object: 'v2.core.account',
  id: 'acct_test',
  configuration: {
    recipient: {
      applied: true,
      capabilities: { stripe_balance: { stripe_transfers: { status: transferStatus, status_details: [] } } }
    }
  },
  requirements: { entries }
});

test('Stripe API version is pinned', () => {
  assert.equal(STRIPE_API_VERSION, '2026-10-28.endive');
});

test('v2 recipient with active transfers is ready to receive payments', () => {
  const state = tutorAccountState(v2Account('active'));
  assert.equal(state.onboardingStatus, 'active');
  assert.equal(state.payoutsEnabled, true);
  assert.equal(state.chargesEnabled, true);
  assert.deepEqual(state.requirementsDue, []);
});

test('v2 recipient with currently due requirements is pending and lists them', () => {
  const state = tutorAccountState(v2Account('pending', [
    { description: 'Provide date of birth', minimum_deadline: { status: 'currently_due' } },
    { description: 'Provide date of birth', minimum_deadline: { status: 'past_due' } },
    { description: 'Upload ID later', minimum_deadline: { status: 'eventually_due' } }
  ]));
  assert.equal(state.onboardingStatus, 'pending');
  assert.equal(state.payoutsEnabled, false);
  assert.equal(state.detailsSubmitted, false);
  assert.deepEqual(state.requirementsDue, ['Provide date of birth']);
});

test('v2 recipient that is restricted without due requirements needs attention', () => {
  const state = tutorAccountState(v2Account('restricted'));
  assert.equal(state.onboardingStatus, 'restricted');
  assert.equal(state.payoutsEnabled, false);
});

test('legacy v1 accounts keep working until they are migrated', () => {
  const state = tutorAccountState({
    object: 'account',
    payouts_enabled: true,
    charges_enabled: true,
    details_submitted: true,
    requirements: { currently_due: [], past_due: [] }
  });
  assert.equal(state.onboardingStatus, 'active');
  assert.equal(state.payoutsEnabled, true);
});
