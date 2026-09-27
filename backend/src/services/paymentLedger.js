const db = require('../db/database');
const { cancelPaymentIntent, paymentsConfigured, refundPaymentIntent } = require('./payments');

const settleCancelledSessionPayment = async (sessionId) => {
  const payment = await db.prepare('SELECT * FROM session_payments WHERE session_id = ?').get(sessionId);
  if (!payment) return { status: 'not_required' };
  if (payment.status === 'refunded') return { status: 'refunded' };
  if (!payment.provider_payment_intent_id) {
    await db.prepare(`
      UPDATE session_payments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(payment.id);
    return { status: 'cancelled' };
  }
  if (!paymentsConfigured()) {
    const error = new Error('Payments are not configured; provider cancellation is still required');
    error.code = 'provider_unconfigured';
    error.statusCode = 503;
    throw error;
  }

  try {
    if (['succeeded', 'refund_pending', 'refund_failed'].includes(payment.status)) {
      await db.prepare(`
        UPDATE session_payments SET status = 'refund_pending', failure_code = NULL, failure_message = NULL,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(payment.id);
      const refund = await refundPaymentIntent(
        payment.provider_payment_intent_id,
        `nextdoorlearn-refund-session-${sessionId}`,
        Number(payment.platform_fee_cents) > 0
      );
      const status = refund.status === 'succeeded' ? 'refunded' : 'refund_pending';
      await db.prepare(`
        UPDATE session_payments SET status = ?,
          refunded_at = CASE WHEN ? = 'refunded' THEN CURRENT_TIMESTAMP ELSE refunded_at END,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(status, status, payment.id);
      return { status };
    }

    await cancelPaymentIntent(payment.provider_payment_intent_id);
    await db.prepare(`
      UPDATE session_payments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(payment.id);
    return { status: 'cancelled' };
  } catch (error) {
    await db.prepare(`
      UPDATE session_payments SET status = 'refund_failed', failure_code = ?, failure_message = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(error.code || 'provider_error', String(error.message || 'Refund failed').slice(0, 500), payment.id);
    throw error;
  }
};

const reconcileCancelledSessionPayments = async (limit = 25) => {
  const candidates = await db.prepare(`
    SELECT payment.session_id
    FROM session_payments payment
    JOIN sessions session ON session.id = payment.session_id
    WHERE session.status = 'cancelled'
      AND payment.status NOT IN ('cancelled', 'refunded')
    ORDER BY payment.updated_at ASC, payment.id ASC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 25, 1), 100));
  const results = [];
  for (const candidate of candidates) {
    try {
      results.push({ sessionId: candidate.session_id, ...(await settleCancelledSessionPayment(candidate.session_id)) });
    } catch (error) {
      results.push({ sessionId: candidate.session_id, status: 'resolution_failed', error: error.code || 'provider_error' });
    }
  }
  return results;
};

module.exports = { reconcileCancelledSessionPayments, settleCancelledSessionPayment };
