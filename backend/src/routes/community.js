const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isValidEmail, sanitizeText } = require('../utils/validation');
const { createImageUpload, detectImageMime, handleSingleImage } = require('../utils/imageUpload');
const { queueEmail } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');
const { POLICY_VERSION, validateTutorConsent } = require('../utils/policies');
const { STUDENT_BUDGETS, validateTutorRate } = require('../utils/pricing');
const { contentPolicyError, findContentPolicyViolation } = require('../services/contentModeration');

const router = express.Router();
const applicationPhotoUpload = createImageUpload({ directory: 'tutor-applications', prefix: 'tutor-application', maxSizeMb: 5 });

const list = (value, maxItems = 12) => {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return items.map((item) => sanitizeText(item, 80)).filter(Boolean).slice(0, maxItems);
};

const adminEmails = () => [...new Set((process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(isValidEmail))];

router.post('/tutor-applications', handleSingleImage(applicationPhotoUpload, 'profilePicture'), async (req, res) => {
  try {
    const name = sanitizeText(req.body.name, 120);
    const email = String(req.body.email || '').trim().toLowerCase();
    const subjects = list(req.body.subjects);
    const motivation = sanitizeText(req.body.motivation, 2000);
    const hourlyRate = validateTutorRate(req.body.hourlyRate);
    const consent = validateTutorConsent(req.body);

    if (consent.error) return res.status(400).json({ error: consent.error });
    if (hourlyRate.error) return res.status(400).json({ error: hourlyRate.error });

    if (!req.file) {
      return res.status(400).json({ error: 'A profile picture is required' });
    }

    const mimeType = detectImageMime(req.file.buffer);
    if (!mimeType) {
      return res.status(400).json({ error: 'The selected file is not a valid JPG, PNG, or WebP image' });
    }

    if (!name || !isValidEmail(email) || subjects.length === 0 || !motivation) {
      return res.status(400).json({ error: 'Name, valid email, subjects, and motivation are required' });
    }
    const policyViolation = findContentPolicyViolation(
      motivation,
      req.body.education,
      req.body.experience,
      req.body.availability
    );
    if (policyViolation) return res.status(422).json(contentPolicyError(policyViolation));

    const existing = await db.prepare(`
      SELECT id FROM tutor_applications
      WHERE email = ? AND status IN ('pending', 'reviewing')
      ORDER BY created_at DESC LIMIT 1
    `).get(email);

    if (existing) {
      return res.status(409).json({ error: 'An application for this email is already under review' });
    }

    const assetId = randomUUID();
    const profilePictureUrl = `/api/media/${assetId}`;
    const result = await db.withTransaction(async (transaction) => {
      const applicationResult = await transaction.prepare(`
        INSERT INTO tutor_applications
          (name, email, phone, location, subjects, education, experience, motivation, availability, tutoring_mode,
           hourly_rate, profile_picture_url, policy_version, adult_confirmed_at, terms_accepted_at, privacy_accepted_at, safety_accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
        hourlyRate.value,
        profilePictureUrl,
        POLICY_VERSION
      );
      await transaction.prepare(`
        INSERT INTO media_assets (id, application_id, kind, mime_type, data, byte_size)
        VALUES (?, ?, 'tutor_application', ?, ?, ?)
      `).run(assetId, applicationResult.lastInsertRowid, mimeType, req.file.buffer, req.file.buffer.length);
      return applicationResult;
    });

    const applicationId = Number(result.lastInsertRowid);
    const content = emailTemplates.tutorApplicationReceived(name, process.env.FRONTEND_URL || 'http://localhost:5173');
    await queueEmail({
      to: email,
      template: 'tutor_application_received',
      subject: 'We received your NextDoorLearn tutor application',
      ...content,
      idempotencyKey: `tutor_application_received_${applicationId}`
    });
    const adminContent = emailTemplates.tutorApplicationAdminAlert({
      name,
      email,
      subjects,
      location: sanitizeText(req.body.location, 160),
      hourlyRate: hourlyRate.value,
      url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin`,
    });
    await Promise.all(adminEmails().map((adminEmail) => queueEmail({
      to: adminEmail,
      template: 'tutor_application_admin_alert',
      subject: 'New NextDoorLearn tutor application',
      ...adminContent,
      idempotencyKey: `tutor_application_admin_alert_${applicationId}_${adminEmail}`,
    })));

    res.status(201).json({
      applicationId,
      message: 'Application received. We will contact you after it is reviewed.'
    });
  } catch (error) {
    console.error('Tutor application error:', error);
    res.status(500).json({ error: 'Unable to submit tutor application' });
  }
});

router.post('/sponsor-inquiries', async (req, res) => {
  try {
    const name = sanitizeText(req.body.name, 120);
    const email = String(req.body.email || '').trim().toLowerCase();
    const sponsorType = sanitizeText(req.body.sponsorType, 80);

    if (!name || !isValidEmail(email) || !sponsorType) {
      return res.status(400).json({ error: 'Name, valid email, and sponsorship interest are required' });
    }

    const result = await db.prepare(`
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

router.get('/waitlist/me', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });

  const entry = await db.prepare(`
    SELECT w.id, w.subjects, w.grade_level, w.budget_preference, w.preferred_schedule,
           w.tutoring_mode, w.learning_goals, w.status, w.matched_tutor_id, w.matched_at, tutor.name AS matched_tutor_name,
           w.created_at, w.updated_at
    FROM student_waitlist_entries w
    LEFT JOIN users tutor ON tutor.id = w.matched_tutor_id
    WHERE w.student_id = ?
  `).get(req.user.userId);

  if (!entry) return res.json(null);
  res.json({ ...entry, subjects: list(JSON.parse(entry.subjects || '[]')) });
});

router.put('/waitlist/me', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    const subjects = list(req.body.subjects);
    if (subjects.length === 0) return res.status(400).json({ error: 'Choose at least one subject' });
    const budgetPreference = sanitizeText(req.body.budgetPreference, 80) || 'flexible';
    if (!STUDENT_BUDGETS.has(budgetPreference)) return res.status(400).json({ error: 'Choose a valid budget preference' });

    await db.prepare(`
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
        matched_tutor_id = NULL,
        matched_by = NULL,
        matched_at = NULL,
        contacted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      req.user.userId,
      JSON.stringify(subjects),
      sanitizeText(req.body.gradeLevel, 80),
      budgetPreference,
      sanitizeText(req.body.preferredSchedule, 500),
      sanitizeText(req.body.tutoringMode, 40),
      sanitizeText(req.body.learningGoals, 1500)
    );

    const entry = await db.prepare('SELECT id, status, created_at, updated_at FROM student_waitlist_entries WHERE student_id = ?').get(req.user.userId);
    res.json({ ...entry, subjects, message: 'You are on the tutor match waitlist.' });
  } catch (error) {
    console.error('Waitlist update error:', error);
    res.status(500).json({ error: 'Unable to update waitlist' });
  }
});

router.delete('/waitlist/me', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
  await db.prepare("UPDATE student_waitlist_entries SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE student_id = ?").run(req.user.userId);
  res.json({ message: 'You have left the waitlist.' });
});

module.exports = router;
