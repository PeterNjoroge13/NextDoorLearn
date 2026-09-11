const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireVerifiedEmail } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { isTimeRangeWithinAvailability } = require('../utils/availability');
const { syncSessionToGoogle } = require('../services/googleCalendar');
const { usersAreBlocked } = require('../services/safety');
const { scheduleSessionReminders } = require('../services/reminders');
const { isPositiveInteger, isValidDate, isValidTime, sanitizeText } = require('../utils/validation');

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail);

const getSessionWithOutcome = (sessionId) => db.prepare(`
  SELECT s.*, student.name AS student_name, student.email AS student_email,
    tutor.name AS tutor_name, tutor.email AS tutor_email,
    outcome.tutor_summary, outcome.skills_practiced, outcome.next_steps,
    outcome.student_reflection, outcome.confidence_before, outcome.confidence_after,
    outcome.tutor_submitted_at, outcome.student_submitted_at
  FROM sessions s
  JOIN users student ON student.id = s.student_id
  JOIN users tutor ON tutor.id = s.tutor_id
  LEFT JOIN session_outcomes outcome ON outcome.session_id = s.id
  WHERE s.id = ?
`).get(sessionId);

const hidePrivateOutcomeFields = (session, role) => {
  if (!session || role === 'student') return session;
  const safeSession = { ...session };
  delete safeSession.student_reflection;
  delete safeSession.confidence_before;
  delete safeSession.confidence_after;
  delete safeSession.student_submitted_at;
  return safeSession;
};

