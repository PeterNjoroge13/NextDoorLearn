const db = require('../db/database');
const { settleCancelledSessionPayment } = require('./paymentLedger');
const { syncSessionToGoogle } = require('./googleCalendar');
const { deleteZoomMeeting } = require('./zoom');
const { createNotification } = require('../routes/notifications');

const cancelScheduledSessions = async ({ userId, counterpartUserId = null, actorUserId = null, reason }) => {
  const parameters = [userId, userId];
  let counterpartClause = '';
  if (counterpartUserId) {
    counterpartClause = 'AND (student_id = ? OR tutor_id = ?)';
    parameters.push(counterpartUserId, counterpartUserId);
  }
  const sessions = await db.prepare(`
    SELECT * FROM sessions
    WHERE status = 'scheduled' AND (student_id = ? OR tutor_id = ?)
      ${counterpartClause}
    ORDER BY starts_at ASC, id ASC
  `).all(...parameters);

  const claimed = [];
  await db.withTransaction(async (transaction) => {
    for (const session of sessions) {
      const result = await transaction.prepare(`
        UPDATE sessions SET status = 'cancelled', cancelled_by = ?, cancellation_reason = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'scheduled'
      `).run(actorUserId, reason, reason, session.id);
      if (!result.changes) continue;
      await transaction.prepare(`
        UPDATE session_reminders SET status = 'cancelled'
        WHERE session_id = ? AND status IN ('pending', 'processing')
      `).run(session.id);
      await transaction.prepare(`
        INSERT INTO session_events (session_id, actor_user_id, event_type, from_state, to_state, details)
        VALUES (?, ?, 'cancelled', ?, 'cancelled', ?)
      `).run(
        session.id,
        actorUserId,
        session.confirmation_status === 'pending' ? 'pending_confirmation' : 'scheduled',
        JSON.stringify({ reason, automated: true })
      );
      claimed.push(session);
    }
  });

  const results = [];
  for (const session of claimed) {
    let paymentStatus = 'not_required';
    try {
      paymentStatus = (await settleCancelledSessionPayment(session.id)).status;
    } catch (error) {
      paymentStatus = 'refund_failed';
      console.error('Automated session refund warning:', error.message || error);
    }
    await Promise.allSettled([
      syncSessionToGoogle(session, 'delete'),
      deleteZoomMeeting(session)
    ]);
    const counterpartId = session.student_id === userId ? session.tutor_id : session.student_id;
    if (counterpartId && counterpartId !== userId) {
      await createNotification(
        counterpartId,
        'session',
        'Session cancelled',
        'A future session was cancelled because the connection is no longer active.',
        '/sessions',
        session.id
      );
    }
    results.push({ sessionId: session.id, paymentStatus });
  }
  return results;
};

module.exports = { cancelScheduledSessions };
