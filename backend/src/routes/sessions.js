const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');
const { authenticateToken, requireVerifiedEmail } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { isTimeRangeWithinAvailability } = require('../utils/availability');
const { syncSessionToGoogle } = require('../services/googleCalendar');
const { usersAreBlocked } = require('../services/safety');
const { scheduleSessionReminders, zonedTimeToUtc } = require('../services/reminders');
const { deleteZoomMeeting, getMeetingAccess, provisionZoomMeeting, zoomConfigured } = require('../services/zoom');
const { queueSessionEmails } = require('../services/sessionCommunications');
const { settleCancelledSessionPayment } = require('../services/paymentLedger');
const { boundedInteger, isPositiveInteger, isValidDate, isValidHttpUrl, isValidTime, sanitizeText } = require('../utils/validation');

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail);

const getSessionWithOutcome = (sessionId) => db.prepare(`
  SELECT s.*, student.name AS student_name, tutor.name AS tutor_name,
    outcome.tutor_summary, outcome.skills_practiced, outcome.next_steps,
    outcome.student_reflection, outcome.confidence_before, outcome.confidence_after,
    outcome.tutor_submitted_at, outcome.student_submitted_at,
    meeting.provider AS meeting_provider, meeting.status AS meeting_status
    , payment.status AS payment_status, payment.amount_cents AS payment_amount_cents
  FROM sessions s
  JOIN users student ON student.id = s.student_id
  JOIN users tutor ON tutor.id = s.tutor_id
  LEFT JOIN session_outcomes outcome ON outcome.session_id = s.id
  LEFT JOIN session_meetings meeting ON meeting.session_id = s.id
  LEFT JOIN session_payments payment ON payment.session_id = s.id
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

const sessionState = (session) => session.confirmation_status === 'pending'
  ? 'pending_confirmation'
  : session.status;

const dateOnly = (value) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value || '').slice(0, 10);

const addDays = (date, days) => {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const recordSessionEvent = async (database, sessionId, actorUserId, eventType, fromState, toState, details = {}) => {
  await database.prepare(`
    INSERT INTO session_events (session_id, actor_user_id, event_type, from_state, to_state, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, actorUserId || null, eventType, fromState || null, toState || null, JSON.stringify(details));
};

const getScheduleDetails = async ({ tutorId, scheduledDate, startTime, endTime }) => {
  if (!isValidDate(scheduledDate) || !isValidTime(startTime) || !isValidTime(endTime)) {
    throw Object.assign(new Error('Choose a valid date, start time, and end time'), { statusCode: 400 });
  }
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const durationMinutes = Math.round((end - start) / (1000 * 60));
  if (durationMinutes < 15 || durationMinutes > 240) {
    throw Object.assign(new Error('Sessions must be between 15 minutes and 4 hours'), { statusCode: 400 });
  }

  const tutorSettings = await db.prepare('SELECT timezone FROM users WHERE id = ?').get(tutorId);
  const timezone = tutorSettings?.timezone || 'UTC';
  const startsAt = zonedTimeToUtc(scheduledDate, startTime, timezone);
  if (process.env.NODE_ENV !== 'test' && startsAt.getTime() < Date.now() + 5 * 60 * 1000) {
    throw Object.assign(new Error('Sessions must begin at least 5 minutes in the future'), { statusCode: 400 });
  }
  if (!(await isTimeRangeWithinAvailability(tutorId, scheduledDate, startTime, endTime))) {
    throw Object.assign(new Error('Selected time is outside tutor availability for that day'), { statusCode: 400 });
  }
  return { durationMinutes, timezone, startsAt };
};

