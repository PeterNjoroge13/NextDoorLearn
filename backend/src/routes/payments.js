const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireVerifiedEmail } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const {
  constructWebhookEvent,
  createOnboardingLink,
  createSessionPaymentIntent,
  createTutorAccount,
  paymentsConfigured,
  platformFeeFor,
  publicPaymentConfig,
  retrievePaymentIntent,
  retrieveTutorAccount
} = require('../services/payments');
const { isPositiveInteger } = require('../utils/validation');

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail);

const accountStatus = (account) => {
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

const saveAccountStatus = async (userId, account) => {
  const state = accountStatus(account);
  await db.prepare(`
    UPDATE tutor_payment_accounts
    SET onboarding_status = ?, charges_enabled = ?, payouts_enabled = ?, details_submitted = ?,
        requirements_due = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    state.onboardingStatus, Number(state.chargesEnabled), Number(state.payoutsEnabled),
    Number(state.detailsSubmitted), JSON.stringify(state.requirementsDue), userId
  );
  return state;
};

const parseRequirements = (value) => {
  try { return JSON.parse(value || '[]'); } catch { return []; }
};

const serializeAccount = (row) => row ? {
  provider: row.provider,
  onboardingStatus: row.onboarding_status,
  chargesEnabled: Boolean(row.charges_enabled),
  payoutsEnabled: Boolean(row.payouts_enabled),
  detailsSubmitted: Boolean(row.details_submitted),
  requirementsDue: parseRequirements(row.requirements_due),
  updatedAt: row.updated_at
} : {
  provider: 'stripe', onboardingStatus: 'not_started', chargesEnabled: false,
  payoutsEnabled: false, detailsSubmitted: false, requirementsDue: [], updatedAt: null
};

router.get('/config', (req, res) => res.json(publicPaymentConfig()));

router.get('/account', async (req, res) => {
  if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Tutor access is required' });
  try {
    let row = await db.prepare('SELECT * FROM tutor_payment_accounts WHERE user_id = ?').get(req.user.userId);
    if (row && paymentsConfigured()) {
      const account = await retrieveTutorAccount(row.provider_account_id);
      await saveAccountStatus(req.user.userId, account);
      row = await db.prepare('SELECT * FROM tutor_payment_accounts WHERE user_id = ?').get(req.user.userId);
    }
    res.json({ ...serializeAccount(row), configured: publicPaymentConfig().configured });
  } catch (error) {
    console.error('Payment account status error:', error);
    res.status(error.statusCode || 502).json({ error: error.statusCode ? error.message : 'Unable to load payout status' });
  }
});

router.post('/account/onboarding-link', async (req, res) => {
  if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Tutor access is required' });
  try {
    const user = await db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.userId);
    let row = await db.prepare('SELECT * FROM tutor_payment_accounts WHERE user_id = ?').get(req.user.userId);
    if (!row) {
      const account = await createTutorAccount({ email: user.email, name: user.name, userId: user.id });
      await db.prepare(`
        INSERT INTO tutor_payment_accounts (
          user_id, provider_account_id, onboarding_status, charges_enabled, payouts_enabled, details_submitted, requirements_due
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id, account.id, accountStatus(account).onboardingStatus, Number(account.charges_enabled),
        Number(account.payouts_enabled), Number(account.details_submitted),
        JSON.stringify(accountStatus(account).requirementsDue)
      );
      row = await db.prepare('SELECT * FROM tutor_payment_accounts WHERE user_id = ?').get(req.user.userId);
    }
    const link = await createOnboardingLink(row.provider_account_id);
    res.json({ url: link.url, expiresAt: link.expires_at });
  } catch (error) {
    console.error('Payment onboarding error:', error);
    res.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : 'Unable to start secure payout setup',
      code: error.code
    });
  }
});

