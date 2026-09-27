const paymentEventStates = new Map([
  ['payment_intent.created', new Set(['requires_payment_method', 'requires_confirmation', 'requires_action'])],
  ['payment_intent.requires_action', new Set(['requires_action'])],
  ['payment_intent.processing', new Set(['processing'])],
  ['payment_intent.amount_capturable_updated', new Set(['requires_capture'])],
  ['payment_intent.succeeded', new Set(['succeeded'])],
  ['payment_intent.payment_failed', new Set(['requires_payment_method'])],
  ['payment_intent.canceled', new Set(['canceled'])],
]);

const storedStatusForEvent = new Map([
  ['payment_intent.created', 'pending'],
  ['payment_intent.requires_action', 'requires_action'],
  ['payment_intent.processing', 'processing'],
  ['payment_intent.amount_capturable_updated', 'processing'],
  ['payment_intent.succeeded', 'succeeded'],
  ['payment_intent.payment_failed', 'failed'],
  ['payment_intent.canceled', 'cancelled'],
]);

const paymentSecurityError = (message) => Object.assign(new Error(message), {
  code: 'PAYMENT_EVENT_MISMATCH',
  statusCode: 422,
});

const destinationId = (intent) => {
  const destination = intent?.transfer_data?.destination;
  return typeof destination === 'string' ? destination : destination?.id;
};

const assertPaymentIntentMatches = (intent, payment, expectedDestinationAccountId) => {
  if (!intent || !payment) throw paymentSecurityError('Payment record could not be verified');

  const expected = {
    paymentId: String(payment.id),
    sessionId: String(payment.session_id),
    studentId: String(payment.student_id),
    tutorId: String(payment.tutor_id),
  };
  const metadata = intent.metadata || {};
  const actualAmount = Number(intent.amount);
  const expectedAmount = Number(payment.amount_cents);
  const actualCurrency = String(intent.currency || '').toLowerCase();
  const expectedCurrency = String(payment.currency || 'usd').toLowerCase();

  if (!Number.isSafeInteger(actualAmount) || actualAmount !== expectedAmount) {
    throw paymentSecurityError('Payment amount does not match the booked session total');
  }
  if (actualCurrency !== expectedCurrency) {
    throw paymentSecurityError('Payment currency does not match the booked session');
  }
  if (
    metadata.nextdoorlearn_payment_id !== expected.paymentId
    || metadata.nextdoorlearn_session_id !== expected.sessionId
    || metadata.nextdoorlearn_student_id !== expected.studentId
    || metadata.nextdoorlearn_tutor_id !== expected.tutorId
  ) {
    throw paymentSecurityError('Payment ownership metadata does not match the booked session');
  }
  if (!expectedDestinationAccountId || destinationId(intent) !== expectedDestinationAccountId) {
    throw paymentSecurityError('Payment destination does not match the tutor payout account');
  }
  return true;
};

const statusForPaymentIntentEvent = (eventType, intent) => {
  const acceptedStates = paymentEventStates.get(eventType);
  if (!acceptedStates) return null;
  if (!acceptedStates.has(intent?.status)) {
    throw paymentSecurityError('Payment event type and provider status do not agree');
  }
  return storedStatusForEvent.get(eventType);
};

const shouldApplyPaymentStatus = (currentStatus, nextStatus) => {
  if (currentStatus === 'refunded') return false;
  if (currentStatus === 'succeeded' && nextStatus !== 'succeeded') return false;
  if (nextStatus === 'pending' && currentStatus !== 'pending') return false;
  return true;
};

module.exports = {
  assertPaymentIntentMatches,
  paymentSecurityError,
  shouldApplyPaymentStatus,
  statusForPaymentIntentEvent,
};
