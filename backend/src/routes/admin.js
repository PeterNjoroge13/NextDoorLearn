const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { isPositiveInteger, sanitizeText } = require('../utils/validation');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, role, name, status, email_verified_at, verified_at, created_at, last_seen
      FROM users
      ORDER BY created_at DESC
      LIMIT 250
    `).all();
    res.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id', (req, res) => {
  try {
    const userId = req.params.id;
    const { status, verified } = req.body;

    if (!isPositiveInteger(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required' });
    }

    if (status && !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or suspended' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (status) {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    }

    if (verified !== undefined) {
      db.prepare(`
        UPDATE users
        SET verified_at = ${verified ? 'CURRENT_TIMESTAMP' : 'NULL'}
        WHERE id = ?
      `).run(userId);
    }

    const updated = db.prepare(`
      SELECT id, email, role, name, status, email_verified_at, verified_at, created_at, last_seen
      FROM users WHERE id = ?
    `).get(userId);

    res.json(updated);
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports', (req, res) => {
  try {
    const reports = db.prepare(`
      SELECT r.*, reporter.email as reporter_email, reported.email as reported_email
      FROM user_reports r
      JOIN users reporter ON r.reporter_id = reporter.id
      JOIN users reported ON r.reported_user_id = reported.id
      ORDER BY r.created_at DESC
      LIMIT 250
    `).all();
    res.json(reports);
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/reports/:id', (req, res) => {
  try {
    const reportId = req.params.id;
    const status = sanitizeText(req.body.status, 40);

    if (!isPositiveInteger(reportId)) {
      return res.status(400).json({ error: 'Valid report ID is required' });
    }

    if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid report status' });
    }

    db.prepare(`
      UPDATE user_reports
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reportId);

    const report = db.prepare('SELECT * FROM user_reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Admin report update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tutor-applications', (req, res) => {
  try {
    const applications = db.prepare(`
      SELECT id, name, email, phone, location, profile_picture_url, subjects, education, experience,
             motivation, availability, tutoring_mode, hourly_rate, status, created_at, updated_at
      FROM tutor_applications ORDER BY created_at DESC LIMIT 250
    `).all().map((application) => ({
      ...application,
      subjects: JSON.parse(application.subjects || '[]')
    }));
    res.json(applications);
  } catch (error) {
    console.error('Admin tutor applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tutor-applications/:id', (req, res) => {
  try {
    const applicationId = req.params.id;
    const status = sanitizeText(req.body.status, 40);
    if (!isPositiveInteger(applicationId)) return res.status(400).json({ error: 'Valid application ID is required' });
    if (!['pending', 'reviewing', 'approved', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid application status' });

    const result = db.prepare('UPDATE tutor_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, applicationId);
    if (!result.changes) return res.status(404).json({ error: 'Application not found' });
    res.json(db.prepare('SELECT id, status, updated_at FROM tutor_applications WHERE id = ?').get(applicationId));
  } catch (error) {
    console.error('Admin tutor application update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sponsor-inquiries', (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT id, name, email, organization, sponsor_type, message, status, created_at
      FROM sponsor_inquiries ORDER BY created_at DESC LIMIT 250
    `).all());
  } catch (error) {
    console.error('Admin sponsor inquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/sponsor-inquiries/:id', (req, res) => {
  try {
    const inquiryId = req.params.id;
    const status = sanitizeText(req.body.status, 40);
    if (!isPositiveInteger(inquiryId)) return res.status(400).json({ error: 'Valid inquiry ID is required' });
    if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid inquiry status' });

    const result = db.prepare('UPDATE sponsor_inquiries SET status = ? WHERE id = ?').run(status, inquiryId);
    if (!result.changes) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(db.prepare('SELECT id, status FROM sponsor_inquiries WHERE id = ?').get(inquiryId));
  } catch (error) {
    console.error('Admin sponsor inquiry update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/waitlist', (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT w.*, u.name, u.email
      FROM student_waitlist_entries w JOIN users u ON u.id = w.student_id
      ORDER BY CASE w.status WHEN 'open' THEN 0 ELSE 1 END, w.updated_at DESC
      LIMIT 250
    `).all().map((entry) => ({ ...entry, subjects: JSON.parse(entry.subjects || '[]') }));
    res.json(entries);
  } catch (error) {
    console.error('Admin waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
