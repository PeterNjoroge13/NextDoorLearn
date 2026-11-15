const Stripe = require('stripe');
const { isFeatureDisabled } = require('./featureFlags');

// Pinned so Stripe behavior only changes when we upgrade deliberately.
const STRIPE_API_VERSION = '2026-10-28.endive';
const TUTOR_ACCOUNT_INCLUDES = ['configuration.recipient', 'requirements', 'defaults'];

let stripeClient;

const paymentsConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
const webhookConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
const paymentsAvailable = () => paymentsConfigured() && !isFeatureDisabled('payments');

const getStripe = () => {
  if (!paymentsConfigured()) {
    throw Object.assign(new Error('Payments are not configured yet'), {
      statusCode: 503,
      code: 'PAYMENTS_NOT_CONFIGURED'
    });
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
};

const publicPaymentConfig = () => ({
  configured: webhookConfigured() && Boolean(process.env.STRIPE_PUBLISHABLE_KEY) && !isFeatureDisabled('payments'),
  maintenance: isFeatureDisabled('payments'),
  publishableKey: isFeatureDisabled('payments') ? null : process.env.STRIPE_PUBLISHABLE_KEY || null,
  currency: 'usd',
  provider: 'stripe'
});

// Tutors are marketplace recipients (Accounts v2): NextDoorLearn is the merchant of record,
// collects fees, owns loss liability, and tutors only receive transfers via the Express dashboard.
const createTutorAccount = ({ email, name, userId }) => getStripe().v2.core.accounts.create({
  contact_email: email,
  display_name: String(name || '').slice(0, 100) || undefined,
  dashboard: 'express',
  identity: {
    country: (process.env.STRIPE_CONNECTED_ACCOUNT_COUNTRY || 'US').toLowerCase(),
    entity_type: 'individual'
  },
  configuration: {
    recipient: {
      capabilities: { stripe_balance: { stripe_transfers: { requested: true } } }
    }
  },
  defaults: {
    currency: 'usd',
    responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    profile: {
      product_description: 'Affordable tutoring services provided through NextDoorLearn',
      business_url: `${process.env.FRONTEND_URL || 'https://nextdoorlearn.com'}/community/tutors/${userId}`
    }
  },
  include: TUTOR_ACCOUNT_INCLUDES,
  metadata: { nextdoorlearn_user_id: String(userId) }
}, { idempotencyKey: `nextdoorlearn-tutor-v2-${userId}` });

const createOnboardingLink = (accountId) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return getStripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        refresh_url: `${frontend}/profile?payments=refresh`,
        return_url: `${frontend}/profile?payments=return`,
        collection_options: { fields: 'eventually_due' }
      }
    }
  });
};

const retrieveTutorAccount = async (accountId) => {
  try {
    return await getStripe().v2.core.accounts.retrieve(accountId, { include: TUTOR_ACCOUNT_INCLUDES });
  } catch (error) {
    // Accounts created before the v2 migration can still be read through v1.
    if (error?.statusCode === 404 || error?.type === 'StripeInvalidRequestError') {
      return getStripe().accounts.retrieve(accountId);
    }
    throw error;
  }
};

// Embedded Connect components (onboarding + notification banner) for the tutor payout page.
const createTutorAccountSession = (accountId) => getStripe().accountSessions.create({
  account: accountId,
  components: {
    account_onboarding: { enabled: true, features: { external_account_collection: true } },
    notification_banner: { enabled: true, features: { external_account_collection: true } }
  }
});

const ACTIVE = 'active';
const DUE_STATUSES = new Set(['currently_due', 'past_due']);

// Normalizes a v2 (or legacy v1) account into the fields stored in tutor_payment_accounts.
// "payoutsEnabled" means the tutor can receive transfers, which is what destination charges need.
const tutorAccountState = (account = {}) => {
  if (account.object === 'v2.core.account' || account.configuration || account.requirements?.entries) {
    const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    const transfersActive = transfers?.status === ACTIVE;
    const entries = account.requirements?.entries || [];
    const due = entries
      .filter((entry) => DUE_STATUSES.has(entry?.minimum_deadline?.status))
      .map((entry) => entry.description)
      .filter(Boolean);
    const detailsSubmitted = due.length === 0 && Boolean(transfers);
    const blocked = ['restricted', 'rejected', 'unsupported'].includes(transfers?.status);
    return {
      onboardingStatus: transfersActive ? 'active' : (detailsSubmitted || blocked) ? 'restricted' : 'pending',
      chargesEnabled: transfersActive,
      payoutsEnabled: transfersActive,
      detailsSubmitted,
      requirementsDue: [...new Set(due)]
    };
  }
  const requirements = account.requirements || {};
  const due = [...(requirements.currently_due || []), ...(requirements.past_due || [])];
  return {
    onboardingStatus: account.payouts_enabled && account.details_submitted ? 'active' : account.details_submitted ? 'restricted' : 'pending',
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsDue: [...new Set(due)]
  };
};

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
  STRIPE_API_VERSION,
  cancelPaymentIntent,
  createTutorAccountSession,
  tutorAccountState,
  constructWebhookEvent,
  createDashboardLink,
  createOnboardingLink,
  createSessionPaymentIntent,
  createTutorAccount,
  paymentsConfigured,
  paymentsAvailable,
  platformFeeFor,
  publicPaymentConfig,
  refundPaymentIntent,
  retrievePaymentIntent,
  retrieveTutorAccount,
  webhookConfigured
};