router.get('/earnings', async (req, res) => {
  if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Tutor access is required' });
  const totals = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount_cents - platform_fee_cents ELSE 0 END), 0) AS paid_cents,
      COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount_cents - platform_fee_cents ELSE 0 END), 0) AS refunded_cents,
      COUNT(CASE WHEN status = 'succeeded' THEN 1 END) AS paid_sessions
    FROM session_payments WHERE tutor_id = ?
  `).get(req.user.userId);
  const payments = await db.prepare(`
    SELECT payment.id, payment.session_id, payment.amount_cents, payment.platform_fee_cents,
      payment.currency, payment.status, payment.paid_at, payment.refunded_at, payment.created_at,
      session.title, session.scheduled_date, student.name AS student_name
    FROM session_payments payment
    JOIN sessions session ON session.id = payment.session_id
    JOIN users student ON student.id = payment.student_id
    WHERE payment.tutor_id = ? ORDER BY payment.created_at DESC LIMIT 100
  `).all(req.user.userId);
  res.json({ totals, payments });
});

router.get('/history', async (req, res) => {
  const rows = await db.prepare(`
    SELECT session.id AS session_id, session.title, session.scheduled_date, session.start_time,
      session.duration_minutes, session.status AS session_status, session.confirmation_status,
      session.agreed_hourly_rate_cents, student.name AS student_name, tutor.name AS tutor_name,
      payment.amount_cents, payment.platform_fee_cents, payment.currency,
      payment.status AS payment_status, payment.paid_at, payment.refunded_at,
      account.payouts_enabled
    FROM sessions session
    JOIN users student ON student.id = session.student_id
    JOIN users tutor ON tutor.id = session.tutor_id
    LEFT JOIN session_payments payment ON payment.session_id = session.id
    LEFT JOIN tutor_payment_accounts account ON account.user_id = session.tutor_id
    WHERE session.student_id = ? OR session.tutor_id = ?
    ORDER BY session.scheduled_date DESC, session.start_time DESC
    LIMIT 200
  `).all(req.user.userId, req.user.userId);
  res.json(rows.map((row) => {
    const calculatedAmount = Math.round((Number(row.agreed_hourly_rate_cents) || 0) * Number(row.duration_minutes) / 60);
    return {
      ...row,
      amount_cents: row.amount_cents == null ? calculatedAmount : Number(row.amount_cents),
      currency: row.currency || 'usd',
      payment_status: row.payment_status || (calculatedAmount === 0 ? 'free' : 'unpaid'),
      payout_ready: Boolean(row.payouts_enabled),
      can_pay: req.user.role === 'student' && row.session_status === 'scheduled'
        && row.confirmation_status === 'confirmed' && calculatedAmount >= 50 && Boolean(row.payouts_enabled)
    };
  }));
});

router.get('/sessions/:sessionId', async (req, res) => {
  if (!isPositiveInteger(req.params.sessionId)) return res.status(400).json({ error: 'Valid session ID is required' });
  const session = await db.prepare(`
    SELECT session.*, tutor.name AS tutor_name, payment.id AS payment_id,
      payment.amount_cents, payment.platform_fee_cents, payment.currency, payment.status AS payment_status,
      payment.paid_at, payment.refunded_at
    FROM sessions session
    JOIN users tutor ON tutor.id = session.tutor_id
    LEFT JOIN session_payments payment ON payment.session_id = session.id
    WHERE session.id = ? AND (session.student_id = ? OR session.tutor_id = ?)
  `).get(req.params.sessionId, req.user.userId, req.user.userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const amountCents = Math.round((Number(session.agreed_hourly_rate_cents) || 0) * Number(session.duration_minutes) / 60);
  res.json({
    sessionId: session.id,
    tutorName: session.tutor_name,
    hourlyRateCents: Number(session.agreed_hourly_rate_cents) || 0,
    amountCents: session.amount_cents == null ? amountCents : Number(session.amount_cents),
    platformFeeCents: Number(session.platform_fee_cents) || 0,
    currency: session.currency || 'usd',
    status: session.payment_status || (amountCents === 0 ? 'free' : 'unpaid'),
    paidAt: session.paid_at || null,
    refundedAt: session.refunded_at || null,
    canPay: req.user.role === 'student' && Number(session.student_id) === Number(req.user.userId)
      && session.status === 'scheduled' && session.confirmation_status === 'confirmed' && amountCents >= 50,
    configured: publicPaymentConfig().configured
  });
});

router.post('/sessions/:sessionId/intent', async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only the session student can pay' });
  if (!isPositiveInteger(req.params.sessionId)) return res.status(400).json({ error: 'Valid session ID is required' });
  try {
    const session = await db.prepare(`
      SELECT session.*, account.provider_account_id, account.payouts_enabled
      FROM sessions session
      LEFT JOIN tutor_payment_accounts account ON account.user_id = session.tutor_id
      WHERE session.id = ? AND session.student_id = ?
    `).get(req.params.sessionId, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'scheduled' || session.confirmation_status !== 'confirmed') {
      return res.status(409).json({ error: 'The session must be active and confirmed before payment' });
    }
    const amountCents = Math.round((Number(session.agreed_hourly_rate_cents) || 0) * Number(session.duration_minutes) / 60);
    if (amountCents === 0) return res.status(409).json({ error: 'This is a volunteer session and does not require payment' });
    if (amountCents < 50) return res.status(409).json({ error: 'This session total is below the payment processor minimum. Ask the tutor to offer it as a free session or schedule more time.' });
    if (!session.provider_account_id || !session.payouts_enabled) {
      return res.status(409).json({ error: 'This tutor has not finished secure payout setup yet' });
    }

    let payment = await db.prepare('SELECT * FROM session_payments WHERE session_id = ?').get(session.id);
    if (payment?.status === 'succeeded') return res.status(409).json({ error: 'This session is already paid' });
    if (payment?.status === 'refunded') return res.status(409).json({ error: 'This session payment was refunded' });
    if (!payment) {
      const result = await db.prepare(`
        INSERT INTO session_payments (
          session_id, student_id, tutor_id, amount_cents, platform_fee_cents, currency, status
        ) VALUES (?, ?, ?, ?, ?, 'usd', 'pending')
      `).run(session.id, session.student_id, session.tutor_id, amountCents, platformFeeFor(amountCents));
      payment = await db.prepare('SELECT * FROM session_payments WHERE id = ?').get(result.lastInsertRowid);
    }

    let intent;
    if (payment.provider_payment_intent_id) {
      intent = await retrievePaymentIntent(payment.provider_payment_intent_id);
    } else {
      intent = await createSessionPaymentIntent({
        paymentId: payment.id, sessionId: session.id, studentId: session.student_id,
        tutorId: session.tutor_id, amountCents, destinationAccountId: session.provider_account_id
      });
      await db.prepare(`
        UPDATE session_payments SET provider_payment_intent_id = ?, platform_fee_cents = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(intent.id, platformFeeFor(amountCents), intent.status, payment.id);
    }
    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents,
      currency: 'usd',
      publishableKey: publicPaymentConfig().publishableKey
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : 'Unable to prepare payment securely',
      code: error.code
    });
  }
});