// Get all sessions for a user (tutor or student)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, month, year } = req.query;
    
    let query = `
      SELECT 
        s.*,
        u1.name as tutor_name,
        u1.email as tutor_email,
        u2.name as student_name,
        u2.email as student_email,
        c.status as connection_status,
        outcome.tutor_summary,
        outcome.skills_practiced,
        outcome.next_steps,
        outcome.student_reflection,
        outcome.confidence_before,
        outcome.confidence_after,
        outcome.tutor_submitted_at,
        outcome.student_submitted_at,
        review.id as review_id,
        review.rating as review_rating,
        review.comment as review_comment
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      JOIN connections c ON s.connection_id = c.id
      LEFT JOIN session_outcomes outcome ON outcome.session_id = s.id
      LEFT JOIN reviews review ON review.student_id = s.student_id AND review.tutor_id = s.tutor_id
      WHERE (s.tutor_id = ? OR s.student_id = ?)
    `;
    
    const params = [userId, userId];
    
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    
    if (month && year) {
      query += ' AND strftime(\'%m\', s.scheduled_date) = ? AND strftime(\'%Y\', s.scheduled_date) = ?';
      params.push(month.toString().padStart(2, '0'), year.toString());
    }
    
    query += ' ORDER BY s.scheduled_date DESC, s.start_time DESC';
    
    const sessions = await db.prepare(query).all(...params);
    res.json(sessions.map((session) => hidePrivateOutcomeFields(session, req.user.role)));
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get upcoming sessions for a user
router.get('/upcoming', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;
    
    const sessions = await db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE (s.tutor_id = ? OR s.student_id = ?)
        AND s.status = 'scheduled'
        AND s.confirmation_status = 'confirmed'
        AND (s.scheduled_date > date('now') OR (s.scheduled_date = date('now') AND s.start_time > time('now')))
      ORDER BY s.scheduled_date ASC, s.start_time ASC
      LIMIT ?
    `).all(userId, userId, parseInt(limit));
    
    res.json(sessions);
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/outcome', async (req, res) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid session ID is required' });
    const session = await getSessionWithOutcome(req.params.id);
    if (!session || ![Number(session.student_id), Number(session.tutor_id)].includes(Number(req.user.userId))) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(hidePrivateOutcomeFields(session, req.user.role));
  } catch (error) {
    console.error('Get session outcome error:', error);
    res.status(500).json({ error: 'Unable to load session outcome' });
  }
});

router.patch('/:id/outcome', async (req, res) => {
  try {
    const sessionId = req.params.id;
    if (!isPositiveInteger(sessionId)) return res.status(400).json({ error: 'Valid session ID is required' });
    const session = await getSessionWithOutcome(sessionId);
    if (!session || ![Number(session.student_id), Number(session.tutor_id)].includes(Number(req.user.userId))) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.confirmation_status !== 'confirmed') {
      return res.status(409).json({ error: 'This session must be confirmed before recording an outcome' });
    }
    if (session.status === 'cancelled') {
      return res.status(409).json({ error: 'Cancelled sessions cannot have outcomes' });
    }

    if (req.user.role === 'tutor') {
      if (Number(session.tutor_id) !== Number(req.user.userId)) return res.status(403).json({ error: 'Only the assigned tutor can record this outcome' });
      const attendance = sanitizeText(req.body.attendance, 20);
      const tutorSummary = sanitizeText(req.body.tutorSummary, 2000);
      const skillsPracticed = sanitizeText(req.body.skillsPracticed, 800);
      const nextSteps = sanitizeText(req.body.nextSteps, 1200);
      if (!['completed', 'no_show'].includes(attendance)) return res.status(400).json({ error: 'Choose completed or no-show attendance' });
      if (session.starts_at && new Date(session.starts_at).getTime() > Date.now() + 5 * 60 * 1000) {
        return res.status(409).json({ error: 'Session outcomes can be recorded once the session begins' });
      }
      if (attendance === 'completed' && !tutorSummary && !skillsPracticed && !nextSteps) {
        return res.status(400).json({ error: 'Add a short session summary, skill, or next step' });
      }

      await db.withTransaction(async (transaction) => {
        await transaction.prepare(`
          INSERT INTO session_outcomes (session_id, tutor_summary, skills_practiced, next_steps, tutor_submitted_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(session_id) DO UPDATE SET
            tutor_summary = excluded.tutor_summary,
            skills_practiced = excluded.skills_practiced,
            next_steps = excluded.next_steps,
            tutor_submitted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `).run(sessionId, tutorSummary || null, skillsPracticed || null, nextSteps || null);
        await transaction.prepare(`
          UPDATE sessions SET status = ?, notes = ?, completed_at = ?, completed_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(attendance, tutorSummary || session.notes || null, attendance === 'completed' ? new Date().toISOString() : null, req.user.userId, sessionId);
        await transaction.prepare("UPDATE session_reminders SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'").run(sessionId);
      });

      await createNotification(
        session.student_id,
        'session_outcome',
        attendance === 'completed' ? 'Session notes are ready' : 'Session marked as no-show',
        attendance === 'completed' ? `${session.tutor_name} added notes and next steps for "${session.title}".` : `Your session "${session.title}" was marked as a no-show.`,
        '/sessions', sessionId
      );
    } else {
      if (Number(session.student_id) !== Number(req.user.userId)) return res.status(403).json({ error: 'Only the assigned student can add this reflection' });
      if (session.status !== 'completed') return res.status(409).json({ error: 'You can reflect after the tutor completes this session' });
      const studentReflection = sanitizeText(req.body.studentReflection, 1600);
      const confidenceBefore = Number(req.body.confidenceBefore);
      const confidenceAfter = Number(req.body.confidenceAfter);
      if (!studentReflection) return res.status(400).json({ error: 'Add a short reflection before saving' });
      if (![confidenceBefore, confidenceAfter].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) {
        return res.status(400).json({ error: 'Confidence ratings must be between 1 and 5' });
      }
      await db.prepare(`
        INSERT INTO session_outcomes (session_id, student_reflection, confidence_before, confidence_after, student_submitted_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id) DO UPDATE SET
          student_reflection = excluded.student_reflection,
          confidence_before = excluded.confidence_before,
          confidence_after = excluded.confidence_after,
          student_submitted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `).run(sessionId, studentReflection, confidenceBefore, confidenceAfter);
    }

    const updatedSession = await getSessionWithOutcome(sessionId);
    res.json(hidePrivateOutcomeFields(updatedSession, req.user.role));
  } catch (error) {
    console.error('Update session outcome error:', error);
    res.status(500).json({ error: 'Unable to save session outcome' });
  }
});