const assertNoScheduleConflict = async (database, { tutorId, studentId, scheduledDate, startTime, endTime, excludeSessionId = null }) => {
  if (database.dialect === 'postgres') {
    await database.prepare('SELECT pg_advisory_xact_lock(?)').get(Number(tutorId));
  }
  const conflict = await database.prepare(`
    SELECT id FROM sessions
    WHERE (tutor_id = ? OR student_id = ?) AND scheduled_date = ? AND status = 'scheduled'
      AND start_time < ? AND end_time > ? AND id <> COALESCE(?, -1)
    LIMIT 1
  `).get(tutorId, studentId, scheduledDate, endTime, startTime, excludeSessionId);
  if (conflict) {
    throw Object.assign(new Error('Time conflict: Another session is scheduled at this time'), { statusCode: 409 });
  }
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
        u2.name as student_name,
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
        review.comment as review_comment,
        meeting.provider as meeting_provider,
        meeting.status as meeting_status,
        payment.status as payment_status,
        payment.amount_cents as payment_amount_cents
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      JOIN connections c ON s.connection_id = c.id
      LEFT JOIN session_outcomes outcome ON outcome.session_id = s.id
      LEFT JOIN reviews review ON review.student_id = s.student_id AND review.tutor_id = s.tutor_id
      LEFT JOIN session_meetings meeting ON meeting.session_id = s.id
      LEFT JOIN session_payments payment ON payment.session_id = s.id
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
    const limit = boundedInteger(req.query.limit, { min: 1, max: 50, fallback: 5 });
    
    const sessions = await db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name,
        meeting.provider as meeting_provider,
        meeting.status as meeting_status
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      LEFT JOIN session_meetings meeting ON meeting.session_id = s.id
      WHERE (s.tutor_id = ? OR s.student_id = ?)
        AND s.status = 'scheduled'
        AND s.confirmation_status = 'confirmed'
        AND (s.scheduled_date > date('now') OR (s.scheduled_date = date('now') AND s.start_time > time('now')))
      ORDER BY s.scheduled_date ASC, s.start_time ASC
      LIMIT ?
    `).all(userId, userId, limit);
    
    res.json(sessions);
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/meeting', async (req, res) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid session ID is required' });
    const session = await db.prepare(`
      SELECT * FROM sessions WHERE id = ? AND (student_id = ? OR tutor_id = ?)
    `).get(req.params.id, req.user.userId, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'scheduled' || session.confirmation_status !== 'confirmed') {
      return res.status(409).json({ error: 'The session must be confirmed before opening its meeting room' });
    }
    res.json(await getMeetingAccess(session, req.user));
  } catch (error) {
    console.error('Get meeting access error:', error);
    res.status(503).json({ error: 'The meeting room is temporarily unavailable. Please try again shortly.' });
  }
});

router.post('/:id/meeting', async (req, res) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid session ID is required' });
    const session = await db.prepare(`
      SELECT * FROM sessions WHERE id = ? AND tutor_id = ?
    `).get(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'scheduled' || session.confirmation_status !== 'confirmed') {
      return res.status(409).json({ error: 'Confirm this session before creating its meeting room' });
    }
    if (session.meeting_link) return res.json(await getMeetingAccess(session, req.user));
    if (!zoomConfigured()) return res.status(503).json({ error: 'Managed Zoom meetings are not configured yet' });
    const provisioned = await provisionZoomMeeting(session, { force: true });
    res.json(await getMeetingAccess(provisioned, req.user));
  } catch (error) {
    console.error('Retry meeting creation error:', error);
    res.status(503).json({ error: 'The Zoom room could not be created. Check the Zoom connection and try again.' });
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid session ID is required' });
    const session = await db.prepare(`
      SELECT id FROM sessions WHERE id = ? AND (student_id = ? OR tutor_id = ?)
    `).get(req.params.id, req.user.userId, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const events = await db.prepare(`
      SELECT event_type, from_state, to_state, details, created_at
      FROM session_events WHERE session_id = ? ORDER BY created_at ASC, id ASC
    `).all(req.params.id);
    res.json(events.map((event) => {
      try {
        return { ...event, details: event.details ? JSON.parse(event.details) : {} };
      } catch {
        return { ...event, details: {} };
      }
    }));
  } catch (error) {
    console.error('Get session events error:', error);
    res.status(500).json({ error: 'Unable to load session history' });
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
        await recordSessionEvent(
          transaction, sessionId, req.user.userId, 'outcome_recorded', sessionState(session), attendance,
          { attendance, hasSummary: Boolean(tutorSummary), hasNextSteps: Boolean(nextSteps) }
        );
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
      await recordSessionEvent(
        db, sessionId, req.user.userId, 'student_reflection_added', 'completed', 'completed',
        { confidenceBefore, confidenceAfter }
      );
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
      meetingLink,
      recurrenceCount: requestedRecurrenceCount = 1,
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
    const recurrenceCount = Number(requestedRecurrenceCount);
    if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 12) {
      return res.status(400).json({ error: 'Weekly session series must contain between 1 and 12 sessions' });
    }
    if (safeMeetingLink && (!isValidHttpUrl(safeMeetingLink) || !safeMeetingLink.toLowerCase().startsWith('https://'))) {
      return res.status(400).json({ error: 'Meeting link must be a secure https:// URL' });
    }
    
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
    if (safeMeetingLink && Number(userId) !== Number(connection.tutor_id)) {
      return res.status(403).json({ error: 'Only the tutor can provide a custom meeting link' });
    }
    if (recurrenceCount > 1 && Number(userId) !== Number(connection.tutor_id)) {
      return res.status(403).json({ error: 'Tutors can create recurring series after agreeing on a weekly time with the student' });
    }

    const schedule = [];
    for (let index = 0; index < recurrenceCount; index += 1) {
      const occurrenceDate = addDays(scheduledDate, index * 7);
      const details = await getScheduleDetails({
        tutorId: connection.tutor_id, scheduledDate: occurrenceDate, startTime, endTime
      });
      schedule.push({
        scheduledDate: occurrenceDate,
        ...details,
        endsAt: new Date(details.startsAt.getTime() + details.durationMinutes * 60 * 1000),
      });
    }
    const tutorProfile = await db.prepare('SELECT hourly_rate FROM tutor_profiles WHERE user_id = ?').get(connection.tutor_id);
    const agreedHourlyRateCents = Math.round(Math.max(0, Math.min(25, Number(tutorProfile?.hourly_rate) || 0)) * 100);

    const confirmationStatus = userId === connection.tutor_id ? 'confirmed' : 'pending';
    const seriesId = recurrenceCount > 1 ? randomUUID() : null;
    const sessionIds = await db.withTransaction(async (transaction) => {
      const ids = [];
      for (let index = 0; index < schedule.length; index += 1) {
        const occurrence = schedule[index];
        await assertNoScheduleConflict(transaction, {
          tutorId: connection.tutor_id, studentId: connection.student_id,
          scheduledDate: occurrence.scheduledDate, startTime, endTime
        });
        const insertResult = await transaction.prepare(`
          INSERT INTO sessions (
            connection_id, tutor_id, student_id, title, description, subject,
            scheduled_date, start_time, end_time, session_timezone, duration_minutes, meeting_link,
            requested_by, confirmation_status, starts_at, ends_at, agreed_hourly_rate_cents,
            series_id, series_index, series_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          connectionId, connection.tutor_id, connection.student_id, safeTitle, safeDescription,
          safeSubject, occurrence.scheduledDate, startTime, endTime, occurrence.timezone,
          occurrence.durationMinutes, safeMeetingLink, userId, confirmationStatus,
          occurrence.startsAt.toISOString(), occurrence.endsAt.toISOString(), agreedHourlyRateCents,
          seriesId, seriesId ? index + 1 : null, seriesId ? recurrenceCount : null
        );
        ids.push(insertResult.lastInsertRowid);
        await recordSessionEvent(
          transaction, insertResult.lastInsertRowid, userId, 'created', null,
          confirmationStatus === 'pending' ? 'pending_confirmation' : 'scheduled',
          { scheduledDate: occurrence.scheduledDate, startTime, endTime, seriesId, seriesIndex: seriesId ? index + 1 : null }
        );
      }
      return ids;
    });

    const createdSessions = [];
    for (const sessionId of sessionIds) {
      let createdSession = await db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE s.id = ?
      `).get(sessionId);

      await scheduleSessionReminders(createdSession).catch((error) => console.error('Unable to schedule session reminders:', error));
      if (confirmationStatus === 'confirmed' && !createdSession.meeting_link) {
        try {
          createdSession = await provisionZoomMeeting(createdSession);
        } catch (error) {
          console.error('Zoom meeting provisioning warning:', error.message || error);
          createdSession = { ...createdSession, meeting_provider: 'zoom', meeting_status: 'error' };
        }
      }
      if (confirmationStatus === 'confirmed') await syncSessionToGoogle(createdSession, 'upsert');
      await queueSessionEmails(createdSession, confirmationStatus === 'confirmed' ? 'confirmed' : 'requested')
        .catch((error) => console.error('Session email warning:', error.message || error));
      createdSessions.push(createdSession);
    }

    const recipientId = userId === connection.tutor_id ? connection.student_id : connection.tutor_id;
    const creatorName = userId === connection.tutor_id ? createdSessions[0].tutor_name : createdSessions[0].student_name;
    const seriesLabel = recurrenceCount > 1 ? `${recurrenceCount} weekly sessions beginning` : 'a session on';
    await createNotification(
      recipientId,
      'session_created',
      confirmationStatus === 'pending' ? 'New session request' : recurrenceCount > 1 ? 'New weekly session series' : 'New session scheduled',
      `${creatorName} ${confirmationStatus === 'pending' ? 'requested' : 'scheduled'} ${seriesLabel} ${scheduledDate} at ${startTime}: "${safeTitle}"`,
      '/sessions',
      sessionIds[0]
    );

    res.status(201).json({
      ...createdSessions[0],
      series_sessions: recurrenceCount > 1 ? createdSessions : undefined,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
});

router.patch('/:id/reschedule', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;
    const { scheduledDate, startTime, endTime } = req.body;
    const reason = sanitizeText(req.body.reason, 500);
    if (!isPositiveInteger(sessionId)) {
      return res.status(400).json({ error: 'Valid session ID is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Add a short reason for the schedule change' });
    }

    const session = await db.prepare(`
      SELECT s.*, student.name AS student_name, tutor.name AS tutor_name, c.status AS connection_status
      FROM sessions s
      JOIN users student ON student.id = s.student_id
      JOIN users tutor ON tutor.id = s.tutor_id
      JOIN connections c ON c.id = s.connection_id
      WHERE s.id = ? AND (s.student_id = ? OR s.tutor_id = ?)
    `).get(sessionId, userId, userId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.connection_status !== 'accepted' || await usersAreBlocked(session.student_id, session.tutor_id)) {
      return res.status(403).json({ error: 'Scheduling is unavailable for this connection' });
    }
    if (session.status !== 'scheduled') {
      return res.status(409).json({ error: 'Only active sessions can be rescheduled' });
    }
    if (dateOnly(session.scheduled_date) === scheduledDate && String(session.start_time).slice(0, 5) === startTime && String(session.end_time).slice(0, 5) === endTime) {
      return res.status(400).json({ error: 'Choose a different date or time' });
    }

    const { durationMinutes, timezone, startsAt } = await getScheduleDetails({
      tutorId: session.tutor_id, scheduledDate, startTime, endTime
    });
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const startedPayment = await db.prepare(`
      SELECT id, status FROM session_payments
      WHERE session_id = ? AND provider_payment_intent_id IS NOT NULL
        AND status NOT IN ('cancelled', 'refunded')
    `).get(sessionId);
    if (startedPayment && Number(durationMinutes) !== Number(session.duration_minutes)) {
      return res.status(409).json({ error: 'Once checkout has started, a session can move to a new time but its duration cannot change. Cancel it for a refund or payment cancellation, then create a new session.' });
    }
    const confirmationStatus = Number(userId) === Number(session.tutor_id) ? 'confirmed' : 'pending';

    await db.withTransaction(async (transaction) => {
      await assertNoScheduleConflict(transaction, {
        tutorId: session.tutor_id, studentId: session.student_id,
        scheduledDate, startTime, endTime, excludeSessionId: sessionId
      });
      await transaction.prepare(`
        UPDATE sessions SET scheduled_date = ?, start_time = ?, end_time = ?, session_timezone = ?, duration_minutes = ?,
          requested_by = ?, confirmation_status = ?, reschedule_count = COALESCE(reschedule_count, 0) + 1,
          last_rescheduled_at = CURRENT_TIMESTAMP, starts_at = ?, ends_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(scheduledDate, startTime, endTime, timezone, durationMinutes, userId, confirmationStatus, startsAt.toISOString(), endsAt.toISOString(), sessionId);
      await transaction.prepare("UPDATE session_reminders SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'").run(sessionId);
      await recordSessionEvent(
        transaction, sessionId, userId, 'rescheduled', sessionState(session),
        confirmationStatus === 'pending' ? 'pending_confirmation' : 'scheduled',
        {
          reason,
          previous: { scheduledDate: dateOnly(session.scheduled_date), startTime: String(session.start_time).slice(0, 5), endTime: String(session.end_time).slice(0, 5) },
          next: { scheduledDate, startTime, endTime }
        }
      );
    });

    await syncSessionToGoogle(session, 'delete');
    await deleteZoomMeeting(session).catch((error) => console.error('Zoom meeting reschedule warning:', error.message || error));

    let updatedSession = await getSessionWithOutcome(sessionId);
    await scheduleSessionReminders(updatedSession).catch((error) => console.error('Unable to refresh session reminders:', error));
    updatedSession = await getSessionWithOutcome(sessionId);
    if (confirmationStatus === 'confirmed' && !updatedSession.meeting_link) {
      try {
        updatedSession = await provisionZoomMeeting(updatedSession);
      } catch (error) {
        console.error('Zoom meeting provisioning warning:', error.message || error);
        updatedSession = { ...updatedSession, meeting_provider: 'zoom', meeting_status: 'error' };
      }
      await syncSessionToGoogle(updatedSession, 'upsert');
    }

    const recipientId = Number(userId) === Number(session.tutor_id) ? session.student_id : session.tutor_id;
    const actorName = Number(userId) === Number(session.tutor_id) ? session.tutor_name : session.student_name;
    await createNotification(
      recipientId,
      'session_rescheduled',
      confirmationStatus === 'pending' ? 'New time needs confirmation' : 'Session rescheduled',
      `${actorName} moved "${session.title}" to ${scheduledDate} at ${startTime}. Reason: ${reason}`,
      '/sessions', sessionId
    );
    await queueSessionEmails(updatedSession, confirmationStatus === 'pending' ? 'reschedule_requested' : 'rescheduled')
      .catch((error) => console.error('Session email warning:', error.message || error));

    res.json(await getSessionWithOutcome(sessionId));
  } catch (error) {
    console.error('Reschedule session error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to reschedule session' });
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
    if (decision === 'confirmed') {
      await getScheduleDetails({
        tutorId: session.tutor_id,
        scheduledDate: dateOnly(session.scheduled_date),
        startTime: String(session.start_time).slice(0, 5),
        endTime: String(session.end_time).slice(0, 5)
      });
    }
    await db.withTransaction(async (transaction) => {
      if (decision === 'confirmed') {
        await assertNoScheduleConflict(transaction, {
          tutorId: session.tutor_id,
          studentId: session.student_id,
          scheduledDate: dateOnly(session.scheduled_date),
          startTime: String(session.start_time).slice(0, 5),
          endTime: String(session.end_time).slice(0, 5),
          excludeSessionId: sessionId
        });
      }
      await transaction.prepare(`
        UPDATE sessions SET confirmation_status = ?, status = ?,
          cancelled_by = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(
        decision,
        decision === 'declined' ? 'cancelled' : 'scheduled',
        decision === 'declined' ? req.user.userId : null,
        decision === 'declined' ? 'Tutor declined the requested time' : null,
        sessionId
      );
      await recordSessionEvent(
        transaction, sessionId, req.user.userId,
        decision === 'declined' ? 'declined' : 'confirmed',
        'pending_confirmation', decision === 'declined' ? 'cancelled' : 'scheduled'
      );
    });
    let updatedSession = { ...session, confirmation_status: decision, status: decision === 'declined' ? 'cancelled' : 'scheduled' };
    if (decision === 'declined') {
      await db.prepare("UPDATE session_reminders SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'").run(sessionId);
    } else {
      if (!updatedSession.meeting_link) {
        try {
          updatedSession = await provisionZoomMeeting(updatedSession);
        } catch (error) {
          console.error('Zoom meeting provisioning warning:', error.message || error);
          updatedSession = { ...updatedSession, meeting_provider: 'zoom', meeting_status: 'error' };
        }
      }
      await scheduleSessionReminders(updatedSession).catch((error) => console.error('Unable to schedule session reminders:', error));
      await syncSessionToGoogle(updatedSession, 'upsert');
    }
    await createNotification(
      session.student_id,
      'session_confirmation',
      decision === 'confirmed' ? 'Session confirmed' : 'Session declined',
      `${session.tutor_name} ${decision} your session request for "${session.title}".`,
      '/sessions', sessionId
    );
    await queueSessionEmails(updatedSession, decision)
      .catch((error) => console.error('Session email warning:', error.message || error));
    res.json(await db.prepare(`
      SELECT s.*, meeting.provider AS meeting_provider, meeting.status AS meeting_status
      FROM sessions s LEFT JOIN session_meetings meeting ON meeting.session_id = s.id
      WHERE s.id = ?
    `).get(sessionId));
  } catch (error) {
    console.error('Session confirmation error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to update session request' });
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

    if (status !== 'cancelled') {
      return res.status(400).json({ error: 'Use rescheduling or session outcomes for other status changes' });
    }
    
    // Verify user can update this session
    const session = await db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND (tutor_id = ? OR student_id = ?)
    `).get(sessionId, userId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status !== 'scheduled') {
      return res.status(409).json({ error: 'This session is already closed' });
    }
    const cancellationReason = sanitizeText(notes, 500);
    if (!cancellationReason) {
      return res.status(400).json({ error: 'Add a short cancellation reason' });
    }

    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        UPDATE sessions
        SET status = 'cancelled', notes = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cancellationReason, userId, cancellationReason, sessionId);
      await recordSessionEvent(
        transaction, sessionId, userId, 'cancelled', sessionState(session), 'cancelled',
        { reason: cancellationReason }
      );
    });
    
    // Get updated session
    let updatedSession = await db.prepare(`
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
      'cancelled': `${updaterName} cancelled the session "${session.title}"`,
    };

    await createNotification(
      recipientId,
      'session_update',
      `Session ${status}`,
      statusMessages[status],
      '/sessions',
      sessionId
    );

    await db.prepare("UPDATE session_reminders SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'").run(sessionId);
    const paymentResolution = await settleCancelledSessionPayment(sessionId).catch((error) => {
      console.error('Session payment cancellation warning:', error);
      return { status: 'refund_failed' };
    });
    await syncSessionToGoogle(updatedSession, 'delete');
    await deleteZoomMeeting(updatedSession).catch((error) => console.error('Zoom meeting deletion warning:', error.message || error));
    updatedSession = { ...updatedSession, meeting_link: null, meeting_provider: null, meeting_status: null };
    await queueSessionEmails(updatedSession, 'cancelled')
      .catch((error) => console.error('Session email warning:', error.message || error));
    
    res.json({ ...updatedSession, payment_status: paymentResolution.status });
  } catch (error) {
    console.error('Update session status error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
});

// Delete a session
router.delete('/:id', async (req, res) => {
  if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid session ID is required' });
  const session = await db.prepare(`
    SELECT id FROM sessions WHERE id = ? AND (tutor_id = ? OR student_id = ?)
  `).get(req.params.id, req.user.userId, req.user.userId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.status(405).json({ error: 'Sessions are retained for safety. Cancel the session instead.' });
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
