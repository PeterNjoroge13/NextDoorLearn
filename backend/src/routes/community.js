const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isValidEmail, sanitizeText } = require('../utils/validation');

const router = express.Router();

const list = (value, maxItems = 12) => {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return items.map((item) => sanitizeText(item, 80)).filter(Boolean).slice(0, maxItems);
};

router.post('/tutor-applications', (req, res) => {
  try {
    const name = sanitizeText(req.body.name, 120);
    const email = String(req.body.email || '').trim().toLowerCase();
    const subjects = list(req.body.subjects);
    const motivation = sanitizeText(req.body.motivation, 2000);

    if (!name || !isValidEmail(email) || subjects.length === 0 || !motivation) {
      return res.status(400).json({ error: 'Name, valid email, subjects, and motivation are required' });
    }

    const existing = db.prepare(`
      SELECT id FROM tutor_applications
      WHERE email = ? AND status IN ('pending', 'reviewing')
      ORDER BY created_at DESC LIMIT 1
    `).get(email);

    if (existing) {
      return res.status(409).json({ error: 'An application for this email is already under review' });
    }

    const result = db.prepare(`
      INSERT INTO tutor_applications
        (name, email, phone, location, subjects, education, experience, motivation, availability, tutoring_mode, hourly_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      email,
      sanitizeText(req.body.phone, 60),
      sanitizeText(req.body.location, 160),
      JSON.stringify(subjects),
      sanitizeText(req.body.education, 1000),
      sanitizeText(req.body.experience, 1200),
      motivation,
      sanitizeText(req.body.availability, 800),
      sanitizeText(req.body.tutoringMode, 40),
      Math.max(0, Number(req.body.hourlyRate) || 0)
    );

    res.status(201).json({
      applicationId: Number(result.lastInsertRowid),
      message: 'Application received. We will contact you after it is reviewed.'
    });
  } catch (error) {
    console.error('Tutor application error:', error);
    res.status(500).json({ error: 'Unable to submit tutor application' });
  }
});

router.post('/sponsor-inquiries', (req, res) => {
  try {
    const name = sanitizeText(req.body.name, 120);
    const email = String(req.body.email || '').trim().toLowerCase();
    const sponsorType = sanitizeText(req.body.sponsorType, 80);

    if (!name || !isValidEmail(email) || !sponsorType) {
      return res.status(400).json({ error: 'Name, valid email, and sponsorship interest are required' });
    }

    const result = db.prepare(`
      INSERT INTO sponsor_inquiries (name, email, organization, sponsor_type, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name,
      email,
      sanitizeText(req.body.organization, 160),
      sponsorType,
      sanitizeText(req.body.message, 2000)
    );

    res.status(201).json({
      inquiryId: Number(result.lastInsertRowid),
      message: 'Thank you. Your sponsorship interest has been received.'
    });
  } catch (error) {
    console.error('Sponsor inquiry error:', error);
    res.status(500).json({ error: 'Unable to submit sponsorship interest' });
  }
});

router.get('/waitlist/me', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });

  const entry = db.prepare(`
    SELECT id, subjects, grade_level, budget_preference, preferred_schedule,
           tutoring_mode, learning_goals, status, created_at, updated_at
    FROM student_waitlist_entries WHERE student_id = ?
  `).get(req.user.userId);

  if (!entry) return res.json(null);
  res.json({ ...entry, subjects: list(JSON.parse(entry.subjects || '[]')) });
});

router.put('/waitlist/me', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    const subjects = list(req.body.subjects);
    if (subjects.length === 0) return res.status(400).json({ error: 'Choose at least one subject' });

    db.prepare(`
      INSERT INTO student_waitlist_entries
        (student_id, subjects, grade_level, budget_preference, preferred_schedule, tutoring_mode, learning_goals)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        subjects = excluded.subjects,
        grade_level = excluded.grade_level,
        budget_preference = excluded.budget_preference,
        preferred_schedule = excluded.preferred_schedule,
        tutoring_mode = excluded.tutoring_mode,
        learning_goals = excluded.learning_goals,
        status = 'open',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.userId,
      JSON.stringify(subjects),
      sanitizeText(req.body.gradeLevel, 80),
      sanitizeText(req.body.budgetPreference, 80),
      sanitizeText(req.body.preferredSchedule, 500),
      sanitizeText(req.body.tutoringMode, 40),
      sanitizeText(req.body.learningGoals, 1500)
    );

    const entry = db.prepare('SELECT id, status, created_at, updated_at FROM student_waitlist_entries WHERE student_id = ?').get(req.user.userId);
    res.json({ ...entry, subjects, message: 'You are on the tutor match waitlist.' });
  } catch (error) {
    console.error('Waitlist update error:', error);
    res.status(500).json({ error: 'Unable to update waitlist' });
  }
});

router.delete('/waitlist/me', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
  db.prepare("UPDATE student_waitlist_entries SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE student_id = ?").run(req.user.userId);
  res.json({ message: 'You have left the waitlist.' });
});

module.exports = router;
