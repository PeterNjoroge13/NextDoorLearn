const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { isPositiveInteger, sanitizeText } = require('../utils/validation');
const { createSecurityToken, hashSecurityToken } = require('../utils/securityTokens');
const { queueEmail, processEmailOutbox, providerConfigured } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

const audit = (adminUserId, action, targetType, targetId, details = {}, database = db) => database.prepare(`
  INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, details)
  VALUES (?, ?, ?, ?, ?)
`).run(adminUserId, action, targetType, targetId, JSON.stringify(details));

router.get('/overview', async (req, res) => {
  try {
    const [users, applications, reports, sessions, emails, waitlist] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) AS restricted FROM users").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN review_state IN ('submitted', 'reviewing') THEN 1 ELSE 0 END) AS awaiting_review FROM tutor_applications").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('open', 'reviewing') THEN 1 ELSE 0 END) AS open FROM user_reports").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled FROM sessions").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending FROM email_outbox").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open FROM student_waitlist_entries").get()
    ]);
    res.json({ users, applications, reports, sessions, emails: { ...emails, providerConfigured: providerConfigured() }, waitlist });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Unable to load administration overview' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await db.prepare(`
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

router.patch('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { status, verified } = req.body;

    if (!isPositiveInteger(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required' });
    }

    if (status && !['active', 'suspended', 'banned', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid account status' });
    }

    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (status && status !== 'active' && Number(userId) === Number(req.user.userId)) {
      return res.status(400).json({ error: 'You cannot restrict your own administrator account' });
    }

    if (status) {
      await db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    }

    if (verified !== undefined) {
      await db.prepare(`
        UPDATE users
        SET verified_at = ${verified ? 'CURRENT_TIMESTAMP' : 'NULL'}
        WHERE id = ?
      `).run(userId);
    }

    await audit(req.user.userId, 'user.updated', 'user', userId, { status, verified });

    const updated = await db.prepare(`
      SELECT id, email, role, name, status, email_verified_at, verified_at, created_at, last_seen
      FROM users WHERE id = ?
    `).get(userId);

    res.json(updated);
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reports = await db.prepare(`
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

router.patch('/reports/:id', async (req, res) => {
  try {
    const reportId = req.params.id;
    const status = sanitizeText(req.body.status, 40);

    if (!isPositiveInteger(reportId)) {
      return res.status(400).json({ error: 'Valid report ID is required' });
    }

    if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid report status' });
    }

    await db.prepare(`
      UPDATE user_reports
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reportId);

    const report = await db.prepare('SELECT * FROM user_reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await audit(req.user.userId, 'report.status_updated', 'report', reportId, { status });

    res.json(report);
  } catch (error) {
    console.error('Admin report update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reports/:id/actions', async (req, res) => {
  try {
    const reportId = req.params.id;
    const action = sanitizeText(req.body.action, 40);
    const reason = sanitizeText(req.body.reason, 1000);
    if (!isPositiveInteger(reportId) || !['warn', 'suspend', 'ban', 'reactivate', 'dismiss'].includes(action) || !reason) {
      return res.status(400).json({ error: 'Valid report, moderation action, and reason are required' });
    }
    const report = await db.prepare('SELECT * FROM user_reports WHERE id = ?').get(reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const statusByAction = { suspend: 'suspended', ban: 'banned', reactivate: 'active' };
    await db.withTransaction(async (transaction) => {
      if (statusByAction[action]) {
        await transaction.prepare('UPDATE users SET status = ? WHERE id = ?').run(statusByAction[action], report.reported_user_id);
      }
      await transaction.prepare(`
        INSERT INTO moderation_actions (report_id, subject_user_id, admin_user_id, action, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(reportId, report.reported_user_id, req.user.userId, action, reason);
      await transaction.prepare("UPDATE user_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(action === 'dismiss' ? 'dismissed' : 'resolved', reportId);
      await audit(req.user.userId, `moderation.${action}`, 'user', report.reported_user_id, { reportId, reason }, transaction);
    });
    res.json({ message: `Moderation action ${action} recorded`, action, reportStatus: action === 'dismiss' ? 'dismissed' : 'resolved' });
  } catch (error) {
    console.error('Moderation action error:', error);
    res.status(500).json({ error: 'Unable to apply moderation action' });
  }
});

router.get('/tutor-applications', async (req, res) => {
  try {
    const applications = (await db.prepare(`
      SELECT id, name, email, phone, location, profile_picture_url, subjects, education, experience,
             motivation, availability, tutoring_mode, hourly_rate, status, review_state, activation_status,
             invitation_sent_at, activated_user_id, decision_reason, internal_notes, reviewed_at, created_at, updated_at
      FROM tutor_applications ORDER BY created_at DESC LIMIT 250
    `).all()).map((application) => ({
      ...application,
      subjects: JSON.parse(application.subjects || '[]')
    }));
    res.json(applications);
  } catch (error) {
    console.error('Admin tutor applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tutor-applications/:id', async (req, res) => {
  try {
    const applicationId = req.params.id;
    const status = sanitizeText(req.body.status, 40);
    const reason = sanitizeText(req.body.reason, 1000);
    const internalNotes = sanitizeText(req.body.internalNotes, 2000);
    if (!isPositiveInteger(applicationId)) return res.status(400).json({ error: 'Valid application ID is required' });
    if (!['pending', 'reviewing', 'needs_information', 'approved', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid application status' });

    const application = await db.prepare('SELECT * FROM tutor_applications WHERE id = ?').get(applicationId);
    if (!application) return res.status(404).json({ error: 'Application not found' });

    if (status === 'approved') {
      if (application.activation_status === 'activated') {
        return res.status(409).json({ error: 'This tutor account is already activated' });
      }
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(application.email);
      if (existing && Number(existing.id) !== Number(application.activated_user_id)) {
        return res.status(409).json({ error: 'An account already exists with this applicant email' });
      }

      const rawToken = createSecurityToken();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await db.withTransaction(async (transaction) => {
        await transaction.prepare(`
          UPDATE tutor_activation_tokens SET revoked_at = CURRENT_TIMESTAMP
          WHERE application_id = ? AND used_at IS NULL AND revoked_at IS NULL
        `).run(applicationId);
        await transaction.prepare(`
          INSERT INTO tutor_activation_tokens (application_id, token_hash, expires_at) VALUES (?, ?, ?)
        `).run(applicationId, hashSecurityToken(rawToken), expiresAt);
        await transaction.prepare(`
          UPDATE tutor_applications SET status = 'approved', review_state = 'approved', activation_status = 'invited',
            reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, decision_reason = ?, internal_notes = ?,
            invitation_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.user.userId, reason, internalNotes, applicationId);
        await audit(req.user.userId, 'tutor_application.approved', 'tutor_application', applicationId, { reason }, transaction);
      });

      const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/activate-tutor?token=${rawToken}`;
      const content = emailTemplates.tutorActivation(application.name, link);
      await queueEmail({
        to: application.email,
        template: 'tutor_activation',
        subject: 'Activate your approved NextDoorLearn tutor account',
        ...content,
        idempotencyKey: `tutor_invite_${applicationId}_${hashSecurityToken(rawToken).slice(0, 24)}`
      });
      const updated = await db.prepare('SELECT id, status, review_state, activation_status, invitation_sent_at, reviewed_at, updated_at FROM tutor_applications WHERE id = ?').get(applicationId);
      return res.json({ ...updated, ...(process.env.NODE_ENV === 'production' ? {} : { activationToken: rawToken }) });
    }

    const storedStatus = status === 'needs_information' ? 'reviewing' : status;
    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        UPDATE tutor_applications SET status = ?, review_state = ?, activation_status = 'not_invited',
          reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, decision_reason = ?, internal_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(storedStatus, status === 'pending' ? 'submitted' : status, req.user.userId, reason, internalNotes, applicationId);
      if (status === 'declined') {
        await transaction.prepare(`UPDATE tutor_activation_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE application_id = ? AND used_at IS NULL`).run(applicationId);
      }
      await transaction.prepare(`
        INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, details)
        VALUES (?, ?, 'tutor_application', ?, ?)
      `).run(req.user.userId, `tutor_application.${status}`, applicationId, JSON.stringify({ reason }));
    });
    if (['needs_information', 'declined'].includes(status)) {
      const content = emailTemplates.tutorApplicationDecision(
        application.name,
        status,
        reason,
        status === 'needs_information'
          ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/apply/tutor`
          : (process.env.FRONTEND_URL || 'http://localhost:5173')
      );
      await queueEmail({
        to: application.email,
        template: `tutor_application_${status}`,
        subject: status === 'needs_information' ? 'More information needed for your tutor application' : 'Update on your tutor application',
        ...content,
        idempotencyKey: `tutor_application_${status}_${applicationId}_${Date.now()}`
      });
    }
    res.json(await db.prepare('SELECT id, status, review_state, activation_status, reviewed_at, updated_at FROM tutor_applications WHERE id = ?').get(applicationId));
  } catch (error) {
    console.error('Admin tutor application update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT a.*, u.name AS admin_name, u.email AS admin_email
      FROM admin_audit_logs a JOIN users u ON u.id = a.admin_user_id
      ORDER BY a.created_at DESC LIMIT 250
    `).all();
    res.json(rows.map((row) => ({ ...row, details: JSON.parse(row.details || '{}') })));
  } catch (error) {
    console.error('Admin audit log error:', error);
    res.status(500).json({ error: 'Unable to load audit log' });
  }
});

router.get('/email-outbox', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, recipient, template, subject, status, provider_id, attempts, next_attempt_at,
             last_error, sent_at, created_at, updated_at
      FROM email_outbox ORDER BY created_at DESC LIMIT 250
    `).all();
    res.json({ providerConfigured: providerConfigured(), emails: rows });
  } catch (error) {
    console.error('Admin email outbox error:', error);
    res.status(500).json({ error: 'Unable to load email delivery history' });
  }
});

router.post('/email-outbox/process', async (req, res) => {
  const results = await processEmailOutbox(50);
  await audit(req.user.userId, 'email_outbox.processed', 'email_outbox', null, { count: results.length });
  res.json({ processed: results.length, sent: results.filter((item) => item.status === 'sent').length });
});

router.get('/sponsor-inquiries', async (req, res) => {
  try {
    res.json(await db.prepare(`
      SELECT id, name, email, organization, sponsor_type, message, status, created_at
      FROM sponsor_inquiries ORDER BY created_at DESC LIMIT 250
    `).all());
  } catch (error) {
    console.error('Admin sponsor inquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/sponsor-inquiries/:id', async (req, res) => {
  try {
    const inquiryId = req.params.id;
    const status = sanitizeText(req.body.status, 40);
    if (!isPositiveInteger(inquiryId)) return res.status(400).json({ error: 'Valid inquiry ID is required' });
    if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid inquiry status' });

    const result = await db.prepare('UPDATE sponsor_inquiries SET status = ? WHERE id = ?').run(status, inquiryId);
    if (!result.changes) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(await db.prepare('SELECT id, status FROM sponsor_inquiries WHERE id = ?').get(inquiryId));
  } catch (error) {
    console.error('Admin sponsor inquiry update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/waitlist', async (req, res) => {
  try {
    const entries = (await db.prepare(`
      SELECT w.*, u.name, u.email
      FROM student_waitlist_entries w JOIN users u ON u.id = w.student_id
      ORDER BY CASE w.status WHEN 'open' THEN 0 ELSE 1 END, w.updated_at DESC
      LIMIT 250
    `).all()).map((entry) => ({ ...entry, subjects: JSON.parse(entry.subjects || '[]') }));
    res.json(entries);
  } catch (error) {
    console.error('Admin waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