// Create a new session
router.post('/', async (req, res) => {
  try {
    const {
      connectionId,
      title,
      description,
      subject,
      scheduledDate,
      startTime,
      endTime,
      meetingLink
    } = req.body;
    
    const userId = req.user.userId;
    
    // Validate required fields
    if (!isPositiveInteger(connectionId) || !sanitizeText(title, 120) || !isValidDate(scheduledDate) || !isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const safeTitle = sanitizeText(title, 120);
    const safeDescription = sanitizeText(description, 2000);
    const safeSubject = sanitizeText(subject, 120);
    const safeMeetingLink = sanitizeText(meetingLink, 500);
    
    // Verify the connection exists and user is part of it
    const connection = await db.prepare(`
      SELECT * FROM connections 
      WHERE id = ? AND (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(connectionId, userId, userId);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found or not accepted' });
    }
    if (await usersAreBlocked(connection.student_id, connection.tutor_id)) {
      return res.status(403).json({ error: 'Scheduling is unavailable for this connection' });
    }
    
    // Calculate duration
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    
    if (durationMinutes <= 0) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const isInAvailability = await isTimeRangeWithinAvailability(
      connection.tutor_id,
      scheduledDate,
      startTime,
      endTime
    );

    if (!isInAvailability) {
      return res.status(400).json({
        error: 'Selected time is outside tutor availability for that day'
      });
    }
    
    const confirmationStatus = userId === connection.tutor_id ? 'confirmed' : 'pending';
    const result = await db.withTransaction(async (transaction) => {
      if (transaction.dialect === 'postgres') {
        await transaction.prepare('SELECT pg_advisory_xact_lock(?)').get(Number(connection.tutor_id));
      }
      const conflict = await transaction.prepare(`
        SELECT id FROM sessions
        WHERE (tutor_id = ? OR student_id = ?) AND scheduled_date = ? AND status = 'scheduled'
          AND start_time < ? AND end_time > ?
        LIMIT 1
      `).get(connection.tutor_id, connection.student_id, scheduledDate, endTime, startTime);
      if (conflict) throw Object.assign(new Error('Time conflict: Another session is scheduled at this time'), { statusCode: 409 });
      return transaction.prepare(`
        INSERT INTO sessions (
          connection_id, tutor_id, student_id, title, description, subject,
          scheduled_date, start_time, end_time, duration_minutes, meeting_link,
          requested_by, confirmation_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        connectionId, connection.tutor_id, connection.student_id, safeTitle, safeDescription,
        safeSubject, scheduledDate, startTime, endTime, durationMinutes, safeMeetingLink,
        userId, confirmationStatus
      );
    });
    
    // Get the created session with user details
    const newSession = await db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    await scheduleSessionReminders(newSession).catch((error) => console.error('Unable to schedule session reminders:', error));

    // Notify the other participant
    const recipientId = userId === connection.tutor_id ? connection.student_id : connection.tutor_id;
    const creatorName = userId === connection.tutor_id ? newSession.tutor_name : newSession.student_name;
    
    await createNotification(
      recipientId,
      'session_created',
      confirmationStatus === 'pending' ? 'New session request' : 'New session scheduled',
      `${creatorName} ${confirmationStatus === 'pending' ? 'requested' : 'scheduled'} a session: "${safeTitle}" on ${scheduledDate} at ${startTime}`,
      '/sessions',
      result.lastInsertRowid
    );

    if (confirmationStatus === 'confirmed') await syncSessionToGoogle(newSession, 'upsert');
    
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
});

router.patch('/:id/confirmation', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const decision = sanitizeText(req.body.decision, 20);
    if (!isPositiveInteger(sessionId) || !['confirmed', 'declined'].includes(decision)) {
      return res.status(400).json({ error: 'A valid session and decision are required' });
    }
    const session = await db.prepare(`
      SELECT s.*, student.name AS student_name, tutor.name AS tutor_name
      FROM sessions s JOIN users student ON student.id = s.student_id JOIN users tutor ON tutor.id = s.tutor_id
      WHERE s.id = ? AND s.tutor_id = ? AND s.confirmation_status = 'pending'
    `).get(sessionId, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pending session request not found' });
    await db.prepare(`
      UPDATE sessions SET confirmation_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(decision, decision === 'declined' ? 'cancelled' : 'scheduled', sessionId);
    if (decision === 'declined') {
      await db.prepare("UPDATE session_reminders SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'").run(sessionId);
    } else {
      await syncSessionToGoogle({ ...session, confirmation_status: decision }, 'upsert');
    }
    await createNotification(
      session.student_id,
      'session_confirmation',
      decision === 'confirmed' ? 'Session confirmed' : 'Session declined',
      `${session.tutor_name} ${decision} your session request for "${session.title}".`,
      '/sessions', sessionId
    );
    res.json(await db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId));
  } catch (error) {
    console.error('Session confirmation error:', error);
    res.status(500).json({ error: 'Unable to update session request' });
  }
});

// Update session status
router.patch('/:id/status', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { status, notes } = req.body;
    const userId = req.user.userId;
    
    if (!isPositiveInteger(sessionId)) {
      return res.status(400).json({ error: 'Valid session ID is required' });
    }

    if (!['scheduled', 'completed', 'cancelled', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Verify user can update this session
    const session = await db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND (tutor_id = ? OR student_id = ?)
    `).get(sessionId, userId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.confirmation_status === 'pending' && status !== 'cancelled') {
      return res.status(409).json({ error: 'The tutor must confirm this session request first' });
    }
    if (['completed', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'Tutors must record a session outcome to use this status' });
    }
    
    // Update session
    const updateSession = await db.prepare(`
      UPDATE sessions 
      SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    await updateSession.run(status, sanitizeText(notes, 2000) || session.notes, sessionId);
    
    // Get updated session
    const updatedSession = await db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE s.id = ?
    `).get(sessionId);

    // Notify the other participant
    const recipientId = userId === session.tutor_id ? session.student_id : session.tutor_id;
    const updaterName = userId === session.tutor_id ? updatedSession.tutor_name : updatedSession.student_name;
    
    const statusMessages = {
      'completed': `Your session "${session.title}" has been marked as completed`,
      'cancelled': `${updaterName} cancelled the session "${session.title}"`,
      'no_show': `The session "${session.title}" was marked as no-show`,
      'scheduled': `The session "${session.title}" has been rescheduled`
    };

    await createNotification(
      recipientId,
      'session_update',
      `Session ${status}`,
      statusMessages[status],
      '/sessions',
      sessionId
    );

    if (status === 'cancelled') {
      await db.prepare("UPDATE session_reminders SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'").run(sessionId);
      await syncSessionToGoogle(updatedSession, 'delete');
    } else {
      await syncSessionToGoogle(updatedSession, 'upsert');
    }
    
    res.json(updatedSession);
  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a session
router.delete('/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;
    
    // Verify user can delete this session
    const session = await db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND (tutor_id = ? OR student_id = ?)
    `).get(sessionId, userId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only allow deletion of scheduled sessions
    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled sessions can be deleted' });
    }
    
    // Delete session
    const deleteSession = await db.prepare('DELETE FROM sessions WHERE id = ?');
    await deleteSession.run(sessionId);

    await syncSessionToGoogle(session, 'delete');
    
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_sessions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_sessions,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show_sessions,
        SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END) as total_minutes_taught,
        SUM(CASE WHEN outcome.tutor_submitted_at IS NOT NULL THEN 1 ELSE 0 END) as outcomes_recorded,
        SUM(CASE WHEN outcome.student_submitted_at IS NOT NULL THEN 1 ELSE 0 END) as reflections_completed,
        ROUND(AVG(CASE WHEN outcome.confidence_before IS NOT NULL AND outcome.confidence_after IS NOT NULL
          THEN outcome.confidence_after - outcome.confidence_before END), 1) as average_confidence_gain
      FROM sessions s
      LEFT JOIN session_outcomes outcome ON outcome.session_id = s.id
      WHERE s.tutor_id = ? OR s.student_id = ?
    `).get(userId, userId);
    
    res.json(stats);
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
