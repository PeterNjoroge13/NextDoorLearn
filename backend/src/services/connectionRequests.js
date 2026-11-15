const db = require('../db/database');
const { usersAreBlocked } = require('./safety');
const { createNotification } = require('../routes/notifications');

const requestError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Single implementation behind POST /requests/:id/respond (web, mobile and shipped mobile builds)
// and PUT /connections/:id/respond, so both URLs enforce blocks and notify the student.
const respondToConnectionRequest = async ({ connectionId, tutorId, accept }) => {
  const connection = await db.prepare(`
    SELECT c.id, c.student_id, c.tutor_id, u.name AS tutor_name
    FROM connections c
    JOIN users u ON u.id = c.tutor_id
    WHERE c.id = ? AND c.tutor_id = ? AND c.status = 'pending'
  `).get(connectionId, tutorId);
  if (!connection) throw requestError(404, 'Request not found or already processed');
  if (await usersAreBlocked(connection.student_id, connection.tutor_id)) {
    throw requestError(403, 'This connection is unavailable');
  }

  const status = accept ? 'accepted' : 'rejected';
  const updated = await db.prepare(`
    UPDATE connections SET status = ? WHERE id = ? AND status = 'pending'
  `).run(status, connection.id);
  if (!updated.changes) throw requestError(404, 'Request not found or already processed');

  await createNotification(
    connection.student_id,
    'connection_response',
    accept ? 'Connection accepted!' : 'Connection declined',
    accept
      ? `${connection.tutor_name} accepted your connection request. You can now message them!`
      : `${connection.tutor_name} declined your connection request.`,
    accept ? '/messages' : '/tutors',
    connection.id
  );

  return { connectionId: connection.id, studentId: connection.student_id, status };
};

module.exports = { respondToConnectionRequest };
