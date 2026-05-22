const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const {
  getDayOfWeekFromDate,
  normalizeSlots,
  getAvailabilitySlots
} = require('../utils/availability');

const router = express.Router();

const requireTutorRole = (req, res) => {
  if (req.user.role !== 'tutor') {
    res.status(403).json({ error: 'Only tutors can manage availability' });
    return false;
  }
  return true;
};

router.get('/me', authenticateToken, (req, res) => {
  try {
    if (!requireTutorRole(req, res)) return;
    const slots = getAvailabilitySlots(req.user.userId);
    res.json({ slots });
  } catch (error) {
    console.error('Get my availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/me', authenticateToken, (req, res) => {
  try {
    if (!requireTutorRole(req, res)) return;

    const { slots, timezone } = req.body;
    const normalizedResult = normalizeSlots(slots, timezone);
    if (normalizedResult.error) {
      return res.status(400).json({ error: normalizedResult.error });
    }

    const normalizedSlots = normalizedResult.slots;
    const userId = req.user.userId;

    const replaceAvailability = db.transaction((rows) => {
      db.prepare('DELETE FROM tutor_availability_slots WHERE tutor_id = ?').run(userId);
      if (rows.length > 0) {
        const insert = db.prepare(`
          INSERT INTO tutor_availability_slots (tutor_id, day_of_week, start_time, end_time, timezone)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const row of rows) {
          insert.run(userId, row.dayOfWeek, row.startTime, row.endTime, row.timezone);
        }
      }
    });

    replaceAvailability(normalizedSlots);

    const freshSlots = getAvailabilitySlots(userId);
    res.json({ message: 'Availability updated successfully', slots: freshSlots });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tutor/:tutorId', authenticateToken, (req, res) => {
  try {
    const tutorId = Number(req.params.tutorId);
    const { date } = req.query;

    if (!Number.isInteger(tutorId)) {
      return res.status(400).json({ error: 'Invalid tutor id' });
    }

    const tutor = db.prepare('SELECT id, role FROM users WHERE id = ?').get(tutorId);
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ error: 'Tutor not found' });
    }

    const slots = getAvailabilitySlots(tutorId);
    if (!date) {
      return res.json({ slots });
    }

    const dayOfWeek = getDayOfWeekFromDate(date);
    const slotsForDate = slots.filter((slot) => Number(slot.dayOfWeek) === dayOfWeek);

    res.json({
      date,
      dayOfWeek,
      slots: slotsForDate
    });
  } catch (error) {
    console.error('Get tutor availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