const paymentStatusForIntent = (intent) => ({
  succeeded: 'succeeded', processing: 'processing', canceled: 'cancelled',
  requires_payment_method: 'failed', requires_action: 'requires_action',
  requires_confirmation: 'requires_action', requires_capture: 'processing'
}[intent.status] || 'pending');

const handleWebhook = async (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  try {
    const exists = await db.prepare('SELECT id FROM payment_events WHERE provider_event_id = ?').get(event.id);
    if (exists) return res.json({ received: true, duplicate: true });
    const object = event.data.object;

    if (event.type === 'account.updated') {
      const row = await db.prepare('SELECT user_id FROM tutor_payment_accounts WHERE provider_account_id = ?').get(object.id);
      if (row) await saveAccountStatus(row.user_id, object);
    }

    if (event.type.startsWith('payment_intent.')) {
      const status = paymentStatusForIntent(object);
      const payment = await db.prepare('SELECT * FROM session_payments WHERE provider_payment_intent_id = ?').get(object.id);
      if (payment) {
        await db.prepare(`
          UPDATE session_payments SET status = ?, provider_charge_id = ?, failure_code = ?, failure_message = ?,
            paid_at = CASE WHEN ? = 'succeeded' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(
          status, typeof object.latest_charge === 'string' ? object.latest_charge : null,
          object.last_payment_error?.code || null, object.last_payment_error?.message || null,
          status, payment.id
        );
        if (status === 'succeeded' && payment.status !== 'succeeded') {
          await Promise.all([
            createNotification(payment.student_id, 'payment_received', 'Payment complete', 'Your tutoring session payment is confirmed.', '/sessions', payment.session_id),
            createNotification(payment.tutor_id, 'payment_received', 'Session paid', 'A student payment is on its way to your connected payout account.', '/sessions', payment.session_id)
          ]);
        }
      }
    }

    if (event.type === 'charge.refunded' && object.payment_intent) {
      await db.prepare(`
        UPDATE session_payments SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE provider_payment_intent_id = ?
      `).run(object.payment_intent);
    }

    await db.prepare(`
      INSERT INTO payment_events (provider_event_id, event_type, object_id) VALUES (?, ?, ?)
    `).run(event.id, event.type, object.id || null);
    res.json({ received: true });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Unable to process payment event' });
  }
};

module.exports = router;
module.exports.handleWebhook = handleWebhook;
