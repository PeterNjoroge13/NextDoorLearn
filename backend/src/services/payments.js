const Stripe = require('stripe');

let stripeClient;

const paymentsConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
const webhookConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

const getStripe = () => {
  if (!paymentsConfigured()) {
    throw Object.assign(new Error('Payments are not configured yet'), {
      statusCode: 503,
      code: 'PAYMENTS_NOT_CONFIGURED'
    });
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
};

const publicPaymentConfig = () => ({
  configured: webhookConfigured() && Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  currency: 'usd',
  provider: 'stripe'
});

const createTutorAccount = ({ email, name, userId }) => getStripe().accounts.create({
  country: process.env.STRIPE_CONNECTED_ACCOUNT_COUNTRY || 'US',
  email,
  business_type: 'individual',
  capabilities: { transfers: { requested: true } },
  business_profile: {
    product_description: 'Affordable tutoring services provided through NextDoorLearn',
    url: `${process.env.FRONTEND_URL || 'https://nextdoorlearn.com'}/community/tutors/${userId}`
  },
  metadata: { nextdoorlearn_user_id: String(userId), nextdoorlearn_name: String(name || '').slice(0, 100) }
}, { idempotencyKey: `nextdoorlearn-tutor-${userId}` });

const createOnboardingLink = (accountId) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${frontend}/profile?payments=refresh`,
    return_url: `${frontend}/profile?payments=return`,
    type: 'account_onboarding',
    collection_options: { fields: 'eventually_due' }
  });
};

const retrieveTutorAccount = (accountId) => getStripe().accounts.retrieve(accountId);

const createDashboardLink = (accountId) => getStripe().accounts.createLoginLink(accountId);

const platformFeeFor = (amountCents) => {
  const percentage = Math.max(0, Math.min(20, Number(process.env.STRIPE_PLATFORM_FEE_PERCENT) || 0));
  return Math.min(amountCents, Math.round(amountCents * percentage / 100));
};

const createSessionPaymentIntent = ({ paymentId, sessionId, studentId, tutorId, amountCents, destinationAccountId }) => {
  const applicationFee = platformFeeFor(amountCents);
  const params = {
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    transfer_data: { destination: destinationAccountId },
    metadata: {
      nextdoorlearn_payment_id: String(paymentId),
      nextdoorlearn_session_id: String(sessionId),
      nextdoorlearn_student_id: String(studentId),
      nextdoorlearn_tutor_id: String(tutorId)
    },
    description: `NextDoorLearn tutoring session ${sessionId}`
  };
  if (applicationFee > 0) params.application_fee_amount = applicationFee;
  return getStripe().paymentIntents.create(params, { idempotencyKey: `nextdoorlearn-session-${sessionId}` });
};

const retrievePaymentIntent = (paymentIntentId) => getStripe().paymentIntents.retrieve(paymentIntentId);

const cancelPaymentIntent = (paymentIntentId) => getStripe().paymentIntents.cancel(paymentIntentId);

const refundPaymentIntent = (paymentIntentId, idempotencyKey, refundApplicationFee = false) => {
  const params = { payment_intent: paymentIntentId, reverse_transfer: true };
  if (refundApplicationFee) params.refund_application_fee = true;
  return getStripe().refunds.create(params, { idempotencyKey });
};

const constructWebhookEvent = (rawBody, signature) => {
  if (!webhookConfigured()) {
    throw Object.assign(new Error('Payment webhooks are not configured'), { statusCode: 503 });
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
};

module.exports = {
  cancelPaymentIntent,
  constructWebhookEvent,
  createDashboardLink,
  createOnboardingLink,
  createSessionPaymentIntent,
  createTutorAccount,
  paymentsConfigured,
  platformFeeFor,
  publicPaymentConfig,
  refundPaymentIntent,
  retrievePaymentIntent,
  retrieveTutorAccount,
  webhookConfigured
};
