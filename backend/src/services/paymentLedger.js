const db = require('../db/database');
const { cancelPaymentIntent, paymentsConfigured, refundPaymentIntent } = require('./payments');

const settleCancelledSessionPayment = async (sessionId) => {
  const payment = await db.prepare('SELECT * FROM session_payments WHERE session_id = ?').get(sessionId);
  if (!payment) return { status: 'not_required' };
  if (payment.status === 'refunded') return { status: 'refunded' };
  if (!payment.provider_payment_intent_id || !paymentsConfigured()) {
    await db.prepare(`
      UPDATE session_payments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(payment.id);
    return { status: 'cancelled' };
  }

  try {
    if (payment.status === 'succeeded' || payment.status === 'refund_failed') {
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

module.exports = { settleCancelledSessionPayment };
